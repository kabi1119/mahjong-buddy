import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
import type { FlowerType, Suit, TileInstance, TileType } from '../hands/tiles'
export type KanKind = 'ankan' | 'daiminkan' | 'shouminkan'
export type MeldKind = 'chi' | 'pon' | KanKind
export interface RoundContext {
  id: string; variant: MahjongVariant; dealer: PlayerPosition; players: Record<PlayerPosition, Player>
  createdAt: number; status: 'active' | 'archived'
}
interface ActionBase {
  id: string; roundId: string; playerId: PlayerPosition; order: number
  status: 'active' | 'undone'; revision: number
}
export interface CallAction extends ActionBase {
  kind: Exclude<MeldKind, 'shouminkan'>; tile: TileType; meldId: string
  sourcePlayer: PlayerPosition | null; kanStatus: 'completed' | 'robbed'; riichiAnkanConfirmed: boolean
}
export interface AddedKanAction extends ActionBase {
  kind: 'shouminkan'; tile: TileType; meldId: string; targetMeldId: string
  physicalConfirmed: boolean; kanStatus: 'completed' | 'robbed'
}
export interface RiichiAction extends ActionBase { kind: 'riichi'; confirmed: boolean }
export type PlayerAction = CallAction | AddedKanAction | RiichiAction
export type ActionInput =
  | Omit<CallAction, keyof ActionBase>
  | Omit<AddedKanAction, keyof ActionBase>
  | Omit<RiichiAction, keyof ActionBase>
export interface Meld {
  id: string; roundId: string; playerId: PlayerPosition; kind: MeldKind; tile: TileType
  tiles: TileInstance[]; open: boolean; sourcePlayer: PlayerPosition | null
  order: number; status: 'active' | 'removed'; actionId: string; redCount: number | null
  originalPon?: Omit<Meld, 'originalPon'>; upgradeActionId?: string; physicalConfirmed?: boolean
}
export interface RiichiDeclaration { actionId: string; playerId: PlayerPosition; roundId: string; status: 'confirmed'; validation: 'user-confirmed-unverified' }
export interface WinContext { method: 'tsumo' | 'ron'; sourcePlayer: PlayerPosition | null; specialFlower: boolean }
export interface DoraIndicator { id: string; tile: TileInstance; kind: 'dora' | 'ura' }
export interface HandDraft {
  version: 1; id: string; roundId: string; variant: MahjongVariant; winner: PlayerPosition
  win: WinContext; concealed: TileInstance[]; melds: Meld[]; winningTile: TileInstance | null
  flowers: FlowerType[]; indicators: DoraIndicator[]; redFives: { enabled: boolean; perSuit: Record<Suit, number> }
  status: 'draft' | 'confirmed'; createdAt: number; updatedAt: number
}
export interface GameplayData {
  version: 1; activeRoundId: string | null; rounds: RoundContext[]; actions: PlayerAction[]; drafts: HandDraft[]
}
export const ACTION_LABELS: Record<MeldKind | 'riichi', string> = { chi: '上牌／吃', pon: '碰', ankan: '暗槓', daiminkan: '大明槓', shouminkan: '加槓', riichi: '立直' }
// Metadata only. Three-player play is deliberately not implemented.
export const FUTURE_SANMA_ACTION = { kind: 'nuki-kita', label: '拔北 / Nuki Kita', available: false } as const
