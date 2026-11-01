import type { HandDraft } from '../actions/models'
import type { HongKongRules } from '../match/rules'
import type { ScoreComponent, WinConditions } from './models'
import { defaultHKScoreRules } from './models'
import { concealedTriplets, countsOf, enumerateHands, honor, outside, suitOf, terminal, tileIndex } from './shape'
const flowerGroups = [['spring', 'summer', 'autumn', 'winter'], ['plum', 'orchid', 'chrysanthemum', 'bamboo']]
export function scoreHongKong(draft: HandDraft, rules: HongKongRules, conditions: WinConditions, seatWind: number, roundWind: number) {
  const profile = rules.scoring ?? defaultHKScoreRules()
  const component = (name: string, value: number): ScoreComponent => ({ name, value, kind: 'fan' })
  function finish(components: ScoreComponent[], interpretation: string) {
    const rawFan = components.reduce((total, item) => total + item.value, 0)
    const fan = Math.min(rules.fanCap, rawFan)
    if (fan < rules.minimumFan) throw new Error(`只有 ${fan} 番，未達 ${rules.minimumFan} 番起糊。`)
    return { components, rawFan, fan, interpretation, label: `${fan} 番${rawFan > fan ? '（封頂）' : ''}` }
  }
  if (draft.win.specialFlower) {
    if (draft.win.method !== 'tsumo' || ![7, 8].includes(draft.flowers.length) || new Set(draft.flowers).size !== draft.flowers.length) throw new Error('花糊需要七／八張不同花牌及自摸確認。')
    return finish(draft.flowers.length === 7 ? [component('七花即食', 2), component('自摸', 1)] : [component('大花糊（八花即食）', 8)], 'instant-flowers')
  }
  if (!draft.winningTile) throw new Error('請指定和牌張。')
  const physical = [...draft.concealed, ...draft.melds.flatMap((meld) => meld.tiles), draft.winningTile]
  const indices = physical.map((tile) => tileIndex(tile.type)); const counts = countsOf(physical.map((tile) => tile.type))
  const shapes = enumerateHands([...draft.concealed, draft.winningTile].map((tile) => tile.type), draft.melds, draft.winningTile.type)
  if (!shapes.length) throw new Error('不是完整四組一對或十三幺牌型。')
  const options: ReturnType<typeof finish>[] = []
  for (const shape of shapes) {
    if (shape.kind === 'seven-pairs' && !profile.sevenPairs) continue
    const items: ScoreComponent[] = []; const add = (name: string, value: number) => items.push(component(name, value))
    const trips = shape.groups.filter((group) => group.type !== 'sequence'); const seqs = shape.groups.filter((group) => group.type === 'sequence')
    const dragonTrips = trips.filter((group) => group.tile >= 31).length
    const windTrips = trips.filter((group) => group.tile >= 27 && group.tile < 31).length
    const kans = trips.filter((group) => group.type === 'kan').length
    const suits = new Set(indices.filter((index) => !honor(index)).map(suitOf)); const hasHonors = indices.some(honor)
    let limit: { name: string; value: number } | undefined
    if (shape.kind === 'orphans') limit = { name: '十三幺', value: 13 }
    else if (windTrips === 4) limit = { name: '大四喜', value: 13 }
    else if (kans === 4) limit = { name: '十八羅漢', value: 13 }
    else if (conditions.hkHeaven) limit = { name: '天糊', value: 13 }
    else if (conditions.hkEarth) limit = { name: '地糊', value: 13 }
    else if (conditions.hkHuman) limit = { name: '人糊', value: 13 }
    else if (indices.every(honor)) limit = { name: '字一色', value: 10 }
    else if (indices.every(terminal)) limit = { name: '清幺九', value: 10 }
    else if (!draft.melds.length && suits.size === 1 && !hasHonors) {
      const offset = [...suits][0] * 9
      if ([3, 1, 1, 1, 1, 1, 1, 1, 3].every((count, index) => counts[offset + index] >= count)) limit = { name: '九蓮寶燈', value: 10 }
    }
    if (limit) { options.push(finish([component(limit.name, limit.value)], shape.key)); continue }
    const kankan = !draft.melds.length && concealedTriplets(shape, draft.win.method).length === 4
    const allOutside = indices.every(outside)
    const smallWinds = windTrips === 3 && shape.pair >= 27 && shape.pair < 31
    if (kankan) add('坎坎糊', profile.kankan === 'cap' ? rules.fanCap : profile.kankan)
    else if (allOutside && trips.length === 4) add('花幺九', 4)
    else if (trips.length === 4) add('對對糊', 3)
    if (seqs.length === 4) add('平糊', 1)
    if (shape.kind === 'seven-pairs') add('七對子（已啟用家規）', 3)
    if (!draft.melds.length && !kankan) add('門前清', 1)
    if (draft.win.method === 'tsumo') add('自摸', 1)
    if (suits.size === 1 && !smallWinds) add(hasHonors ? '混一色' : '清一色', hasHonors ? 3 : 7)
    if (dragonTrips === 3) add('大三元', 8)
    else if (dragonTrips === 2 && shape.pair >= 31) add('小三元', 5)
    else for (const group of trips.filter((item) => item.tile >= 31)) add(['白板', '發財', '紅中'][group.tile - 31], 1)
    if (smallWinds) add('小四喜', 6)
    for (const group of trips) {
      if (group.tile === seatWind) add('門風刻／槓', 1)
      if (group.tile === roundWind) add('圈風刻／槓', 1)
    }
    if (!draft.flowers.length) add('無花', 1)
    for (const flowers of flowerGroups) {
      if (flowers.every((flower) => draft.flowers.includes(flower as typeof draft.flowers[number]))) add('一檯花', 2)
      else if (draft.flowers.includes(flowers[seatWind - 27] as typeof draft.flowers[number])) add('正花', 1)
    }
    if (conditions.chankan) add('搶槓', 1)
    if (conditions.consecutiveKan) add('連槓開花', 8)
    else if (conditions.rinshan) add('槓上開花', 1)
    if (conditions.haitei || conditions.houtei) add('海底撈月', 1)
    try { options.push(finish(items, shape.key)) } catch { /* Another decomposition may meet the minimum. */ }
  }
  if (!options.length) throw new Error(`此牌未達 ${rules.minimumFan} 番，或七對子未在港式家規啟用。`)
  return options.sort((a, b) => b.fan - a.fan || b.rawFan - a.rawFan)[0]
}
export function hkMultiplier(fan: number, payment: HongKongRules['payment']): number {
  if (!Number.isInteger(fan) || fan < 0 || fan > 13) throw new Error('無效番數。')
  if (payment === 'custom') throw new Error('自訂付款須使用明確金額表。')
  if (payment === 'full-la' || fan <= 4) return 2 ** fan
  return fan % 2 === 0 ? 2 ** (fan / 2 + 2) : 3 * 2 ** ((fan - 1) / 2 + 1)
}
