import { defaultHKScoreRules, defaultRiichiScoreRules } from '../scoring/models'
import type { HKScoreRules, RiichiScoreRules } from '../scoring/models'
import type { Suit } from '../hands/tiles'
export type ThemePreference = 'system' | 'light' | 'dark'
export interface HongKongRules {
  scoring?: HKScoreRules
  variant: 'hong-kong'; dice: 2 | 3; drawDealer: 'repeat' | 'rotate'; minimumFan: number; fanCap: 10 | 13
  payment: 'half-la' | 'full-la' | 'custom'; payouts: { fan: number; ron: number; tsumo: number }[]; winds: 4
}
export interface JapaneseRiichiRules {
  scoring?: RiichiScoreRules
  variant: 'riichi'; length: 'hanchan' | 'tonpuu'; startingPoints: number; redFives: Record<Suit, number>
  fourKanAbortive: boolean; maxKans: 4; notenTotal: 3000
}
export type MatchRules = HongKongRules | JapaneseRiichiRules
export interface RulePreferences { version: 1; hongKong: HongKongRules; riichi: JapaneseRiichiRules }
export const defaultHK = (): HongKongRules => ({ scoring: defaultHKScoreRules(), variant: 'hong-kong', dice: 3, drawDealer: 'repeat', minimumFan: 3, fanCap: 13, payment: 'half-la', payouts: [], winds: 4 })
export const defaultRiichi = (): JapaneseRiichiRules => ({ scoring: defaultRiichiScoreRules(), variant: 'riichi', length: 'hanchan', startingPoints: 25000, redFives: { m: 1, p: 1, s: 1 }, fourKanAbortive: true, maxKans: 4, notenTotal: 3000 })
export const defaultPreferences = (): RulePreferences => ({ version: 1, hongKong: defaultHK(), riichi: defaultRiichi() })
export function validateRules(rules: MatchRules): string[] {
  if (rules.scoring) {
    const score = rules.scoring
    if (score.version !== 1) return ['未知計分設定版本。']
    if (rules.variant === 'hong-kong') {
      const hk = rules.scoring as HKScoreRules
      if ((hk.firstTurn !== undefined && hk.firstTurn !== 'v1') || (hk.humanWin !== undefined && typeof hk.humanWin !== 'boolean') || ![8, 10, 'cap'].includes(hk.kankan) || typeof hk.sevenPairs !== 'boolean' || (hk.baseUnit !== undefined && (!Number.isSafeInteger(hk.baseUnit) || hk.baseUnit <= 0)) || ![hk.ronMultiplier, hk.tsumoMultiplier].every((amount) => Number.isSafeInteger(amount) && amount > 0)) return ['港式計分設定無效。']
    } else {
      const jp = rules.scoring as RiichiScoreRules
      if ((jp.namedDoubleVariants !== undefined && typeof jp.namedDoubleVariants !== 'boolean') || ![jp.kiriage, jp.doubleYakuman, jp.stackYakuman, jp.openTanyao].every((flag) => typeof flag === 'boolean') || !['yakuman', 'sanbaiman', 'uncapped'].includes(jp.kazoe) || ![2, 4].includes(jp.doubleWindPair) || !['immediate', 'ankan-immediate-open-after-discard'].includes(jp.kanReveal)) return ['日本計分設定無效。']
    }
  }
  if (rules.variant === 'hong-kong') {
    if (![2, 3].includes(rules.dice) || !['repeat', 'rotate'].includes(rules.drawDealer) || !Number.isInteger(rules.minimumFan) || rules.minimumFan < 0 || rules.minimumFan > rules.fanCap || ![10, 13].includes(rules.fanCap) || rules.winds !== 4 || !['half-la', 'full-la', 'custom'].includes(rules.payment)) return ['港式規則設定無效。']
    if (!Array.isArray(rules.payouts) || rules.payouts.some((row) => !Number.isInteger(row.fan) || row.fan < rules.minimumFan || row.fan > rules.fanCap || !Number.isFinite(row.ron) || row.ron < 0 || !Number.isFinite(row.tsumo) || row.tsumo < 0) || new Set(rules.payouts.map((row) => row.fan)).size !== rules.payouts.length) return ['自訂付款表無效。']
    if (rules.payment === 'custom' && rules.payouts.length !== rules.fanCap - rules.minimumFan + 1) return ['請為每個番數填寫出銃及自摸金額。']
  } else if (!['hanchan', 'tonpuu'].includes(rules.length) || !Number.isInteger(rules.startingPoints) || rules.startingPoints < 1000 || rules.startingPoints > 1000000 || !rules.redFives || !(['m', 'p', 's'] as const).every((suit) => Number.isInteger(rules.redFives[suit]) && rules.redFives[suit] >= 0 && rules.redFives[suit] <= 4) || typeof rules.fourKanAbortive !== 'boolean' || rules.maxKans !== 4 || rules.notenTotal !== 3000) return ['日本四麻規則設定無效。']
  return []
}
export function decodePreferences(value: unknown): RulePreferences | undefined {
  if (value === undefined) return undefined
  const data = value as RulePreferences
  if (!data || data.version !== 1 || data.hongKong?.variant !== 'hong-kong' || data.riichi?.variant !== 'riichi' || validateRules(data.hongKong).length || validateRules(data.riichi).length) throw new Error('無法讀取牌局規則版本／內容，保留原資料。')
  return structuredClone(data)
}
export const TERMINOLOGY = { 'hong-kong': { ron: '出銃', win: '食糊', chi: '上牌' }, riichi: { ron: '榮和 (Ron)', win: '和牌', chi: '吃' } } as const
export const FUTURE_SANMA_ABORTIVE_ADAPTER = { enabled: false, replacement: 'variant-specific' } as const
