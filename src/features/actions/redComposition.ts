import type { Meld } from './models'
export function applyRedComposition(meld: Meld, count: number): Meld {
  const fives = meld.tiles.filter((tile) => /^5[mps]$/.test(tile.type))
  if (!Number.isSafeInteger(count) || count < 0 || count > fives.length) throw new Error('實體赤五數量無效。')
  if (meld.kind === 'shouminkan' && meld.originalPon?.redCount !== null && meld.originalPon?.redCount !== undefined) {
    const fourth = count - meld.originalPon.redCount
    if (![0, 1].includes(fourth)) throw new Error('加槓赤五數量與原有碰牌矛盾；請先更正原碰。')
    return { ...meld, redCount: count, tiles: [...structuredClone(meld.originalPon.tiles), { ...meld.tiles[3], red: fourth === 1 }] }
  }
  let remaining = count
  return { ...meld, redCount: count, tiles: meld.tiles.map((tile) => ({ ...tile, red: /^5[mps]$/.test(tile.type) && remaining-- > 0 })) }
}
