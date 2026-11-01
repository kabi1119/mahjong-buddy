import { POSITIONS } from '../../types/mahjong'
import type { Player, PlayerPosition } from '../../types/mahjong'
import type { Settings } from '../../storage/settings'
import { activeRound, archiveRound, beginRound, emptyGameplay } from './engine'
import { createMatch, preferencesFor, syncMatch } from '../match/engine'
export function withActiveRound(settings: Settings): Settings {
  if (settings.setup?.phase !== 'playing' || !settings.setup.dealer || !POSITIONS.every((seat) => settings.players[seat])) return settings
  let data = settings.gameplay ?? emptyGameplay()
  const oldRound = activeRound(data)
  if (oldRound?.variant !== settings.variant) data = beginRound(data, settings.variant, settings.setup.dealer, settings.players as Record<PlayerPosition, Player>)
  if (!data.match) {
    const preferences = preferencesFor(settings)
    data = { ...data, match: createMatch(data, settings.variant === 'hong-kong' ? preferences.hongKong : preferences.riichi, !!oldRound) }
  } else if (data.match.phase === 'preparing') data = { ...data, match: { ...data.match, phase: 'playing' } }
  return data === settings.gameplay ? settings : { ...settings, gameplay: data }
}
export function reconcileGameplay(previous: Settings, next: Settings): Settings {
  let result = next
  const current = activeRound(next.gameplay)
  const match = next.gameplay?.match
  const preservingNext = match && ['between', 'preparing', 'end-decision'].includes(match.phase) && match.roundId === current?.id
  if (current && (next.variant !== current.variant || (!preservingNext && next.setup?.phase !== 'playing') || next.setup?.dealer !== current.dealer || !POSITIONS.every((seat) => next.players[seat]))) {
    const data = archiveRound(next.gameplay!)
    result = { ...next, gameplay: { ...data, ...(data.match ? { pastMatches: [...(data.pastMatches ?? []), data.match], match: undefined } : {}) } }
  }
  if (next.setup?.phase === 'playing' && previous.setup?.phase !== 'playing') result = withActiveRound(result)
  const round = activeRound(result.gameplay)
  if (round && JSON.stringify(round.players) !== JSON.stringify(result.players)) result = { ...result, gameplay: { ...result.gameplay!, rounds: result.gameplay!.rounds.map((item) => item.id === round.id ? { ...item, players: structuredClone(result.players) as Record<PlayerPosition, Player> } : item) } }
  if (result.gameplay) { const data = syncMatch(result.gameplay); if (data !== result.gameplay) result = { ...result, gameplay: data } }
  return result
}
