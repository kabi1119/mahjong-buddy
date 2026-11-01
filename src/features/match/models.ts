import type { PlayerPosition } from '../../types/mahjong'
import type { GameSetup } from '../game/setup'
import type { MatchRules } from './rules'
export type Points = Record<PlayerPosition, number>
export type Tenpai = Record<PlayerPosition, boolean>
export interface MatchCursor {
  dealer: PlayerPosition; roundWind: number; kyoku: number; sequence: number; honba: number; points: Points; pool: number
  phase: 'playing' | 'between' | 'preparing' | 'end-decision' | 'ended'; roundId: string; winPending: boolean
}
export interface LedgerEntry {
  id: string; roundId: string; kind: 'riichi' | 'noten'; actionId?: string; deltas: Points; poolDelta: number
  status: 'active' | 'reversed'; includedInBaseline?: boolean
}
export interface FourKanPending { roundId: string; signature: string; status: 'pending' | 'deferred' | 'win-pending' }
export interface RoundOutcome {
  id: string; roundId: string; type: 'exhaustive-draw' | 'four-kan-abortive-draw'; tenpai?: Tenpai; deltas: Points
  before: MatchCursor; after: MatchCursor; setupBefore: GameSetup; undone: boolean; timestamp: number
}
export interface MatchState extends MatchCursor {
  version: 1; id: string; variant: MatchRules['variant']; initialDealer: PlayerPosition; rules: MatchRules
  history: RoundOutcome[]; ledger: LedgerEntry[]; legacyUnreconciled: boolean; legacyActionIds: string[]
  pendingFourKan?: FourKanPending
}
