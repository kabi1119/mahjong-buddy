import type { PlayerPosition } from '../../types/mahjong'
import { getNextPlayer } from '../game/rules'
import { sequenceFrom } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
export function precedingPlayer(player: PlayerPosition): PlayerPosition { return getNextPlayer(getNextPlayer(getNextPlayer(player))) }
export function getChiOptions(discarded: TileType): TileType[][] {
  if (!/^[1-9][mps]$/.test(discarded)) return []
  const rank = Number(discarded[0]); const suit = discarded[1]
  return Array.from({ length: 3 }, (_, index) => rank - 2 + index).filter((start) => start >= 1 && start <= 7).map((start) => sequenceFrom(`${start}${suit}` as TileType))
}
