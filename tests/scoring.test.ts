import { describe, expect, it } from 'vitest'
import { makeMeld } from '../src/features/actions/engine'
import { defaultHK, defaultRiichi } from '../src/features/match/rules'
import { scoreRiichi, calculateFu, pairFu, riichiLimit } from '../src/features/scoring/riichi'
import { scoreHongKong, hkMultiplier } from '../src/features/scoring/hongKong'
import { defaultRiichiScoreRules } from '../src/features/scoring/models'
import { enumerateHands } from '../src/features/scoring/shape'
import type { Interpretation } from '../src/features/scoring/shape'
import { evaluateWin } from '../src/features/scoring/evaluate'
import { tileInstance } from '../src/features/hands/tiles'
import { draftFor, parseTiles, reviewedConditions, scoringGame } from './scoringFixtures'
const conditions = reviewedConditions()
const jp = defaultRiichi(); const profile = defaultRiichiScoreRules()
const score = (draft: ReturnType<typeof draftFor>, riichi = false) => scoreRiichi(draft, jp, conditions, riichi, 28, 27)
describe('independently specified Riichi scoring examples', () => {
  it('scores closed Pinfu Ron as 1 Han 30 Fu and Tsumo as 2 Han 20 Fu', () => {
    const draft = draftFor('123456m55789p234s', '4s')
    expect(score(draft)).toMatchObject({ han: 1, fu: 30, basePoints: 240 })
    expect(score({ ...draft, win: { ...draft.win, method: 'tsumo', sourcePlayer: null } })).toMatchObject({ han: 2, fu: 20, basePoints: 320 })
  })
  it('scores Chiitoitsu as exactly 25 Fu', () => {
    expect(score(draftFor('1122m3344p5566s77z', 'red'))).toMatchObject({ han: 2, fu: 25, basePoints: 400 })
  })
  it('recognizes Kokushi and the configurable thirteen-sided double variant', () => {
    const hand = draftFor('119m19p19s1234567z', '1m')
    expect(score(hand)).toMatchObject({ yakuman: 1, basePoints: 8000 })
    expect(scoreRiichi(hand, { ...jp, scoring: { ...profile, doubleYakuman: true } }, conditions, false, 28, 27)).toMatchObject({ yakuman: 2, basePoints: 16000 })
  })
  it('enumerates multiple valid decompositions and chooses the highest payable result', () => {
    const draft = draftFor('11223344556677m', '7m')
    expect(enumerateHands(parseTiles('11223344556677m'), [], '7m').length).toBeGreaterThan(2)
    const result = score(draft)
    expect(result).toMatchObject({ han: 10, fu: 30, basePoints: 4000, label: '倍滿' })
    expect(result.components.some((item) => item.name === '二盃口')).toBe(true)
    expect(result.components.some((item) => item.name === '七對子' || item.name === '一盃口')).toBe(false)
  })
  it('does not let Dora establish a Yaku on an open hand', () => {
    const hand = draftFor('123m456p789s234m55p', '5p')
    hand.concealed = hand.concealed.slice(3)
    hand.melds = [makeMeld('chi', '1m', 'right', hand.roundId, 'riichi')]
    hand.indicators = [{ id: 'dora', kind: 'dora', tile: tileInstance('4p') }]
    expect(() => score(hand)).toThrow(/役/)
  })
  it('supports open Tanyao, reducing closed-only eligibility', () => {
    const hand = draftFor('234m345p456s678m22p', '2p')
    hand.concealed = hand.concealed.slice(3); hand.melds = [makeMeld('chi', '2m', 'right', hand.roundId, 'riichi')]
    expect(score(hand)).toMatchObject({ han: 1, fu: 30 })
    expect(() => scoreRiichi(hand, { ...jp, scoring: { ...profile, openTanyao: false } }, conditions, false, 28, 27)).toThrow(/役/)
  })
  it('counts repeated indicators separately, and never Ura without Riichi', () => {
    const hand = draftFor('123456m55789p234s', '4s')
    hand.indicators = [{ id: 'd1', kind: 'dora', tile: tileInstance('4p') }, { id: 'd2', kind: 'dora', tile: tileInstance('4p') }, { id: 'u1', kind: 'ura', tile: tileInstance('4p') }]
    expect(score(hand)).toMatchObject({ han: 5, bonuses: { dora: 2, kanDora: 2, ura: 0, kanUra: 0, redDora: 0 } })
    expect(score(hand, true)).toMatchObject({ han: 8 })
  })
  it('separates red Dora from indicator Dora', () => {
    const hand = draftFor('123456m55789p234s', '4s'); hand.concealed.find((tile) => tile.type === '5p')!.red = true
    expect(score(hand)).toMatchObject({ han: 2, fu: 30 })
    expect(score(hand).components).toContainEqual({ name: '赤寶牌', kind: 'bonus', value: 1 })
  })
  it('stacks genuine Yakuman and supports disabling stacking and doubles', () => {
    const hand = draftFor('111222333444z55z', 'white')
    expect(score(hand)).toMatchObject({ yakuman: 3, basePoints: 24000, label: '三倍役滿' })
    expect(scoreRiichi(hand, { ...jp, scoring: { ...profile, doubleYakuman: true } }, conditions, false, 28, 27)).toMatchObject({ yakuman: 5, basePoints: 40000 })
    expect(scoreRiichi(hand, { ...jp, scoring: { ...profile, stackYakuman: false } }, conditions, false, 28, 27)).toMatchObject({ yakuman: 1 })
  })
  it.each([[3, 70, 2000, '滿貫'], [4, 40, 2000, '滿貫'], [5, 30, 2000, '滿貫'], [6, 30, 3000, '跳滿'], [7, 30, 3000, '跳滿'], [8, 30, 4000, '倍滿'], [10, 30, 4000, '倍滿'], [11, 30, 6000, '三倍滿'], [12, 30, 6000, '三倍滿'], [13, 30, 8000, '累計役滿']] as const)('calculates %i Han %i Fu', (han, fu, basePoints, label) => expect(riichiLimit(han, fu, 0, profile)).toMatchObject({ basePoints, label }))
  it('configures Kiriage and Kazoe without changing genuine Yakuman', () => {
    expect(riichiLimit(4, 30, 0, profile).basePoints).toBe(1920)
    expect(riichiLimit(4, 30, 0, { ...profile, kiriage: true }).basePoints).toBe(2000)
    expect(riichiLimit(13, 30, 0, { ...profile, kazoe: 'sanbaiman' }).basePoints).toBe(6000)
    expect(riichiLimit(0, 0, 2, { ...profile, kazoe: 'sanbaiman' }).basePoints).toBe(16000)
  })
})
describe('exact Fu components', () => {
  const shape: Interpretation = { kind: 'standard', pair: 13, groups: [], winningGroup: -1, wait: 'ryanmen', key: '' }
  it.each([['triplet', false, 1, 4], ['triplet', true, 1, 2], ['triplet', false, 0, 8], ['triplet', true, 27, 4], ['kan', false, 1, 16], ['kan', true, 1, 8], ['kan', false, 27, 32], ['kan', true, 0, 16]] as const)('%s open=%s tile=%i gives %i Fu', (type, open, tile, amount) => {
    const result = calculateFu({ ...shape, groups: [{ type, open, tile, fixed: true }] }, 'ron', true, false, 28, 27, profile)
    expect(result.breakdown.find((item) => /刻|槓/.test(item.name))?.value).toBe(amount)
  })
  it.each(['kanchan', 'penchan', 'tanki'] as const)('%s wait gives two Fu', (wait) => {
    const result = calculateFu({ ...shape, wait }, 'ron', true, false, 28, 27, profile)
    expect(result.fu).toBe(40); expect(result.breakdown.some((item) => item.value === 2)).toBe(true)
  })
  it('treats the Ron-completed triplet as open for Fu', () => {
    const result = calculateFu({ ...shape, winningGroup: 0, wait: 'shanpon', groups: [{ type: 'triplet', open: false, tile: 1, fixed: false }] }, 'ron', true, false, 28, 27, profile)
    expect(result.breakdown).toContainEqual({ name: '明刻 · 中張', value: 2 })
  })
  it('handles double-wind pair policy and open no-Fu minimum', () => {
    expect(pairFu(27, 27, 27, profile)).toBe(4)
    expect(pairFu(27, 27, 27, { ...profile, doubleWindPair: 2 })).toBe(2)
    expect(calculateFu(shape, 'ron', false, false, 28, 27, profile).fu).toBe(30)
  })
})
describe('HK orthodox patterns and explicit payments', () => {
  const hk = defaultHK()
  it('rejects below minimum, counts basic patterns and caps correctly', () => {
    const draft = draftFor('123456m55789p234s', '4s', 'hong-kong')
    expect(scoreHongKong(draft, hk, conditions, 28, 27)).toMatchObject({ fan: 3 })
    draft.melds = [makeMeld('chi', '1m', 'right', 'round-a', 'hong-kong')]; draft.concealed = draft.concealed.slice(3)
    expect(() => scoreHongKong(draft, hk, conditions, 28, 27)).toThrow(/未達/)
    const orphans = draftFor('119m19p19s1234567z', '1m', 'hong-kong')
    expect(scoreHongKong(orphans, hk, conditions, 28, 27)).toMatchObject({ rawFan: 13, fan: 13 })
    expect(scoreHongKong(orphans, { ...hk, fanCap: 10 }, conditions, 28, 27)).toMatchObject({ rawFan: 13, fan: 10 })
  })
  it('does not add Menzen or Toitoi to Kankan, but adds compatible honor bonuses', () => {
    const draft = draftFor('111m222p333s111z55p', '5p', 'hong-kong')
    const value = scoreHongKong(draft, hk, conditions, 28, 27)
    expect(value.components).toContainEqual({ name: '坎坎糊', kind: 'fan', value: 8 })
    expect(value.components.some((item) => ['門前清', '對對糊'].includes(item.name))).toBe(false)
    expect(value.components).toContainEqual({ name: '圈風刻／槓', kind: 'fan', value: 1 })
  })
  it('replaces matching flower bonuses with a complete flower set', () => {
    const draft = draftFor('123456m55789p234s', '4s', 'hong-kong'); draft.flowers = ['spring', 'summer', 'autumn', 'winter', 'orchid']
    const value = scoreHongKong(draft, hk, conditions, 28, 27)
    expect(value.components.filter((item) => item.name === '一檯花')).toHaveLength(1)
    expect(value.components.filter((item) => item.name === '正花')).toHaveLength(1)
    expect(value.components.some((item) => item.name === '無花')).toBe(false)
  })
  it('scores the agreed seven-flower instant win at exactly 3 Fan without 14 tiles', () => {
    const draft = draftFor('123456m55789p234s', '4s', 'hong-kong'); draft.concealed = []; draft.winningTile = null
    draft.win = { method: 'tsumo', sourcePlayer: null, specialFlower: true }; draft.flowers = ['spring', 'summer', 'autumn', 'winter', 'plum', 'orchid', 'bamboo']
    expect(scoreHongKong(draft, hk, conditions, 28, 27)).toMatchObject({ fan: 3, rawFan: 3 })
    draft.flowers.push('spring'); expect(() => scoreHongKong(draft, hk, conditions, 28, 27)).toThrow()
  })
  it.each([[3, 8], [4, 16], [5, 24], [6, 32], [7, 48], [8, 64], [9, 96], [10, 128], [11, 192], [12, 256], [13, 384]])('half-la %i Fan is %i base units', (fan, amount) => expect(hkMultiplier(fan, 'half-la')).toBe(amount))
  it('full-la doubles every Fan, and missing monetary units block settlement', () => {
    expect(hkMultiplier(10, 'full-la')).toBe(1024)
    expect(() => evaluateWin(scoringGame('hong-kong'), draftFor('123456m55789p234s', '4s', 'hong-kong'), conditions)).toThrow(/基本單位/)
  })
  it('calculates exact HK Ron and Tsumo amounts with independent custom values', () => {
    const data = scoringGame('hong-kong'); const draft = draftFor('123456m55789p234s', '4s', 'hong-kong')
    expect(evaluateWin(data, draft, { ...conditions, hkBaseUnit: 2 }).deltas).toEqual({ top: 0, right: 32, bottom: -32, left: 0 })
    data.match!.rules = { ...hk, payment: 'custom', payouts: Array.from({ length: 11 }, (_, index) => ({ fan: index + 3, ron: index === 0 ? 120 : 200, tsumo: index === 0 ? 45 : 75 })) }
    expect(evaluateWin(data, draft, conditions).deltas).toEqual({ top: 0, right: 120, bottom: -120, left: 0 })
    draft.win = { ...draft.win, method: 'tsumo', sourcePlayer: null }
    expect(evaluateWin(data, draft, conditions).deltas).toEqual({ top: -75, right: 225, bottom: -75, left: -75 })
  })
})
describe('Riichi four-player transfers', () => {
  it('rounds each payer, adds Honba and awards only the existing pool', () => {
    const data = scoringGame(); const draft = draftFor('123456m55789p234s', '4s')
    data.match!.honba = 2; data.match!.pool = 2000
    const ron = evaluateWin(data, draft, conditions)
    expect(ron.deltas).toEqual({ top: 0, right: 3600, bottom: -1600, left: 0 })
    expect(ron.poolDelta).toBe(-2000)
    expect(Object.values(ron.deltas).reduce((a, b) => a + b, 0) + ron.poolDelta).toBe(0)
    draft.win = { ...draft.win, method: 'tsumo', sourcePlayer: null }
    expect(evaluateWin(data, draft, conditions).deltas).toEqual({ top: -600, right: 4100, bottom: -900, left: -600 })
  })
  it('pays dealer Ron and dealer Tsumo correctly', () => {
    const data = scoringGame(); const draft = draftFor('123456m55789p234s', '4s'); draft.winner = 'bottom'; draft.win.sourcePlayer = 'right'
    expect(evaluateWin(data, draft, conditions).deltas).toEqual({ top: 0, right: -1500, bottom: 1500, left: 0 })
    draft.win = { ...draft.win, method: 'tsumo', sourcePlayer: null }
    expect(evaluateWin(data, draft, conditions).deltas).toEqual({ top: -700, right: -700, bottom: 2100, left: -700 })
  })
})
