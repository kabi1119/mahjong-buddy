import type { GameplayData, HandDraft, Meld, MeldKind, ActionInput } from '../actions/models'
import { activeRound, correctAction, projectRound, recordAction, undoAction } from '../actions/engine'
import { newId, tileInstance } from './tiles'
import type { TileType } from './tiles'
import type { PlayerPosition } from '../../types/mahjong'
import { precedingPlayer } from '../actions/chi'
import { syncMatch } from '../match/engine'
import { syncRoundIndicators } from '../scoring/indicators'
import { logicalTileCount } from './drafts'
export function addSelectedTile(draft: HandDraft, type: TileType, red: boolean): HandDraft {
  if (logicalTileCount(draft) >= 14) throw new Error('已用滿 14 個邏輯牌位；可點選上方牌張移除。')
  return { ...draft, concealed: [...draft.concealed, ...(draft.winningTile ? [draft.winningTile] : [])], winningTile: tileInstance(type, red), status: 'draft' }
}
export function removeSelectedTile(draft: HandDraft, id: string): HandDraft {
  if (draft.winningTile?.id !== id) return { ...draft, concealed: draft.concealed.filter((tile) => tile.id !== id), status: 'draft' }
  const concealed = [...draft.concealed]; const winningTile = concealed.pop() ?? null
  return { ...draft, concealed, winningTile, status: 'draft' }
}
export function designateWinningTile(draft: HandDraft, id: string): HandDraft {
  const selected = draft.concealed.find((tile) => tile.id === id)
  if (!selected) throw new Error('只可從未副露的已選手牌指定和牌張。')
  return { ...draft, concealed: [...draft.concealed.filter((tile) => tile.id !== id), ...(draft.winningTile ? [draft.winningTile] : [])], winningTile: selected, status: 'draft' }
}
export function refreshRecordedMelds(data: GameplayData, draft: HandDraft): HandDraft {
  const melds = projectRound(data, draft.roundId).melds.filter((meld) => meld.playerId === draft.winner).map((meld) => {
    const previous = draft.melds.find((item) => item.id === meld.id && item.kind === meld.kind && item.tile === meld.tile && item.tiles.length === meld.tiles.length)
    return previous?.redCount !== null && previous?.redCount !== undefined && meld.redCount === null ? { ...structuredClone(meld), tiles: structuredClone(previous.tiles), redCount: previous.redCount } : structuredClone(meld)
  })
  return { ...draft, melds, reviewedMelds: false, status: 'draft' }
}
export function removeRecordedMeld(data: GameplayData, id: string): GameplayData {
  const meld = projectRound(data, data.activeRoundId!).melds.find((item) => item.id === id)
  if (!meld) throw new Error('找不到此局副露。')
  let next = data
  if (meld.upgradeActionId) next = undoAction(next, meld.upgradeActionId)
  next = undoAction(next, meld.actionId)
  return syncRoundIndicators(syncMatch(next))
}
export function saveRecordedMeld(data: GameplayData, player: PlayerPosition, kind: MeldKind, tile: TileType, source: PlayerPosition | null, old?: Meld): GameplayData {
  const round = activeRound(data)
  if (!round) throw new Error('找不到目前牌局。')
  let next = data
  const sameKind = old?.kind === kind && kind !== 'shouminkan'
  if (old && !sameKind) next = removeRecordedMeld(next, old.id)
  const meldId = sameKind ? old!.id : newId()
  const sourcePlayer = kind === 'ankan' ? null : kind === 'chi' ? precedingPlayer(player) : source
  if (kind === 'shouminkan') {
    // Explicit missing-meld review reconstructs the original physical Pon then its completed upgrade.
    next = recordAction(next, player, { kind: 'pon', tile, meldId, sourcePlayer, kanStatus: 'completed', riichiAnkanConfirmed: false })
    next = recordAction(next, player, { kind: 'shouminkan', tile, meldId, targetMeldId: meldId, physicalConfirmed: true, kanStatus: 'completed' })
  } else {
    const input: ActionInput = { kind, tile, meldId, sourcePlayer, redCount: undefined, kanStatus: 'completed', riichiAnkanConfirmed: kind === 'ankan', ...(kind === 'chi' ? { claimedTile: undefined, suppliedTiles: undefined, chiRedIndex: undefined, physicalConfirmed: undefined } : {}) }
    next = sameKind ? correctAction(next, old!.actionId, input) : recordAction(next, player, input)
  }
  return syncRoundIndicators(syncMatch(next))
}

export function correctRecordedRedCount(data: GameplayData, meldId: string, count: number): GameplayData {
  const meld = projectRound(data, data.activeRoundId!).melds.find((item) => item.id === meldId)
  if (!meld) throw new Error('找不到此局副露。')
  const action = data.actions.find((item) => item.id === (meld.upgradeActionId ?? meld.actionId))!
  if (action.kind === 'riichi') throw new Error('此記錄不是副露。')
  const input: ActionInput = { ...action, redCount: count, ...(action.kind === 'chi' && action.claimedTile !== undefined ? { chiRedIndex: count ? meld.tiles.findIndex((tile) => /^5[mps]$/.test(tile.type)) : null } : {}) }
  return syncRoundIndicators(syncMatch(correctAction(data, action.id, input)))
}
