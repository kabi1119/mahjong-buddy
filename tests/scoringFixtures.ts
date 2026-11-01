import type { HandDraft, GameplayData } from '../src/features/actions/models'
import type { TileType } from '../src/features/hands/tiles'
import { HONORS, tileInstance } from '../src/features/hands/tiles'
import { createDraft } from '../src/features/hands/drafts'
import { createMatch } from '../src/features/match/engine'
import { defaultHK, defaultRiichi } from '../src/features/match/rules'
import { emptyConditions } from '../src/features/scoring/models'
import { syncRoundIndicators, updateIndicator } from '../src/features/scoring/indicators'
import { newGame } from './handFixtures'
export function parseTiles(notation: string): TileType[] {
  return [...notation.matchAll(/([1-9]+)([mpsz])/g)].flatMap((match) => [...match[1]].map((digit) => match[2] === 'z' ? HONORS[Number(digit) - 1] : `${digit}${match[2]}` as TileType))
}
export function draftFor(notation: string, win: TileType, variant: 'riichi' | 'hong-kong' = 'riichi'): HandDraft {
  const data = newGame(variant); const tiles = parseTiles(notation).map((type) => tileInstance(type)); const index = tiles.map((tile) => tile.type).lastIndexOf(win)
  if (index < 0) throw Error('Fixture winning tile absent')
  const winningTile = tiles.splice(index, 1)[0]
  return { ...createDraft(data, 'round-a', 'right'), concealed: tiles, winningTile, reviewedMelds: true, win: { method: 'ron', sourcePlayer: 'bottom', specialFlower: false } }
}
export const reviewedConditions = () => ({ ...emptyConditions(), reviewed: true, legalWinConfirmed: true, singleWinner: true, noResponsibility: true })
export function scoringGame(variant: 'riichi' | 'hong-kong' = 'riichi'): GameplayData {
  let data = newGame(variant); data = { ...data, match: createMatch(data, variant === 'riichi' ? defaultRiichi() : defaultHK(), false) }
  if (variant === 'riichi') { data = syncRoundIndicators(data); data = updateIndicator(data, 'initial:round-a', 'effective', 'west') }
  return data
}
