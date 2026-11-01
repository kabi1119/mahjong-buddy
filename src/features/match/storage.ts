import { POSITIONS } from '../../types/mahjong'
import { validateRules } from './rules'
import type { MatchState, MatchCursor, Points } from './models'
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const pointMap = (value: unknown): value is Points => object(value) && POSITIONS.every((seat) => Number.isSafeInteger(value[seat]))
function cursor(value: unknown): value is MatchCursor {
  if (!object(value)) return false
  return POSITIONS.includes(value.dealer as 'top') && Number.isInteger(value.roundWind) && Number(value.roundWind) >= 0 && Number.isInteger(value.kyoku) && Number(value.kyoku) >= 1 && Number(value.kyoku) <= 4 && Number.isSafeInteger(value.sequence) && Number(value.sequence) >= 1 && Number.isSafeInteger(value.honba) && Number(value.honba) >= 0 && pointMap(value.points) && Number.isSafeInteger(value.pool) && Number(value.pool) >= 0 && Number(value.pool) % 1000 === 0 && ['playing', 'between', 'preparing', 'end-decision', 'ended'].includes(String(value.phase)) && typeof value.roundId === 'string' && typeof value.winPending === 'boolean'
}
export function decodeMatch(value: unknown, roundIds: Set<string>): MatchState | undefined {
  if (value === undefined) return undefined
  const match = value as MatchState
  if (!object(value) || match.version !== 1 || !cursor(match) || typeof match.id !== 'string' || !POSITIONS.includes(match.initialDealer) || !['hong-kong', 'riichi'].includes(match.variant) || !match.rules || match.rules.variant !== match.variant || validateRules(match.rules).length || !roundIds.has(match.roundId) || typeof match.legacyUnreconciled !== 'boolean' || !Array.isArray(match.legacyActionIds) || !match.legacyActionIds.every((id) => typeof id === 'string') || !Array.isArray(match.history) || !Array.isArray(match.ledger)) throw new Error('未知或損壞的牌局／帳本版本，保留原資料。')
  for (const outcome of match.history) if (!outcome || typeof outcome.id !== 'string' || !roundIds.has(outcome.roundId) || !['exhaustive-draw', 'four-kan-abortive-draw'].includes(outcome.type) || !cursor(outcome.before) || !cursor(outcome.after) || !pointMap(outcome.deltas) || Object.values(outcome.deltas).reduce((a, b) => a + b, 0) !== 0 || typeof outcome.undone !== 'boolean' || !outcome.setupBefore || outcome.setupBefore.version !== 1 || !roundIds.has(outcome.before.roundId) || !roundIds.has(outcome.after.roundId) || !Number.isFinite(outcome.timestamp)) throw new Error('流局歷史資料無效。')
  for (const entry of match.ledger) if (!entry || typeof entry.id !== 'string' || !roundIds.has(entry.roundId) || !['riichi', 'noten'].includes(entry.kind) || !['active', 'reversed'].includes(entry.status) || !pointMap(entry.deltas) || !Number.isSafeInteger(entry.poolDelta) || Object.values(entry.deltas).reduce((a, b) => a + b, 0) + entry.poolDelta !== 0) throw new Error('點數帳本資料無效。')
  if (new Set(match.ledger.map((entry) => entry.id)).size !== match.ledger.length || new Set(match.history.map((entry) => entry.id)).size !== match.history.length) throw new Error('重複帳本／歷史識別碼。')
  if (match.pendingFourKan && (match.pendingFourKan.roundId !== match.roundId || typeof match.pendingFourKan.signature !== 'string' || !['pending', 'deferred', 'win-pending'].includes(match.pendingFourKan.status))) throw new Error('四槓待確認資料無效。')
  return structuredClone(match)
}
