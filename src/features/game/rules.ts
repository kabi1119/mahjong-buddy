import { POSITIONS } from '../../types/mahjong'
import type { MahjongVariant, PlayerPosition } from '../../types/mahjong'

export const WINDS = ['東', '南', '西', '北'] as const
export type SeatWind = (typeof WINDS)[number]
export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6
export type DiceCount = 2 | 3
export type RandomSource = () => number // Independent unsigned 32-bit samples.
export interface WallStack { wall: PlayerPosition; index: number } // zero-based, from owner's RIGHT
export interface WallBreak {
  wall: PlayerPosition
  total: number
  stacksPerWall: 17 | 18
  counted: WallStack
  firstLive: WallStack
  replacementEnd: WallStack
  deadWall: WallStack[] // nearest break first, backwards against normal drawing
  dora: WallStack | null
}

function offset(position: PlayerPosition, steps: number): PlayerPosition {
  return POSITIONS[((POSITIONS.indexOf(position) + steps) % 4 + 4) % 4]
}

export function getNextPlayer(position: PlayerPosition): PlayerPosition {
  return offset(position, -1)
}

export function assignSeatWinds(dealer: PlayerPosition): Record<PlayerPosition, SeatWind> {
  return Object.fromEntries(WINDS.map((wind, index) => [offset(dealer, -index), wind])) as Record<PlayerPosition, SeatWind>
}

export function getSelectedWall(dealer: PlayerPosition, total: number): PlayerPosition {
  if (!Number.isInteger(total) || total < 2 || total > 18) throw new RangeError('Invalid dice total')
  return offset(dealer, -(total - 1) % 4)
}

export function nextWallStack(stack: WallStack, length: number, steps = 1): WallStack {
  const size = length * 4
  const index = ((POSITIONS.indexOf(stack.wall) * length + stack.index + steps) % size + size) % size
  return { wall: POSITIONS[Math.floor(index / length)], index: index % length }
}

export function calculateWallBreak(variant: MahjongVariant, total: number, dealer: PlayerPosition): WallBreak {
  if (variant === 'riichi' && total > 12) throw new RangeError('Riichi uses two dice')
  const wall = getSelectedWall(dealer, total)
  const stacksPerWall = variant === 'riichi' ? 17 : 18
  const counted = { wall, index: total - 1 }
  const firstLive = nextWallStack(counted, stacksPerWall)
  const deadWall = variant === 'riichi'
    ? Array.from({ length: 7 }, (_, index) => nextWallStack(firstLive, stacksPerWall, -index - 1)) : []
  return { wall, total, stacksPerWall, counted, firstLive, replacementEnd: counted,
    deadWall, dora: deadWall[2] ?? null }
}

export const RIGHT_END_GUIDE: Record<PlayerPosition, { start: string; direction: string; arrow: string }> = {
  top: { start: '畫面左端', direction: '向右 →', arrow: '→' },
  right: { start: '畫面上端', direction: '向下 ↓', arrow: '↓' },
  bottom: { start: '畫面右端', direction: '向左 ←', arrow: '←' },
  left: { start: '畫面下端', direction: '向上 ↑', arrow: '↑' },
}

// Shared by the diagram and orientation tests. Never rotate nickname text.
export function wallStackPoint(stack: WallStack, length: number): { x: number; y: number } {
  const progress = (stack.index + .5) / length * 210
  switch (stack.wall) {
    case 'top': return { x: 55 + progress, y: 52 }
    case 'right': return { x: 268, y: 55 + progress }
    case 'bottom': return { x: 265 - progress, y: 268 }
    case 'left': return { x: 52, y: 265 - progress }
  }
}

export const secureRandom: RandomSource = () => crypto.getRandomValues(new Uint32Array(1))[0]

export function randomIndex(size: number, source: RandomSource = secureRandom): number {
  if (!Number.isInteger(size) || size < 1 || size > 0x100000000) throw new RangeError('Invalid random range')
  const limit = Math.floor(0x100000000 / size) * size
  for (let attempts = 0; attempts < 1024; attempts++) {
    const sample = source()
    if (!Number.isInteger(sample) || sample < 0 || sample >= 0x100000000) throw new RangeError('Invalid random sample')
    if (sample < limit) return sample % size
  }
  throw new Error('Random source failed rejection sampling')
}

export function generateDiceResults(count: DiceCount, source: RandomSource = secureRandom): DiceValue[] {
  if (count !== 2 && count !== 3) throw new RangeError('Use two or three dice')
  return Array.from({ length: count }, () => (randomIndex(6, source) + 1) as DiceValue)
}
