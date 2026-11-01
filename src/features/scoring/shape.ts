import { TILE_CATALOG } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
import type { Meld } from '../actions/models'
export interface Group { type: 'sequence' | 'triplet' | 'kan'; tile: number; open: boolean; fixed: boolean }
export interface Interpretation { kind: 'standard' | 'seven-pairs' | 'orphans'; pair: number; groups: Group[]; winningGroup: number; wait: 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon'; key: string }
export const tileIndex = (type: TileType): number => TILE_CATALOG.indexOf(type)
export const honor = (tile: number) => tile >= 27
export const terminal = (tile: number) => tile < 27 && (tile % 9 === 0 || tile % 9 === 8)
export const outside = (tile: number) => honor(tile) || terminal(tile)
export const suitOf = (tile: number) => tile < 27 ? Math.floor(tile / 9) : -1
export function countsOf(tiles: readonly TileType[]): number[] {
  const counts = Array<number>(34).fill(0)
  for (const tile of tiles) { const index = tileIndex(tile); if (index < 0) throw new Error('未知牌種。'); counts[index]++ }
  return counts
}
export function enumerateHands(concealed: readonly TileType[], melds: readonly Meld[], winningTile: TileType): Interpretation[] {
  const counts = countsOf(concealed); const win = tileIndex(winningTile)
  if (win < 0 || !counts[win] || melds.length > 4 || concealed.length !== 14 - melds.length * 3 || counts.some((count) => count > 4)) return []
  const result: Interpretation[] = []
  if (!melds.length && counts.filter((count) => count === 2).length === 7 && counts.every((count) => count === 0 || count === 2)) result.push({ kind: 'seven-pairs', pair: -1, groups: [], winningGroup: -1, wait: 'tanki', key: 'seven-pairs' })
  const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
  if (!melds.length && orphans.every((tile) => counts[tile] >= 1) && counts.every((count, index) => orphans.includes(index) || count === 0) && orphans.filter((tile) => counts[tile] === 2).length === 1) result.push({ kind: 'orphans', pair: orphans.find((tile) => counts[tile] === 2)!, groups: [], winningGroup: -1, wait: 'tanki', key: 'orphans' })
  const fixed: Group[] = melds.map((meld) => ({ type: meld.kind === 'chi' ? 'sequence' : meld.tiles.length === 4 ? 'kan' : 'triplet', tile: tileIndex(meld.tile), open: meld.open, fixed: true }))
  const need = 4 - fixed.length
  function split(groups: Group[], pair: number) {
    const first = counts.findIndex((count) => count > 0)
    if (first < 0) {
      if (groups.length !== need) return
      const all = [...fixed, ...groups]
      const targets = [{ index: -1, wait: 'tanki' as const, eligible: pair === win }, ...all.map((group, index) => {
        const offset = win - group.tile
        const eligible = !group.fixed && (group.type === 'sequence' ? offset >= 0 && offset < 3 && suitOf(win) === suitOf(group.tile) : win === group.tile)
        const wait: Interpretation['wait'] = group.type !== 'sequence' ? 'shanpon' : offset === 1 ? 'kanchan' : (group.tile % 9 === 0 && offset === 2) || (group.tile % 9 === 6 && offset === 0) ? 'penchan' : 'ryanmen'
        return { index, wait, eligible }
      })]
      for (const target of targets.filter((item) => item.eligible)) result.push({ kind: 'standard', pair, groups: all.map((group) => ({ ...group })), winningGroup: target.index, wait: target.wait, key: JSON.stringify([pair, all, target.index, target.wait]) })
      return
    }
    if (groups.length >= need) return
    if (counts[first] >= 3) { counts[first] -= 3; split([...groups, { type: 'triplet', tile: first, open: false, fixed: false }], pair); counts[first] += 3 }
    if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) { counts[first]--; counts[first + 1]--; counts[first + 2]--; split([...groups, { type: 'sequence', tile: first, open: false, fixed: false }], pair); counts[first]++; counts[first + 1]++; counts[first + 2]++ }
  }
  for (let pair = 0; pair < 34; pair++) if (counts[pair] >= 2) { counts[pair] -= 2; split([], pair); counts[pair] += 2 }
  return [...new Map(result.map((item) => [item.key, item])).values()]
}
export function concealedTriplets(shape: Interpretation, method: 'ron' | 'tsumo'): Group[] {
  return shape.groups.filter((group, index) => group.type !== 'sequence' && !group.open && !(method === 'ron' && index === shape.winningGroup))
}
