import type { HandDraft } from '../actions/models'
import type { MatchRules } from '../match/rules'
import type { Points } from '../match/models'
import type { PlayerPosition } from '../../types/mahjong'
import type { TileInstance } from '../hands/tiles'
export interface RiichiScoreRules {
  namedDoubleVariants?: boolean
  version: 1; kiriage: boolean; kazoe: 'yakuman' | 'sanbaiman' | 'uncapped'; doubleYakuman: boolean; stackYakuman: boolean
  doubleWindPair: 2 | 4; openTanyao: boolean; kanReveal: 'immediate' | 'ankan-immediate-open-after-discard'
}
export interface HKScoreRules {
  firstTurn?: 'v1'; humanWin?: boolean
  version: 1; kankan: 8 | 10 | 'cap'; sevenPairs: boolean
  baseUnit?: number; ronMultiplier: number; tsumoMultiplier: number
}
export const defaultRiichiScoreRules = (): RiichiScoreRules => ({ version: 1, kiriage: false, kazoe: 'yakuman', doubleYakuman: true, namedDoubleVariants: true, stackYakuman: true, doubleWindPair: 4, openTanyao: true, kanReveal: 'ankan-immediate-open-after-discard' })
export const defaultHKScoreRules = (): HKScoreRules => ({ version: 1, firstTurn: 'v1', humanWin: false, baseUnit: 1, kankan: 8, sevenPairs: false, ronMultiplier: 2, tsumoMultiplier: 1 })
export interface WinConditions {
  workflow?: 2; exceptional?: boolean
  version: 1; reviewed: boolean; legalWinConfirmed: boolean; singleWinner: boolean; noResponsibility: boolean
  doubleRiichi: boolean; ippatsu: boolean; rinshan: boolean; chankan: boolean; haitei: boolean; houtei: boolean
  tenhou: boolean; chiihou: boolean; hkHeaven: boolean; hkEarth: boolean; hkHuman: boolean; consecutiveKan: boolean
  hkBaseUnit?: number
}
export const emptyConditions = (): WinConditions => ({ version: 1, reviewed: false, legalWinConfirmed: false, singleWinner: false, noResponsibility: false, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false, tenhou: false, chiihou: false, hkHeaven: false, hkEarth: false, hkHuman: false, consecutiveKan: false })
export interface RoundIndicator { id: string; kind: 'initial' | 'kan'; meldId?: string; timing: 'immediate' | 'after-discard'; status: 'pending' | 'unrevealed' | 'deferred' | 'effective'; tile?: TileInstance; revision: number }
export interface RoundDora { version: 1; entries: RoundIndicator[] }
export interface ScoreComponent { name: string; value: number; kind: 'fan' | 'yaku' | 'bonus' | 'yakuman' }
export interface FuComponent { name: string; value: number }
export interface Payment { from: PlayerPosition; to: PlayerPosition; amount: number; reason: string }
export interface ScoreResult {
  bonuses?: { dora: number; kanDora: number; ura: number; kanUra: number; redDora: number }
  version: 1; variant: MatchRules['variant']; components: ScoreComponent[]; fuBreakdown: FuComponent[]
  rawFan: number; fan: number; han: number; fu: number; yakuman: number; basePoints: number
  label: string; tier: number; payments: Payment[]; deltas: Points; poolDelta: number; winnerTotal: number; interpretation: string
}
export interface LockedWin {
  version: 1; id: string; roundId: string; draft: HandDraft; conditions: WinConditions; rules: MatchRules
  score: ScoreResult; fingerprint: string; inputFingerprint: string; lockedAt: number; status: 'locked' | 'finalized' | 'reversed'
}
