import { describe, expect, it } from 'vitest'
import { defaultHK, defaultRiichi } from '../src/features/match/rules'
import { createMatch, completeLegacyHKUnit, syncMatch } from '../src/features/match/engine'
import { recordAction, projectRound } from '../src/features/actions/engine'
import { scoreRiichi } from '../src/features/scoring/riichi'
import { defaultRiichiScoreRules } from '../src/features/scoring/models'
import { ordinaryConditions, firstTurnOption, reconcileFirstTurn } from '../src/features/hands/workflow'
import { evaluateWin } from '../src/features/scoring/evaluate'
import { lockWinningHand, finalizeWinningRound } from '../src/features/scoring/settlement'
import { syncRoundIndicators, updateIndicator } from '../src/features/scoring/indicators'
import { decodeSettings } from '../src/storage/settings'
import type { Settings } from '../src/storage/settings'
import { call, fourPlayers, newGame } from './handFixtures'
import { draftFor, reviewedConditions, scoringGame } from './scoringFixtures'
import { saveRecordedMeld } from '../src/features/hands/builder'
import { tileInstance } from '../src/features/hands/tiles'
const ordinary = ordinaryConditions()
function modern(variant: 'hong-kong' | 'riichi' = 'hong-kong') {
  let data = newGame(variant); data = { ...data, match: createMatch(data, variant === 'hong-kong' ? defaultHK() : defaultRiichi(), false) }
  if (variant === 'riichi') data = updateIndicator(syncRoundIndicators(data), 'initial:round-a', 'effective', 'west')
  return data
}
const settingsFor = (gameplay: ReturnType<typeof modern>): Settings => ({ variant: gameplay.match!.variant, players: fourPlayers, setup: { version: 1, hkDiceCount: 3, phase: 'playing', dealer: 'bottom', turn: 'bottom', dice: gameplay.match!.variant === 'hong-kong' ? [1, 1, 1] : [1, 1] }, gameplay })
describe('stable selected rules and RC5 compatibility', () => {
  it('uses base unit one and double variants only for new matches, preserving explicit settings', () => {
    expect(defaultHK().scoring).toMatchObject({ baseUnit: 1, firstTurn: 'v1', humanWin: false })
    expect(defaultRiichi().scoring).toMatchObject({ doubleYakuman: true, namedDoubleVariants: true })
    expect(createMatch(newGame(), { ...defaultHK(), scoring: { ...defaultHK().scoring!, baseUnit: 7 } }, false).rules.scoring).toMatchObject({ baseUnit: 7 })
    expect(createMatch(newGame('riichi'), { ...defaultRiichi(), scoring: { ...defaultRiichiScoreRules(), doubleYakuman: false } }, false).rules.scoring).toMatchObject({ doubleYakuman: false })
    const legacy = scoringGame('hong-kong'); const before = structuredClone(legacy)
    const updated = completeLegacyHKUnit(settingsFor(legacy), 5)
    expect(updated.gameplay!.match!.rules.scoring).toMatchObject({ baseUnit: 5 })
    expect(legacy).toEqual(before)
    expect(updated.gameplay!.match!.history).toEqual(before.match!.history)
    expect(() => completeLegacyHKUnit(updated, 6)).toThrow()
  })
  it('clears stale red composition when correcting the tile of an existing meld', () => {
    const data = recordAction(modern('riichi'), 'right', { ...call('pon', '5m', 'red-pon'), redCount: 1 })
    const meld = projectRound(data, 'round-a').melds[0]
    const corrected = saveRecordedMeld(data, 'right', 'pon', '6m', 'bottom', meld)
    expect(projectRound(corrected, 'round-a').melds[0]).toMatchObject({ id: meld.id, tile: '6m', redCount: 0 })
  })
  it('preserves the tested open pure-flush 9-Fan self-draw and 96-per-player payments', () => {
    let data = modern(); data = recordAction(data, 'right', { ...call('chi', '1m', 'chi-a'), sourcePlayer: 'bottom' })
    const hand = draftFor('12345678911155m', '5m', 'hong-kong'); hand.concealed = hand.concealed.slice(3)
    hand.melds = projectRound(data, 'round-a').melds; hand.flowers = ['summer']; hand.win = { method: 'tsumo', sourcePlayer: null, specialFlower: false }
    const score = evaluateWin(data, hand, ordinary)
    expect(score).toMatchObject({ fan: 9, winnerTotal: 288 })
    expect(score.components).toEqual(expect.arrayContaining([{ name: '清一色', value: 7, kind: 'fan' }, { name: '自摸', value: 1, kind: 'fan' }, { name: '正花', value: 1, kind: 'fan' }]))
    expect(score.payments.map((p) => p.amount)).toEqual([96, 96, 96])
  })
  it.each([['bottom', 'tsumo', 'hkHeaven'], ['right', 'tsumo', 'hkEarth'], ['right', 'ron', 'hkHuman']] as const)('validates v1.0 %s %s %s at 13 Fan', (winner, method, key) => {
    const data = modern(); if (data.match!.rules.variant === 'hong-kong') data.match!.rules.scoring!.humanWin = true
    const hand = draftFor('123456m55789p234s', '4s', 'hong-kong'); hand.winner = winner; hand.win = { method, sourcePlayer: method === 'ron' ? 'bottom' : null, specialFlower: false }
    expect(firstTurnOption(data, hand)?.key).toBe(key)
    const conditions = { ...ordinary, [key]: true }
    expect(evaluateWin(data, hand, conditions).fan).toBe(13)
    const wrong = { ...hand, win: { ...hand.win, method: method === 'ron' ? 'tsumo' as const : 'ron' as const, sourcePlayer: method === 'ron' ? null : winner === 'bottom' ? 'right' as const : 'bottom' as const } }
    expect(() => evaluateWin(data, wrong, conditions)).toThrow()
    expect(reconcileFirstTurn(data, wrong, conditions)[key]).toBe(false)
    const called = recordAction(data, 'top', call('pon', '9m', 'prior-call'))
    expect(() => evaluateWin(called, hand, conditions)).toThrow(/首巡/)
  })
  it('blocks disabled Human win, wrong source, dealer Earth, known calls and exceptional payments', () => {
    const data = modern(); const hand = draftFor('123456m55789p234s', '4s', 'hong-kong')
    expect(firstTurnOption(data, hand)).toBeNull()
    expect(() => evaluateWin(data, hand, { ...ordinary, hkHuman: true })).toThrow(/未啟用/)
    expect(() => evaluateWin(data, hand, { ...ordinary, exceptional: true })).toThrow(/特殊/)
    if (data.match!.rules.variant === 'hong-kong') data.match!.rules.scoring!.humanWin = true
    expect(() => evaluateWin(data, { ...hand, win: { ...hand.win, sourcePlayer: 'top' } }, { ...ordinary, hkHuman: true })).toThrow(/莊家第一張/)
    expect(() => evaluateWin(data, { ...hand, winner: 'bottom', win: { method: 'tsumo', sourcePlayer: null, specialFlower: false } }, { ...ordinary, hkEarth: true })).toThrow(/閒家/)
  })
  it('keeps historical RC5 Earth-discard snapshots and payments unchanged after decode', () => {
    const old = scoringGame('hong-kong'); const hand = draftFor('123456m55789p234s', '4s', 'hong-kong')
    const locked = lockWinningHand(old, hand, { ...reviewedConditions(), hkEarth: true, hkBaseUnit: 1 }, true)
    const paid = finalizeWinningRound(settingsFor(locked), locked.wins![0].id, true)
    paid.gameplay!.version = 2
    const before = structuredClone(paid.gameplay)
    const restored = decodeSettings({ schemaVersion: 1, ...paid })
    expect(restored.gameplay!.version).toBe(3)
    expect({ ...restored.gameplay, version: 2 }).toEqual(before)
    expect(restored.gameplay!.wins![0]).toMatchObject({ conditions: { hkEarth: true }, score: { fan: 13, winnerTotal: 768 } })
    expect(() => finalizeWinningRound(restored, locked.wins![0].id, true)).toThrow()
  })
  it.each([['bottom', 'tenhou'], ['right', 'chiihou']] as const)('scores %s %s as a genuine single Yakuman with explicit first-turn context', (winner, key) => {
    const data = modern('riichi'); const hand = draftFor('123456m55789p234s', '4s'); hand.winner = winner; hand.win = { method: 'tsumo', sourcePlayer: null, specialFlower: false }
    expect(evaluateWin(data, hand, { ...ordinary, [key]: true })).toMatchObject({ yakuman: 1, basePoints: 8000 })
    expect(() => evaluateWin(recordAction(data, 'top', call('ankan', '9m')), hand, { ...ordinary, [key]: true })).toThrow(/首巡/)
  })
  it.each([
    ['119m19p19s1234567z', '1m', 'ron', '國士無雙十三面待ち', 2], ['119m19p19s1234567z', '9m', 'ron', '國士無雙', 1],
    ['111222333m44455p', '5p', 'ron', '四暗刻單騎', 2], ['111222333m44455p', '1m', 'tsumo', '四暗刻', 1],
    ['11123456789995m', '5m', 'ron', '純正九蓮寶燈', 2], ['11123456789999m', '1m', 'ron', '九蓮寶燈', 1],
    ['111222333444z55m', 'north', 'ron', '大四喜', 2], ['111222333z44z555m', '5m', 'ron', '小四喜', 1],
  ] as const)('distinguishes %s %s as %s %s', (notation, win, method, name, value) => {
    const hand = draftFor(notation, win); hand.win = { method, sourcePlayer: method === 'ron' ? 'bottom' : null, specialFlower: false }
    const rules = defaultRiichi(); const result = scoreRiichi(hand, rules, ordinary, false, 28, 27)
    expect(result.components).toContainEqual({ name, value, kind: 'yakuman' })
    rules.scoring!.doubleYakuman = false
    expect(scoreRiichi(hand, rules, ordinary, false, 28, 27).components).toContainEqual({ name, value: 1, kind: 'yakuman' })
  })
  it('preserves dealer Tsumo 5 Han 30 Fu Mangan and 14 Han 25 Fu counted scoring', () => {
    let data = modern('riichi'); data = syncMatch(recordAction(data, 'bottom', { kind: 'riichi', confirmed: true })); data = updateIndicator(data, 'initial:round-a', 'effective', '4p')
    const hand = draftFor('123456m555z234s55p', '4s'); hand.winner = 'bottom'; hand.win = { method: 'tsumo', sourcePlayer: null, specialFlower: false }; hand.indicators = [{ id: 'ura', kind: 'ura', tile: tileInstance('west') }]
    expect(evaluateWin(data, hand, ordinary)).toMatchObject({ han: 5, fu: 30, label: '滿貫', basePoints: 2000 })
    data = modern('riichi'); if (data.match!.rules.variant === 'riichi') data.match!.rules.redFives.m = 2
    data = syncMatch(recordAction(data, 'right', { kind: 'riichi', confirmed: true })); data = updateIndicator(data, 'initial:round-a', 'effective', '1m')
    const seven = draftFor('11223355m556677z', 'red'); seven.redFives.perSuit.m = 2; seven.concealed.filter((tile) => tile.type === '5m').forEach((tile) => { tile.red = true }); seven.indicators = [{ id: 'ura', kind: 'ura', tile: tileInstance('2m') }]
    expect(evaluateWin(data, seven, { ...ordinary, doubleRiichi: true, ippatsu: true })).toMatchObject({ han: 14, fu: 25, label: '累計役滿', yakuman: 0, basePoints: 8000 })
  })
})
