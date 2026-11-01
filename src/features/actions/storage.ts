import { POSITIONS } from '../../types/mahjong'
import { FLOWERS, isTileType } from '../hands/tiles'
import type { GameplayData } from './models'
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const position = (value: unknown) => POSITIONS.some((item) => item === value)
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const nullablePosition = (value: unknown) => value === null || position(value)
const list = (value: unknown, check: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every((item) => check(item))
const tile = (value: unknown): boolean => object(value) && text(value.id) && isTileType(value.type) && typeof value.red === 'boolean' && (!value.red || /^5[mps]$/.test(value.type))
function meld(value: unknown, nested = false): boolean {
  if (!object(value) || !text(value.id) || !text(value.roundId) || !position(value.playerId) || !['chi', 'pon', 'ankan', 'daiminkan', 'shouminkan'].includes(String(value.kind)) || !isTileType(value.tile) || !list(value.tiles, tile) || typeof value.open !== 'boolean' || !nullablePosition(value.sourcePlayer) || !integer(value.order) || !['active', 'removed'].includes(String(value.status)) || !text(value.actionId) || !(value.redCount === null || (integer(value.redCount) && Number(value.redCount) <= 4))) return false
  return value.originalPon === undefined || (!nested && meld(value.originalPon, true))
}
function action(value: unknown): boolean {
  if (!object(value) || !text(value.id) || !text(value.roundId) || !position(value.playerId) || !integer(value.order) || !integer(value.revision) || !['active', 'undone'].includes(String(value.status))) return false
  if (value.kind === 'riichi') return typeof value.confirmed === 'boolean'
  if (!isTileType(value.tile) || !text(value.meldId) || !['completed', 'robbed'].includes(String(value.kanStatus))) return false
  if (value.kind === 'shouminkan') return text(value.targetMeldId) && typeof value.physicalConfirmed === 'boolean'
  return ['chi', 'pon', 'ankan', 'daiminkan'].includes(String(value.kind)) && nullablePosition(value.sourcePlayer) && typeof value.riichiAnkanConfirmed === 'boolean'
}
export function decodeGameplay(value: unknown): GameplayData | undefined {
  if (value === undefined) return undefined
  // Fail closed instead of dropping unread win drafts or a future schema on the next save.
  if (!object(value) || value.version !== 1 || !nullableId(value.activeRoundId)) throw new Error('無法讀取動作／食糊草稿資料版本。')
  const roundsValid = list(value.rounds, (round) => object(round) && text(round.id) && ['hong-kong', 'riichi'].includes(String(round.variant)) && position(round.dealer) && integer(round.createdAt) && ['active', 'archived'].includes(String(round.status)) && object(round.players) && POSITIONS.every((seat) => { const p = (round.players as Record<string, unknown>)[seat]; return object(p) && p.position === seat && text(p.nickname) && text(p.avatar) }))
  const draftsValid = list(value.drafts, (draft) => {
    if (!object(draft) || draft.version !== 1 || !text(draft.id) || !text(draft.roundId) || !['hong-kong', 'riichi'].includes(String(draft.variant)) || !position(draft.winner) || !['draft', 'confirmed'].includes(String(draft.status)) || !integer(draft.createdAt) || !integer(draft.updatedAt)) return false
    return object(draft.win) && ['tsumo', 'ron'].includes(String(draft.win.method)) && nullablePosition(draft.win.sourcePlayer) && typeof draft.win.specialFlower === 'boolean' && list(draft.concealed, tile) && list(draft.melds, meld) && (draft.winningTile === null || tile(draft.winningTile)) && list(draft.flowers, (flower) => typeof flower === 'string' && flower in FLOWERS) && list(draft.indicators, (indicator) => object(indicator) && text(indicator.id) && ['dora', 'ura'].includes(String(indicator.kind)) && tile(indicator.tile)) && object(draft.redFives) && typeof draft.redFives.enabled === 'boolean' && object(draft.redFives.perSuit) && ['m', 'p', 's'].every((suit) => integer((draft.redFives as { perSuit: Record<string, unknown> }).perSuit[suit]) && Number((draft.redFives as { perSuit: Record<string, unknown> }).perSuit[suit]) <= 4)
  })
  if (!roundsValid || !draftsValid || !list(value.actions, action)) throw new Error('動作／草稿資料損壞；保留原始資料，不覆寫。')
  const data = structuredClone(value) as unknown as GameplayData
  const roundIds = new Set(data.rounds.map((round) => round.id))
  if (roundIds.size !== data.rounds.length || (data.activeRoundId && !roundIds.has(data.activeRoundId)) || data.actions.some((item) => !roundIds.has(item.roundId)) || data.drafts.some((item) => !roundIds.has(item.roundId)) || new Set(data.actions.map((item) => item.id)).size !== data.actions.length || new Set(data.drafts.map((item) => item.id)).size !== data.drafts.length) throw new Error('動作／草稿參照資料無效。')
  return data
}
function nullableId(value: unknown) { return value === null || text(value) }
