import { precedingPlayer } from './chi'
import { applyRedComposition } from './redComposition'
import { POSITIONS } from '../../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
import { isFive, isTileType, newId, sequenceFrom } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
import type { ActionInput, GameplayData, Meld, MeldKind, PlayerAction, RiichiDeclaration, RoundContext } from './models'

export const emptyGameplay = (): GameplayData => ({ version: 2, activeRoundId: null, rounds: [], actions: [], drafts: [] })
export function archiveRound(data: GameplayData): GameplayData {
  return { ...data, activeRoundId: null, rounds: data.rounds.map((round) => round.id === data.activeRoundId ? { ...round, status: 'archived' } : round) }
}
export function beginRound(data: GameplayData, variant: MahjongVariant, dealer: PlayerPosition, players: Record<PlayerPosition, Player>, id: string = newId()): GameplayData {
  const archived = archiveRound(data)
  return { ...archived, version: 2, activeRoundId: id, rounds: [...archived.rounds, { id, variant, dealer, players: structuredClone(players), createdAt: Date.now(), status: 'active' }] }
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
          let upgraded = upgradePon(pon, action.id, action.tile, true)
          if (round.variant === 'riichi' && isFive(action.tile)) upgraded.redCount = null
          if (action.redCount !== undefined) {
            if (round.variant !== 'riichi' && action.redCount !== 0) throw new Error('香港牌局不使用赤五。')
            upgraded = applyRedComposition(upgraded, action.redCount)
          }
          assertKnownTiles(melds.map((meld) => meld.id === pon.id ? upgraded : meld), data)
          melds[melds.indexOf(pon)] = upgraded
        }
        continue // Robbed attempt retains its Pon and creates no completed Kan.
      }
      if (action.sourcePlayer !== null && !POSITIONS.includes(action.sourcePlayer)) throw new Error('未知來源玩家。')
      if (action.sourcePlayer === action.playerId) throw new Error('來源玩家不能是自己。')
      if (action.kind === 'chi' && round.variant === 'riichi' && action.sourcePlayer !== precedingPlayer(action.playerId)) throw new Error('立直吃牌只能取上家的棄牌。')
      if (declared && action.riichiAnkanConfirmed !== true) throw new Error('立直後暗槓需要玩家另行確認規則限制。')
      if ((action.kind === 'ankan' || action.kind === 'daiminkan') && action.kanStatus === 'robbed') continue
      if (melds.filter((meld) => meld.playerId === action.playerId).length >= 4) throw new Error('此玩家已記錄四組副露，請先更正。')
      if (melds.some((meld) => meld.id === action.meldId)) throw new Error('重複副露識別碼。')
      if (round.variant === 'riichi' && action.kind !== 'pon' && action.kind !== 'chi' && melds.filter((meld) => meld.tiles.length === 4).length >= 4) throw new Error('此局已記錄四組完成的槓。')
      let meld = makeMeld(action.kind, action.tile, action.playerId, roundId, round.variant, action.meldId, action.sourcePlayer)
      if (action.kind === 'chi' && action.claimedTile !== undefined) {
        const types = meld.tiles.map((item) => item.type)
        if (action.physicalConfirmed !== true || action.sourcePlayer !== precedingPlayer(action.playerId) || !types.includes(action.claimedTile) || !Array.isArray(action.suppliedTiles) || JSON.stringify(action.suppliedTiles) !== JSON.stringify(types.filter((type) => type !== action.claimedTile))) throw new Error('順子來源、棄牌或兩張手牌未正確確認。')
        if (action.chiRedIndex !== null && action.chiRedIndex !== undefined) {
          const index = action.chiRedIndex
          if (round.variant !== 'riichi' || !Number.isInteger(index) || index < 0 || index > 2 || !isFive(types[index])) throw new Error('赤五組成無效。')
          const rules = data.match?.rules
          if (rules?.variant === 'riichi' && rules.redFives[types[index][1] as 'm' | 'p' | 's'] < 1) throw new Error('此花色未啟用赤五。')
          meld.tiles[index].red = true
          meld.redCount = 1
        } else meld.redCount = 0
        meld.claimedTile = action.claimedTile; meld.suppliedTiles = [...action.suppliedTiles]; meld.chiRedIndex = action.chiRedIndex
        if (data.match?.rules.variant === 'riichi') {
          for (const suit of ['m', 'p', 's'] as const) {
            const reds = [...melds, meld].flatMap((item) => item.tiles).filter((item) => item.red && item.type.endsWith(suit)).length
            if (reds > data.match.rules.redFives[suit]) throw new Error('已記錄赤五超過本局家規數量。')
          }
        }
      }
      if (action.redCount !== undefined) {
        if (round.variant !== 'riichi' && action.redCount !== 0) throw new Error('香港牌局不使用赤五。')
        meld = applyRedComposition(meld, action.redCount)
      }
      meld.order = action.order
      meld.actionId = action.id
      assertKnownTiles([...melds, meld], data)
      melds.push(meld)
    } catch (error) { issues[action.id] = error instanceof Error ? error.message : '無法套用記錄。' }
  }
  // Corrections/undo may invalidate an earlier closed-hand declaration; do not show a false badge.
  return { melds, riichi: riichi.filter((declaration) => !melds.some((meld) => meld.playerId === declaration.playerId && meld.open)), issues }
}
function assertKnownTiles(melds: Meld[], data: GameplayData) {
  const counts = new Map<string, number>()
  for (const tile of melds.flatMap((meld) => meld.tiles)) counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1)
  if ([...counts.values()].some((count) => count > 4)) throw new Error('已記錄副露包含超過四張相同牌。')
  if (data.match?.rules.variant === 'riichi') for (const suit of ['m', 'p', 's'] as const) {
    const known = melds.filter((meld) => meld.redCount !== null).flatMap((meld) => meld.tiles).filter((tile) => tile.type === '5' + suit)
    const configured = data.match.rules.redFives[suit]
    if (known.filter((tile) => tile.red).length > configured || known.filter((tile) => !tile.red).length > 4 - configured) throw new Error('已記錄副露的赤五／普通五超過本局實體供應量。')
  }
}
function validateRound(data: GameplayData, round: RoundContext) {
  const issues = projectRound(data, round.id).issues
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0] + ' 請先撤回／更正相關記錄。')
}
export function recordAction(data: GameplayData, playerId: PlayerPosition, input: ActionInput, id: string = newId()): GameplayData {
  const round = activeRound(data)
  if (data.wins?.some((win) => win.roundId === data.activeRoundId && win.status !== 'reversed')) throw new Error('和牌手牌已鎖定，不可更改本局動作。')
  if (!round || (data.match && data.match.phase !== 'playing')) throw new Error('請先完成配牌。')
  if (input.kind === 'riichi' && data.match?.legacyUnreconciled) throw new Error('舊局未對帳，請由流局／摘要填寫實際點數及供託。')
  if (data.actions.some((action) => action.id === id)) throw new Error('重複動作識別碼。')
  const action = { ...input, id, playerId, roundId: round.id, order: Math.max(0, ...data.actions.map((item) => item.order)) + 1, status: 'active', revision: 0 } as PlayerAction
  const next = { ...data, actions: [...data.actions, action] }
  validateRound(next, round)
  return next
}
export function undoAction(data: GameplayData, id: string): GameplayData {
  if (data.wins?.some((win) => win.roundId === data.activeRoundId && win.status !== 'reversed')) throw new Error('手牌已鎖定，不可撤回動作。')
  return { ...data, actions: data.actions.map((action) => action.id === id && action.roundId === data.activeRoundId ? { ...action, status: 'undone' } : action) }
}
export function correctAction(data: GameplayData, id: string, input: ActionInput): GameplayData {
  if (data.wins?.some((win) => win.roundId === data.activeRoundId && win.status !== 'reversed')) throw new Error('手牌已鎖定，不可更正動作。')
  const previous = data.actions.find((action) => action.id === id)
  if (!previous || previous.status !== 'active' || previous.roundId !== data.activeRoundId || input.kind !== previous.kind) throw new Error('只可更正此局有效的同類動作。')
  if ('meldId' in previous && 'meldId' in input && previous.meldId !== input.meldId) throw new Error('更正不可更換副露識別碼，請先撤回。')
  const action = { ...previous, ...input, id: previous.id, revision: previous.revision + 1 } as PlayerAction
  const next = { ...data, actions: data.actions.map((item) => item.id === id ? action : item) }
  validateRound(next, activeRound(data)!)
  return next
}
