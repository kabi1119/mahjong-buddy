import type { HandDraft } from '../actions/models'
import type { JapaneseRiichiRules } from '../match/rules'
import { getDoraFromIndicator } from '../hands/tiles'
import { countsOf, enumerateHands, concealedTriplets, honor, outside, suitOf, terminal, tileIndex } from './shape'
import type { Interpretation } from './shape'
import { defaultRiichiScoreRules } from './models'
import type { FuComponent, RiichiScoreRules, ScoreComponent, WinConditions } from './models'
export interface HandValue { bonuses: { dora: number; kanDora: number; ura: number; kanUra: number; redDora: number }; components: ScoreComponent[]; fuBreakdown: FuComponent[]; han: number; fu: number; yakuman: number; basePoints: number; label: string; tier: number; interpretation: string }
export function riichiLimit(han: number, fu: number, yakuman: number, rules: RiichiScoreRules) {
  if (yakuman) return { basePoints: 8000 * yakuman, label: yakuman === 1 ? '役滿' : ['雙倍役滿', '三倍役滿', '四倍役滿'][yakuman - 2] ?? `${yakuman} 倍役滿`, tier: Math.min(8, 4 + yakuman) }
  if (han >= 13) {
    if (rules.kazoe === 'sanbaiman') return { basePoints: 6000, label: '三倍滿（累計上限）', tier: 4 }
    const multiple = rules.kazoe === 'uncapped' ? Math.floor(han / 13) : 1
    const label = ['累計役滿', '累計雙倍役滿', '累計三倍役滿', '累計四倍役滿'][multiple - 1] ?? '累計' + multiple + ' 倍役滿'
    return { basePoints: 8000 * multiple, label, tier: Math.min(8, 4 + multiple) }
  }
  if (han >= 11) return { basePoints: 6000, label: '三倍滿', tier: 4 }
  if (han >= 8) return { basePoints: 4000, label: '倍滿', tier: 3 }
  if (han >= 6) return { basePoints: 3000, label: '跳滿', tier: 2 }
  const base = fu * 2 ** (han + 2)
  if (han >= 5 || base >= 2000 || (rules.kiriage && base === 1920)) return { basePoints: 2000, label: '滿貫', tier: 1 }
  return { basePoints: base, label: `${han} 飜 ${fu} 符`, tier: 0 }
}
export function pairFu(pair: number, seatWind: number, roundWind: number, rules: RiichiScoreRules): number {
  if (pair >= 31) return 2
  if (pair === seatWind && pair === roundWind) return rules.doubleWindPair
  return pair === seatWind || pair === roundWind ? 2 : 0
}
export function calculateFu(shape: Interpretation, method: 'ron' | 'tsumo', menzen: boolean, pinfu: boolean, seatWind: number, roundWind: number, rules: RiichiScoreRules): { fu: number; breakdown: FuComponent[] } {
  if (shape.kind === 'seven-pairs') return { fu: 25, breakdown: [{ name: '七對子固定', value: 25 }] }
  if (shape.kind === 'orphans') return { fu: 0, breakdown: [] }
  if (pinfu && method === 'tsumo') return { fu: 20, breakdown: [{ name: '平和自摸固定', value: 20 }] }
  const breakdown: FuComponent[] = [{ name: '副底', value: 20 }]
  if (menzen && method === 'ron') breakdown.push({ name: '門前榮和', value: 10 })
  if (method === 'tsumo') breakdown.push({ name: '自摸', value: 2 })
  const pair = pairFu(shape.pair, seatWind, roundWind, rules)
  if (pair) breakdown.push({ name: '役牌雀頭', value: pair })
  if (['kanchan', 'penchan', 'tanki'].includes(shape.wait)) breakdown.push({ name: ({ kanchan: '嵌張', penchan: '邊張', tanki: '單騎' } as Record<string, string>)[shape.wait], value: 2 })
  shape.groups.forEach((group, index) => {
    if (group.type === 'sequence') return
    const open = group.open || (method === 'ron' && shape.winningGroup === index)
    const value = (group.type === 'kan' ? open ? 8 : 16 : open ? 2 : 4) * (outside(group.tile) ? 2 : 1)
    breakdown.push({ name: `${open ? '明' : '暗'}${group.type === 'kan' ? '槓' : '刻'} · ${outside(group.tile) ? '幺九／字牌' : '中張'}`, value })
  })
  const raw = breakdown.reduce((total, item) => total + item.value, 0)
  const fu = raw === 20 ? 30 : Math.ceil(raw / 10) * 10
  if (fu > raw) breakdown.push({ name: raw === 20 ? '副露平和形最低' : '進位至十符', value: fu - raw })
  return { fu, breakdown }
}
export function scoreRiichi(draft: HandDraft, rules: JapaneseRiichiRules, conditions: WinConditions, riichi: boolean, seatWind: number, roundWind: number): HandValue {
  const profile = rules.scoring ?? defaultRiichiScoreRules()
  const types = [...draft.concealed, ...(draft.winningTile ? [draft.winningTile] : [])].map((tile) => tile.type)
  const physical = [...draft.concealed, ...draft.melds.flatMap((meld) => meld.tiles), ...(draft.winningTile ? [draft.winningTile] : [])]
  const indices = physical.map((tile) => tileIndex(tile.type)); const counts = countsOf(physical.map((tile) => tile.type))
  const win = draft.winningTile ? tileIndex(draft.winningTile.type) : -1
  const menzen = draft.melds.every((meld) => !meld.open)
  const shapes = draft.winningTile ? enumerateHands(types, draft.melds, draft.winningTile.type) : []
  if (!shapes.length) throw new Error('牌型並非完整四組一對、七對子或國士無雙。')
  const bonuses = { dora: 0, kanDora: 0, ura: 0, kanUra: 0, redDora: physical.filter((tile) => tile.red).length }
  for (const kind of ['dora', 'ura'] as const) {
    if (kind === 'ura' && !(riichi && menzen)) continue
    draft.indicators.filter((entry) => entry.kind === kind).forEach((entry, index) => {
      const key = kind === 'dora' ? index === 0 ? 'dora' : 'kanDora' : index === 0 ? 'ura' : 'kanUra'
      bonuses[key] += physical.filter((tile) => tile.type === getDoraFromIndicator(entry.tile.type)).length
    })
  }
  const candidates: HandValue[] = []
  for (const shape of shapes) {
    const components: ScoreComponent[] = []
    const add = (name: string, value: number, kind: ScoreComponent['kind'] = 'yaku') => components.push({ name, value, kind })
    const yakuman = (name: string, double = false) => add(name, profile.doubleYakuman && double ? 2 : 1, 'yakuman')
    const trips = shape.groups.filter((group) => group.type !== 'sequence')
    const sequences = shape.groups.filter((group) => group.type === 'sequence')
    const dragonTrips = trips.filter((group) => group.tile >= 31).length
    const windTrips = trips.filter((group) => group.tile >= 27 && group.tile <= 30).length
    const kans = trips.filter((group) => group.type === 'kan').length
    const concealed = concealedTriplets(shape, draft.win.method).length
    const suits = new Set(indices.filter((index) => !honor(index)).map(suitOf)); const hasHonors = indices.some(honor)
    if (shape.kind === 'orphans') yakuman('國士無雙', counts[win] === 2)
    if (concealed === 4) yakuman('四暗刻', shape.wait === 'tanki')
    if (dragonTrips === 3) yakuman('大三元')
    if (windTrips === 4) yakuman('大四喜', true)
    else if (windTrips === 3 && shape.pair >= 27 && shape.pair <= 30) yakuman('小四喜')
    if (kans === 4) yakuman('四槓子')
    if (indices.every(honor)) yakuman('字一色')
    if (indices.every(terminal)) yakuman('清老頭')
    if (indices.every((index) => [19, 20, 21, 23, 25, 32].includes(index))) yakuman('綠一色')
    if (menzen && !draft.melds.length && suits.size === 1 && !hasHonors) {
      const offset = [...suits][0] * 9; const base = [3, 1, 1, 1, 1, 1, 1, 1, 3]
      if (base.every((count, index) => counts[offset + index] >= count)) {
        const pure = base.every((count, index) => counts[offset + index] - (win === offset + index ? 1 : 0) === count)
        yakuman('九蓮寶燈', pure)
      }
    }
    if (conditions.tenhou) yakuman('天和')
    if (conditions.chiihou) yakuman('地和')
    if (components.length) {
      const count = profile.stackYakuman ? components.reduce((total, item) => total + item.value, 0) : Math.max(...components.map((item) => item.value))
      candidates.push({ bonuses, components, fuBreakdown: [], han: 0, fu: 0, yakuman: count, ...riichiLimit(0, 0, count, profile), interpretation: shape.key }); continue
    }
    if (shape.kind === 'orphans') continue
    if (riichi && menzen) add(conditions.doubleRiichi ? '雙立直' : '立直', conditions.doubleRiichi ? 2 : 1)
    if (conditions.ippatsu && riichi && menzen) add('一發', 1)
    if (draft.win.method === 'tsumo' && menzen) add('門前清自摸和', 1)
    const pinfu = menzen && sequences.length === 4 && pairFu(shape.pair, seatWind, roundWind, profile) === 0 && shape.wait === 'ryanmen'
    if (pinfu) add('平和', 1)
    if (indices.every((tile) => !outside(tile)) && (menzen || profile.openTanyao)) add('斷幺九', 1)
    if (menzen && sequences.length) {
      const starts = new Map<number, number>(); for (const group of sequences) starts.set(group.tile, (starts.get(group.tile) ?? 0) + 1)
      const pairs = [...starts.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0)
      if (pairs >= 2) add('二盃口', 3); else if (pairs === 1) add('一盃口', 1)
    }
    for (const group of trips) {
      if (group.tile >= 31) add(['白', '發', '中'][group.tile - 31], 1)
      if (group.tile === seatWind) add('自風牌', 1)
      if (group.tile === roundWind) add('場風牌', 1)
    }
    if (conditions.chankan) add('搶槓', 1)
    if (conditions.rinshan) add('嶺上開花', 1)
    if (conditions.haitei) add('海底摸月', 1)
    if (conditions.houtei) add('河底撈魚', 1)
    if (shape.kind === 'seven-pairs') add('七對子', 2)
    const starts = sequences.map((group) => group.tile)
    if ([0, 9, 18].some((offset) => [0, 3, 6].every((rank) => starts.includes(offset + rank)))) add('一氣通貫', menzen ? 2 : 1)
    if (Array.from({ length: 7 }, (_, rank) => rank).some((rank) => [0, 9, 18].every((offset) => starts.includes(offset + rank)))) add('三色同順', menzen ? 2 : 1)
    if (Array.from({ length: 9 }, (_, rank) => rank).some((rank) => [0, 9, 18].every((offset) => trips.some((group) => group.tile === offset + rank)))) add('三色同刻', 2)
    if (trips.length === 4) add('對對和', 2)
    if (concealed >= 3) add('三暗刻', 2)
    if (kans === 3) add('三槓子', 2)
    if (indices.every(outside)) add('混老頭', 2)
    if (dragonTrips === 2 && shape.pair >= 31) add('小三元', 2)
    const outsideGroups = shape.kind === 'standard' && outside(shape.pair) && shape.groups.every((group) => group.type === 'sequence' ? terminal(group.tile) || group.tile % 9 === 6 : outside(group.tile))
    if (outsideGroups && sequences.length) add(hasHonors ? '混全帶幺九' : '純全帶幺九', hasHonors ? menzen ? 2 : 1 : menzen ? 3 : 2)
    if (suits.size === 1) add(hasHonors ? '混一色' : '清一色', hasHonors ? menzen ? 3 : 2 : menzen ? 6 : 5)
    if (!components.length) continue // Dora never establishes a Yaku.
    for (const kind of ['dora', 'ura'] as const) {
      if (kind === 'ura' && !(riichi && menzen)) continue
      const indicators = draft.indicators.filter((item) => item.kind === kind)
      indicators.forEach((indicator, index) => {
        const bonus = physical.filter((tile) => tile.type === getDoraFromIndicator(indicator.tile.type)).length
        if (bonus) add(kind === 'dora' ? index === 0 ? '寶牌' : '槓寶牌' : index === 0 ? '裏寶牌' : '槓裏寶牌', bonus, 'bonus')
      })
    }
    const reds = physical.filter((tile) => tile.red).length
    if (reds) add('赤寶牌', reds, 'bonus')
    const han = components.reduce((sum, item) => sum + item.value, 0)
    const fu = calculateFu(shape, draft.win.method, menzen, pinfu, seatWind, roundWind, profile)
    candidates.push({ bonuses, components, fuBreakdown: fu.breakdown, han, fu: fu.fu, yakuman: 0, ...riichiLimit(han, fu.fu, 0, profile), interpretation: shape.key })
  }
  if (!candidates.length) throw new Error('沒有可成立的役；寶牌不可代替役。')
  // Base points determine both Ron and Tsumo payable amounts; use Han/Fu only as tie-breakers.
  return candidates.sort((a, b) => b.basePoints - a.basePoints || b.han - a.han || b.fu - a.fu)[0]
}
