import { POSITIONS } from '../../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
import { isFive, isTileType, newId, sequenceFrom } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
import type { ActionInput, GameplayData, Meld, MeldKind, PlayerAction, RiichiDeclaration, RoundContext } from './models'

export const emptyGameplay = (): GameplayData => ({ version: 1, activeRoundId: null, rounds: [], actions: [], drafts: [] })
export function archiveRound(data: GameplayData): GameplayData {
  return { ...data, activeRoundId: null, rounds: data.rounds.map((round) => round.id === data.activeRoundId ? { ...round, status: 'archived' } : round) }
}
export function beginRound(data: GameplayData, variant: MahjongVariant, dealer: PlayerPosition, players: Record<PlayerPosition, Player>, id: string = newId()): GameplayData {
  const archived = archiveRound(data)
  return { ...archived, activeRoundId: id, rounds: [...archived.rounds, { id, variant, dealer, players: structuredClone(players), createdAt: Date.now(), status: 'active' }] }
}
export const activeRound = (data?: GameplayData) => data?.rounds.find((round) => round.id === data.activeRoundId && round.status === 'active')
export function getEligibleAddedKanMelds(playerId: PlayerPosition, roundId: string, melds: readonly Meld[], tile?: TileType): Meld[] {
  return melds.filter((meld) => typeof meld.id === 'string' && !!meld.id && meld.playerId === playerId && meld.roundId === roundId && meld.kind === 'pon' && meld.status === 'active' && meld.open === true && !meld.upgradeActionId && isTileType(meld.tile) && (!tile || meld.tile === tile) && meld.tiles.length === 3 && meld.tiles.every((item) => item.type === meld.tile))
}
export function makeMeld(kind: Exclude<MeldKind, 'shouminkan'>, tile: TileType, playerId: PlayerPosition, roundId: string, variant: MahjongVariant, id: string = newId(), sourcePlayer: PlayerPosition | null = null): Meld {
  if (!isTileType(tile)) throw new Error('請選擇已知牌種。')
  const types = kind === 'chi' ? sequenceFrom(tile) : Array.from({ length: kind === 'pon' ? 3 : 4 }, () => tile)
  return { id, roundId, playerId, kind, tile, tiles: types.map((type, index) => ({ id: `${id}:tile:${index}`, type, red: false })), open: kind !== 'ankan', sourcePlayer, order: 0, status: 'active', actionId: id, redCount: variant === 'riichi' && types.some(isFive) ? null : 0 }
}
export function upgradePon(meld: Meld, actionId: string, tile: TileType, physicalConfirmed: boolean): Meld {
  if (physicalConfirmed !== true || !getEligibleAddedKanMelds(meld.playerId, meld.roundId, [meld], tile).length) throw new Error('沒有相符的有效碰牌，或尚未確認第四張實體牌。')
  return { ...meld, originalPon: structuredClone(meld), kind: 'shouminkan', tiles: [...meld.tiles, { id: `${actionId}:fourth`, type: tile, red: false }], upgradeActionId: actionId, physicalConfirmed: true }
}
export function projectRound(data: GameplayData, roundId: string): { melds: Meld[]; riichi: RiichiDeclaration[]; issues: Record<string, string> } {
  const round = data.rounds.find((item) => item.id === roundId)
  const melds: Meld[] = []
  const riichi: RiichiDeclaration[] = []
  const issues: Record<string, string> = {}
  if (!round) return { melds, riichi, issues }
  for (const action of data.actions.filter((item) => item.roundId === roundId && item.status === 'active').sort((a, b) => a.order - b.order)) {
    try {
      if (!POSITIONS.includes(action.playerId)) throw new Error('未知玩家。')
      const declared = riichi.some((item) => item.playerId === action.playerId)
      if (action.kind === 'riichi') {
        if (round.variant !== 'riichi' || action.confirmed !== true || declared || melds.some((meld) => meld.playerId === action.playerId && meld.open)) throw new Error('立直需門前清及玩家確認；現有記錄不符合。')
        riichi.push({ actionId: action.id, roundId, playerId: action.playerId, status: 'confirmed', validation: 'user-confirmed-unverified' })
        continue
      }
      if (!['chi', 'pon', 'ankan', 'daiminkan', 'shouminkan'].includes(action.kind) || !['completed', 'robbed'].includes(action.kanStatus)) throw new Error('無效動作或槓狀態。')
      if (!isTileType(action.tile)) throw new Error('未知牌種。')
      if (declared && action.kind !== 'ankan') throw new Error('已確認立直後不可記錄明副露；請先更正立直。')
      if (action.kind === 'shouminkan') {
        const pon = getEligibleAddedKanMelds(action.playerId, roundId, melds, action.tile).find((meld) => meld.id === action.targetMeldId && action.meldId === meld.id)
        if (!pon || action.physicalConfirmed !== true) throw new Error('加槓只可升級此局此玩家的有效碰牌，並確認第四張牌。')
        if (action.kanStatus === 'completed') {
          if (round.variant === 'riichi' && melds.filter((meld) => meld.tiles.length === 4).length >= 4) throw new Error('此局已記錄四組完成的槓。')
          const upgraded = upgradePon(pon, action.id, action.tile, true)
          assertKnownTiles(melds.map((meld) => meld.id === pon.id ? upgraded : meld))
          melds[melds.indexOf(pon)] = upgraded
        }
        continue // Robbed attempt retains its Pon and creates no completed Kan.
      }
      if (action.sourcePlayer !== null && !POSITIONS.includes(action.sourcePlayer)) throw new Error('未知來源玩家。')
      if (action.sourcePlayer === action.playerId) throw new Error('來源玩家不能是自己。')
      if (action.kind === 'chi' && round.variant === 'riichi' && action.sourcePlayer !== POSITIONS[(POSITIONS.indexOf(action.playerId) + 1) % 4]) throw new Error('立直吃牌只能取上家的棄牌。')
      if (declared && action.riichiAnkanConfirmed !== true) throw new Error('立直後暗槓需要玩家另行確認規則限制。')
      if ((action.kind === 'ankan' || action.kind === 'daiminkan') && action.kanStatus === 'robbed') continue
      if (melds.filter((meld) => meld.playerId === action.playerId).length >= 4) throw new Error('此玩家已記錄四組副露，請先更正。')
      if (melds.some((meld) => meld.id === action.meldId)) throw new Error('重複副露識別碼。')
      if (round.variant === 'riichi' && action.kind !== 'pon' && action.kind !== 'chi' && melds.filter((meld) => meld.tiles.length === 4).length >= 4) throw new Error('此局已記錄四組完成的槓。')
      const meld = makeMeld(action.kind, action.tile, action.playerId, roundId, round.variant, action.meldId, action.sourcePlayer)
      meld.order = action.order
      meld.actionId = action.id
      assertKnownTiles([...melds, meld])
      melds.push(meld)
    } catch (error) { issues[action.id] = error instanceof Error ? error.message : '無法套用記錄。' }
  }
  // Corrections/undo may invalidate an earlier closed-hand declaration; do not show a false badge.
  return { melds, riichi: riichi.filter((declaration) => !melds.some((meld) => meld.playerId === declaration.playerId && meld.open)), issues }
}
function assertKnownTiles(melds: Meld[]) {
  const counts = new Map<string, number>()
  for (const tile of melds.flatMap((meld) => meld.tiles)) counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1)
  if ([...counts.values()].some((count) => count > 4)) throw new Error('已記錄副露包含超過四張相同牌。')
}
function validateRound(data: GameplayData, round: RoundContext) {
  const issues = projectRound(data, round.id).issues
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0] + ' 請先撤回／更正相關記錄。')
}
export function recordAction(data: GameplayData, playerId: PlayerPosition, input: ActionInput, id: string = newId()): GameplayData {
  const round = activeRound(data)
  if (!round) throw new Error('請先完成配牌。')
  if (data.actions.some((action) => action.id === id)) throw new Error('重複動作識別碼。')
  const action = { ...input, id, playerId, roundId: round.id, order: Math.max(0, ...data.actions.map((item) => item.order)) + 1, status: 'active', revision: 0 } as PlayerAction
  const next = { ...data, actions: [...data.actions, action] }
  validateRound(next, round)
  return next
}
export function undoAction(data: GameplayData, id: string): GameplayData {
  return { ...data, actions: data.actions.map((action) => action.id === id && action.roundId === data.activeRoundId ? { ...action, status: 'undone' } : action) }
}
export function correctAction(data: GameplayData, id: string, input: ActionInput): GameplayData {
  const previous = data.actions.find((action) => action.id === id)
  if (!previous || previous.status !== 'active' || previous.roundId !== data.activeRoundId || input.kind !== previous.kind) throw new Error('只可更正此局有效的同類動作。')
  if ('meldId' in previous && 'meldId' in input && previous.meldId !== input.meldId) throw new Error('更正不可更換副露識別碼，請先撤回。')
  const action = { ...previous, ...input, id: previous.id, revision: previous.revision + 1 } as PlayerAction
  const next = { ...data, actions: data.actions.map((item) => item.id === id ? action : item) }
  validateRound(next, activeRound(data)!)
  return next
}
