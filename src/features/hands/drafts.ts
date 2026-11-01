import { POSITIONS } from '../../types/mahjong'
import type { GameplayData, HandDraft, Meld } from '../actions/models'
import { getEligibleAddedKanMelds, projectRound, upgradePon } from '../actions/engine'
import { FLOWERS, isFive, isTileType, newId, sequenceFrom, tileLabel } from './tiles'
import type { TileInstance } from './tiles'
import type { PlayerPosition } from '../../types/mahjong'

export function createDraft(data: GameplayData, roundId: string, winner: PlayerPosition): HandDraft {
  const round = data.rounds.find((item) => item.id === roundId)
  if (!round) throw new Error('找不到牌局。')
  return { version: 1, id: newId(), roundId, variant: round.variant, winner,
    win: { method: 'tsumo', sourcePlayer: null, specialFlower: false }, concealed: [],
    melds: structuredClone(projectRound(data, roundId).melds.filter((meld) => meld.playerId === winner)), winningTile: null,
    flowers: [], indicators: [], redFives: { enabled: round.variant === 'riichi', perSuit: { m: 1, p: 1, s: 1 } },
    status: 'draft', createdAt: Date.now(), updatedAt: Date.now() }
}
export const handTiles = (draft: HandDraft): TileInstance[] => [...draft.concealed, ...draft.melds.flatMap((meld) => meld.tiles), ...(draft.winningTile ? [draft.winningTile] : [])]
export const logicalTileCount = (draft: HandDraft) => draft.concealed.length + (draft.winningTile ? 1 : 0) + draft.melds.length * 3
export const physicalTileCount = (draft: HandDraft) => handTiles(draft).length
export function hasConfirmedRiichi(data: GameplayData, draft: HandDraft) {
  return projectRound(data, draft.roundId).riichi.some((item) => item.playerId === draft.winner) && !draft.melds.some((meld) => meld.open)
}
export function completedKanCount(data: GameplayData, draft: HandDraft): number {
  const recorded = projectRound(data, draft.roundId).melds.filter((meld) => meld.tiles.length === 4)
  const groups = new Set(recorded.map((meld) => meld.id))
  for (const meld of draft.melds.filter((item) => item.tiles.length === 4)) {
    const referenceId = meld.kind === 'shouminkan' ? meld.upgradeActionId : meld.actionId
    const recordedAction = data.actions.find((action) => action.id === referenceId)
    if (!recordedAction || recorded.some((item) => item.id === meld.id && item.kind === meld.kind)) groups.add(meld.id)
  }
  return Math.min(4, groups.size)
}
export function upgradeDraftPon(draft: HandDraft, meldId: string, confirmed: boolean): HandDraft {
  const pon = getEligibleAddedKanMelds(draft.winner, draft.roundId, draft.melds).find((item) => item.id === meldId)
  if (!pon) throw new Error('找不到可升級的碰牌。')
  return { ...draft, melds: draft.melds.map((meld) => meld.id === meldId ? upgradePon(pon, newId(), pon.tile, confirmed) : meld) }
}
export function setMeldRedCount(meld: Meld, count: number): Meld {
  if (!Number.isInteger(count) || count < 0 || count > meld.tiles.filter((tile) => isFive(tile.type)).length) throw new Error('赤牌數量不正確。')
  let remaining = count
  return { ...meld, redCount: count, tiles: meld.tiles.map((tile) => ({ ...tile, red: isFive(tile.type) && remaining-- > 0 })) }
}
export function validateDraft(draft: HandDraft, data: GameplayData, complete = false): string[] {
  const errors: string[] = []
  const round = data.rounds.find((item) => item.id === draft.roundId)
  if (!round || round.variant !== draft.variant || !round.players[draft.winner]) errors.push('牌局／玩家資料不符。')
  if (draft.win.method === 'ron' && draft.win.sourcePlayer === draft.winner) errors.push('出銃玩家不能是贏家。')
  if (draft.win.method === 'tsumo' && draft.win.sourcePlayer) errors.push('自摸不應有出銃玩家。')
  if (draft.melds.length > 4) errors.push('副露組數不可超過四組。')
  const physical = [...handTiles(draft), ...draft.indicators.map((item) => item.tile)]
  if (new Set(physical.map((tile) => tile.id)).size !== physical.length) errors.push('同一張實體牌被重複放入，食糊牌請只輸入一次。')
  const counts = new Map<string, number>()
  for (const tile of physical) {
    if (!isTileType(tile.type) || (tile.red && !isFive(tile.type))) errors.push('存在無效牌種／赤牌。')
    counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1)
  }
  for (const [type, count] of counts) if (count > 4) errors.push(`${tileLabel(type as import('./tiles').TileType)} 超過四張實體牌（包括指示牌）。`)
  for (const suit of ['m', 'p', 's'] as const) {
    const configured = draft.variant === 'riichi' && draft.redFives.enabled ? draft.redFives.perSuit[suit] : 0
    if (!Number.isInteger(configured) || configured < 0 || configured > 4) errors.push('赤五設定無效。')
    const fives = physical.filter((tile) => tile.type === `5${suit}`)
    if (fives.filter((tile) => tile.red).length > configured) errors.push(`${({ m: '萬', p: '筒', s: '索' })[suit]} 赤五超過此局設定。`)
    if (fives.filter((tile) => !tile.red).length > 4 - configured) errors.push(`${({ m: '萬', p: '筒', s: '索' })[suit]} 普通五牌超過扣除赤五後的供應量。`)
  }
  if (new Set(draft.flowers).size !== draft.flowers.length || draft.flowers.some((flower) => !(flower in FLOWERS))) errors.push('花牌每款只可一張。')
  if (draft.variant === 'riichi' && (draft.flowers.length || draft.win.specialFlower)) errors.push('立直模式不使用花牌。')
  if (draft.variant === 'hong-kong' && (draft.indicators.length || physical.some((tile) => tile.red))) errors.push('港式模式不使用赤牌或寶牌指示牌。')
  for (const meld of draft.melds) {
    const referenced = data.actions.find((action) => action.id === (meld.kind === 'shouminkan' ? meld.upgradeActionId : meld.actionId))
    if (complete && referenced && !projectRound(data, draft.roundId).melds.some((item) => item.id === meld.id && item.kind === meld.kind && item.tile === meld.tile)) errors.push('副露記錄已更正／撤回，請核對或同步草稿。')
    if (meld.sourcePlayer === draft.winner || (meld.kind === 'chi' && draft.variant === 'riichi' && meld.sourcePlayer !== POSITIONS[(POSITIONS.indexOf(draft.winner) + 1) % 4])) errors.push('副露來源玩家不正確。')
    if (meld.playerId !== draft.winner || meld.roundId !== draft.roundId || meld.status !== 'active') errors.push('副露不屬於此贏家／牌局。')
    const expected = meld.kind === 'chi' ? (() => { try { return sequenceFrom(meld.tile) } catch { return [] } })() : Array.from({ length: meld.kind === 'pon' ? 3 : 4 }, () => meld.tile)
    if (!expected.length || meld.tiles.length !== expected.length || meld.tiles.some((tile, index) => tile.type !== expected[index]) || meld.open !== (meld.kind !== 'ankan')) errors.push('副露牌數或結構不正確。')
    if (meld.kind === 'shouminkan' && (!meld.originalPon || !getEligibleAddedKanMelds(draft.winner, draft.roundId, [meld.originalPon], meld.tile).length || meld.originalPon.id !== meld.id || !meld.physicalConfirmed)) errors.push('加槓缺少相符的原有碰牌及第四張牌確認。')
    if (meld.redCount !== null && meld.redCount !== meld.tiles.filter((tile) => tile.red).length) errors.push('副露赤牌數量與牌張資料不符。')
    if (complete && draft.variant === 'riichi' && meld.tiles.some((tile) => isFive(tile.type)) && meld.redCount === null) errors.push('請確認五牌副露的赤牌數量。')
  }
  if (new Set(draft.melds.map((meld) => meld.id)).size !== draft.melds.length) errors.push('重複副露組別。')
  const dora = draft.indicators.filter((item) => item.kind === 'dora').length
  const ura = draft.indicators.filter((item) => item.kind === 'ura').length
  if (dora > 1 + completedKanCount(data, draft)) errors.push('指示牌數量超過已完成槓的可用範圍；未完成／被搶的槓不計。')
  if (ura && (!hasConfirmedRiichi(data, draft) || ura > dora)) errors.push('裏寶牌只適用於已確認立直、門前清的贏家，且不可多於已揭指示牌。')
  if (complete) {
    if (projectRound(data, draft.roundId).riichi.some((item) => item.playerId === draft.winner) && draft.melds.some((meld) => meld.open)) errors.push('立直記錄與重建明副露矛盾，請先更正立直記錄。')
    if (draft.win.method === 'ron' && !draft.win.sourcePlayer) errors.push('請選擇出銃玩家。')
    if (draft.win.specialFlower) {
      if (draft.variant !== 'hong-kong' || !draft.flowers.length) errors.push('花糊記錄需要花牌；不會判定花糊資格。')
    } else {
      if (!draft.winningTile) errors.push('請輸入食糊／和牌牌張。')
      if (logicalTileCount(draft) !== 14) errors.push(`一般手牌需 14 張邏輯牌（目前 ${logicalTileCount(draft)}）；每槓另加一張實體牌。`)
    }
    if (draft.variant === 'riichi' && !dora) errors.push('請輸入牌山實際揭開的初始寶牌指示牌。')
  }
  return [...new Set(errors)]
}
export function saveDraft(data: GameplayData, draft: HandDraft, confirm: boolean): GameplayData {
  const errors = validateDraft(draft, data, confirm)
  if (errors.length) throw new Error(errors.join(' '))
  const saved = { ...structuredClone(draft), status: confirm ? 'confirmed' as const : 'draft' as const, updatedAt: Date.now() }
  return { ...data, drafts: data.drafts.some((item) => item.id === draft.id) ? data.drafts.map((item) => item.id === draft.id ? saved : item) : [...data.drafts, saved] }
}
