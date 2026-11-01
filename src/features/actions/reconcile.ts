import { POSITIONS } from '../../types/mahjong'
import type { Player, PlayerPosition } from '../../types/mahjong'
import type { Settings } from '../../storage/settings'
import { activeRound, archiveRound, beginRound, emptyGameplay } from './engine'
export function withActiveRound(settings: Settings): Settings {
  if (settings.setup?.phase !== 'playing' || !settings.setup.dealer || !POSITIONS.every((seat) => settings.players[seat])) return settings
  if (activeRound(settings.gameplay)?.variant === settings.variant) return settings
  return { ...settings, gameplay: beginRound(settings.gameplay ?? emptyGameplay(), settings.variant, settings.setup.dealer, settings.players as Record<PlayerPosition, Player>) }
}
export function reconcileGameplay(previous: Settings, next: Settings): Settings {
  let result = next
  // Setup reset/variant changes archive records, never delete actions or saved win drafts.
  const current = activeRound(next.gameplay)
  if (current && (next.variant !== current.variant || next.setup?.phase !== 'playing' || next.setup.dealer !== current.dealer || !POSITIONS.every((seat) => next.players[seat]))) result = { ...next, gameplay: archiveRound(next.gameplay!) }
  if (next.setup?.phase === 'playing' && previous.setup?.phase !== 'playing') result = withActiveRound(result)
  const round = activeRound(result.gameplay)
  if (round && JSON.stringify(round.players) !== JSON.stringify(result.players)) result = { ...result, gameplay: { ...result.gameplay!, rounds: result.gameplay!.rounds.map((item) => item.id === round.id ? { ...item, players: structuredClone(result.players) as Record<PlayerPosition, Player> } : item) } }
  return result
}
