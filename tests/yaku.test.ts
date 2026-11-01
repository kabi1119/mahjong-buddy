import { describe, expect, it } from 'vitest'
import { makeMeld } from '../src/features/actions/engine'
import { defaultHK, defaultRiichi } from '../src/features/match/rules'
import { defaultRiichiScoreRules } from '../src/features/scoring/models'
import { scoreRiichi } from '../src/features/scoring/riichi'
import { scoreHongKong } from '../src/features/scoring/hongKong'
import type { HandDraft } from '../src/features/actions/models'
import type { TileType } from '../src/features/hands/tiles'
import { draftFor, reviewedConditions } from './scoringFixtures'
const rules = defaultRiichi(); const conditions = reviewedConditions()
function expose(draft: HandDraft, kind: 'chi' | 'pon' | 'ankan' | 'daiminkan', tile: TileType) {
  const meld = makeMeld(kind, tile, draft.winner, draft.roundId, draft.variant, crypto.randomUUID(), 'bottom')
  for (const type of meld.tiles.slice(0, 3).map((item) => item.type)) {
    const index = draft.concealed.findIndex((item) => item.type === type)
    if (index < 0) throw Error('Fixture exposes winning or absent tile')
    draft.concealed.splice(index, 1)
  }
  draft.melds.push(meld); return draft
}
const jp = (draft: HandDraft) => scoreRiichi(draft, rules, conditions, false, 28, 27)
describe('standard Riichi Yaku catalog and open reductions', () => {
  it.each([
    ['112233m456p789s55p', '5p', '一盃口', 1],
    ['123456789m11122z', 'south', '一氣通貫', 2],
    ['123m123p123s789m55p', '5p', '三色同順', 2],
    ['222m222p222s345m55p', '5p', '三色同刻', 2],
    ['111m222p333s444m55p', '4m', '對對和', 2],
    ['111m222p333s444m55p', '4m', '三暗刻', 2],
    ['123m789p123s11122z', 'south', '混全帶幺九', 2],
    ['123m789p123s999m11p', '1p', '純全帶幺九', 3],
    ['111999m111p55522z', '1m', '混老頭', 2],
    ['55566677z123m789p', 'red', '小三元', 2],
    ['123456789m11122z', 'south', '混一色', 3],
    ['12345678933322m', '2m', '清一色', 6],
  ] as const)('%s recognizes %s / %s at %i Han', (notation, win, name, han) => {
    expect(jp(draftFor(notation, win)).components).toContainEqual({ name, value: han, kind: 'yaku' })
  })
  it.each([
    ['123456789m11122z', 'south', '1m', '一氣通貫', 1],
    ['123m123p123s789m55p', '5p', '1m', '三色同順', 1],
    ['123m789p123s11122z', 'south', '1m', '混全帶幺九', 1],
    ['123m789p123s999m11p', '1p', '1m', '純全帶幺九', 2],
    ['123456789m11122z', 'south', '1m', '混一色', 2],
    ['12345678933322m', '2m', '1m', '清一色', 5],
  ] as const)('reduces %s / %s with exposed %s to %s at %i Han', (notation, win, exposed, name, han) => {
    expect(jp(expose(draftFor(notation, win), 'chi', exposed)).components).toContainEqual({ name, value: han, kind: 'yaku' })
  })
  it('counts each Dragon and double wind independently', () => {
    const hand = draftFor('111z234m345p678s55p', '5p')
    const value = scoreRiichi(hand, rules, conditions, false, 27, 27)
    expect(value.components.filter((item) => item.name === '自風牌' || item.name === '場風牌').map((item) => item.value)).toEqual([1, 1])
    const dragons = jp(draftFor('55566677z123m789p', 'red')).components
    expect(dragons).toContainEqual({ name: '白', value: 1, kind: 'yaku' }); expect(dragons).toContainEqual({ name: '發', value: 1, kind: 'yaku' })
  })
  it('counts three physical Kans as Sankantsu, not four melds plus three more', () => {
    let hand = draftFor('111m222p333s444m55p', '4m')
    for (const type of ['1m', '2p', '3s'] as const) hand = expose(hand, 'ankan', type)
    expect(jp(hand).components).toContainEqual({ name: '三槓子', value: 2, kind: 'yaku' })
    expect(jp(hand)).toMatchObject({ fu: 100 })
  })
  it('uses only focused manual evidence for situational Yaku', () => {
    const hand = draftFor('123456m55789p234s', '4s')
    expect(scoreRiichi(hand, rules, { ...conditions, doubleRiichi: true, ippatsu: true }, true, 28, 27).components).toEqual(expect.arrayContaining([{ name: '雙立直', value: 2, kind: 'yaku' }, { name: '一發', value: 1, kind: 'yaku' }]))
    expect(scoreRiichi(hand, rules, { ...conditions, chankan: true, houtei: true }, false, 28, 27).components).toEqual(expect.arrayContaining([{ name: '搶槓', value: 1, kind: 'yaku' }, { name: '河底撈魚', value: 1, kind: 'yaku' }]))
    expect(jp(hand).components.some((item) => ['一發', '海底摸月', '河底撈魚', '搶槓'].includes(item.name))).toBe(false)
  })
})
describe('genuine Yakuman catalog', () => {
  it.each([
    ['111m555666777z22p', '1m', '大三元'],
    ['11122233344z444m', '4m', '小四喜'],
    ['111222333444z55p', 'north', '大四喜'],
    ['11122233355566z', 'white', '字一色'],
    ['11223344556677z', 'red', '字一色'],
    ['111999m11199p999s', '9s', '清老頭'],
    ['22233344466688s', '6s', '綠一色'],
    ['11123455678999m', '1m', '九蓮寶燈'],
  ] as const)('recognizes %s / %s as %s', (notation, win, name) => {
    expect(jp(draftFor(notation, win)).components).toContainEqual({ name, value: 1, kind: 'yakuman' })
  })
  it('distinguishes pure Chuuren and configures its double variant', () => {
    const profile = { ...defaultRiichiScoreRules(), doubleYakuman: true }
    expect(scoreRiichi(draftFor('11123455678999m', '5m'), { ...rules, scoring: profile }, conditions, false, 28, 27)).toMatchObject({ yakuman: 2 })
    expect(scoreRiichi(draftFor('11123455678999m', '1m'), { ...rules, scoring: profile }, conditions, false, 28, 27)).toMatchObject({ yakuman: 1 })
  })
  it('derives Suukantsu from four completed physical Kans', () => {
    let hand = draftFor('111m222p333s444m55p', '5p')
    for (const type of ['1m', '2p', '3s', '4m'] as const) hand = expose(hand, 'daiminkan', type)
    expect(jp(hand).components).toContainEqual({ name: '四槓子', value: 1, kind: 'yakuman' })
  })
  it('awards Tenhou/Chiihou only when the confirmed condition is supplied', () => {
    const hand = draftFor('123456m55789p234s', '4s')
    expect(scoreRiichi(hand, rules, { ...conditions, tenhou: true }, false, 27, 27).components).toContainEqual({ name: '天和', value: 1, kind: 'yakuman' })
    expect(scoreRiichi(hand, rules, { ...conditions, chiihou: true }, false, 28, 27).components).toContainEqual({ name: '地和', value: 1, kind: 'yakuman' })
    expect(jp(hand).yakuman).toBe(0)
  })
})
describe('HK orthodox exclusions and physical Kan structures', () => {
  const hk = defaultHK()
  it('counts Small/Big Three Dragons without adding their Dragon triplet Fan twice', () => {
    const small = scoreHongKong(draftFor('55566677z123m789p', 'red', 'hong-kong'), hk, conditions, 28, 27)
    expect(small.components).toContainEqual({ name: '小三元', value: 5, kind: 'fan' })
    expect(small.components.some((item) => ['白板', '發財', '紅中'].includes(item.name))).toBe(false)
    const big = scoreHongKong(draftFor('555666777z123m22p', '2p', 'hong-kong'), hk, conditions, 28, 27)
    expect(big.components).toContainEqual({ name: '大三元', value: 8, kind: 'fan' })
    expect(big.components.some((item) => ['白板', '發財', '紅中'].includes(item.name))).toBe(false)
  })
  it('does not add the included Mixed Flush again to Small Four Winds', () => {
    const result = scoreHongKong(draftFor('11122233344z123m', '3m', 'hong-kong'), hk, conditions, 28, 27)
    expect(result.rawFan).toBe(10)
    expect(result.components).toContainEqual({ name: '小四喜', value: 6, kind: 'fan' })
    expect(result.components.some((item) => item.name === '混一色')).toBe(false)
  })
  it('uses fixed-limit exclusions and optionally supports Seven Pairs', () => {
    const fixed = scoreHongKong(draftFor('11122233355566z', 'white', 'hong-kong'), hk, conditions, 28, 27)
    expect(fixed.components).toEqual([{ name: '字一色', value: 10, kind: 'fan' }])
    const pairs = draftFor('1122m3344p5566s77z', 'red', 'hong-kong')
    expect(() => scoreHongKong(pairs, hk, conditions, 28, 27)).toThrow(/七對子/)
    expect(scoreHongKong(pairs, { ...hk, scoring: { ...hk.scoring!, sevenPairs: true } }, conditions, 28, 27).components).toContainEqual({ name: '七對子（已啟用家規）', value: 3, kind: 'fan' })
  })
  it('accepts a real Kan-containing 15-physical-tile hand and excludes HK Menzen after Kan', () => {
    const hand = expose(draftFor('111m222p333s444m55p', '4m', 'hong-kong'), 'ankan', '1m')
    const result = scoreHongKong(hand, hk, conditions, 28, 27)
    expect(result.components.some((item) => item.name === '門前清')).toBe(false)
    expect(result.components).toContainEqual({ name: '對對糊', value: 3, kind: 'fan' })
  })
})
