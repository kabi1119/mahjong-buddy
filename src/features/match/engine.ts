import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition, Player } from '../../types/mahjong'
import type { Settings } from '../../storage/settings'
import { activeRound, archiveRound, beginRound, projectRound } from '../actions/engine'
import type { GameplayData } from '../actions/models'
import { newId } from '../hands/tiles'
import { getNextPlayer } from '../game/rules'
import { newSetup } from '../game/setup'
import { defaultPreferences } from './rules'
import type { MatchRules, JapaneseRiichiRules } from './rules'
import type { MatchCursor, MatchState, Points, RoundOutcome, Tenpai } from './models'
export const zeroPoints = (): Points => ({ top: 0, right: 0, bottom: 0, left: 0 })
export function preferencesFor(settings: Settings) {
  if (settings.preferences) return settings.preferences
  const defaults = defaultPreferences()
  defaults.hongKong.dice = settings.setup?.hkDiceCount ?? 3
  return defaults
}
export function roundLabel(match?: Pick<MatchState, 'variant' | 'roundWind' | 'kyoku'>, variant: 'hong-kong' | 'riichi' = 'hong-kong'): string {
  const wind = ['東', '南', '西', '北'][match?.roundWind ?? 0] ?? `延長${(match?.roundWind ?? 3) - 3}`
  const hand = match?.kyoku ?? 1
  return (match?.variant ?? variant) === 'hong-kong' ? `${wind}圈${['東', '南', '西', '北'][hand - 1]}局` : `${wind}${['一', '二', '三', '四'][hand - 1]}局`
}
export function createMatch(data: GameplayData, rules: MatchRules, legacy: boolean): MatchState {
  const round = activeRound(data)!
  const points = Object.fromEntries(POSITIONS.map((seat) => [seat, rules.variant === 'riichi' ? rules.startingPoints : 0])) as Points
  const legacyIds = legacy ? projectRound(data, round.id).riichi.map((item) => item.actionId) : []
  return { version: 1, id: newId(), variant: round.variant, initialDealer: round.dealer, dealer: round.dealer,
    roundWind: 0, kyoku: 1, sequence: 1, honba: 0, points, pool: 0, rules: structuredClone(rules),
    phase: 'playing', roundId: round.id, winPending: false, history: [], ledger: [], legacyUnreconciled: legacyIds.length > 0, legacyActionIds: legacyIds }
}
export function calculateNotenPayments(tenpai: Tenpai): Points {
  if (!tenpai || !POSITIONS.every((seat) => typeof tenpai[seat] === 'boolean')) throw new Error('四位玩家須逐一確認聽牌／未聽牌。')
  const count = POSITIONS.filter((seat) => tenpai[seat]).length
  return Object.fromEntries(POSITIONS.map((seat) => [seat, count === 0 || count === 4 ? 0 : tenpai[seat] ? 3000 / count : -3000 / (4 - count)])) as Points
}
export function getKanSummary(data: GameplayData, roundId = data.activeRoundId) {
  const round = data.rounds.find((item) => item.id === roundId)
  const melds = round?.variant === 'riichi' && roundId === data.activeRoundId ? projectRound(data, roundId).melds.filter((meld) => meld.status === 'active' && ['ankan', 'daiminkan', 'shouminkan'].includes(meld.kind) && meld.tiles.length === 4) : []
  const unique = [...new Map(melds.map((meld) => [meld.id, meld])).values()]
  const byPlayer = Object.fromEntries(POSITIONS.map((seat) => [seat, unique.filter((meld) => meld.playerId === seat).length])) as Points
  return { count: unique.length, byPlayer, distinctPlayers: POSITIONS.filter((seat) => byPlayer[seat] > 0).length, signature: unique.map((meld) => `${meld.id}:${meld.upgradeActionId ?? meld.actionId}`).sort().join('|') }
}
export function getFourKanDrawEligibility(data: GameplayData, rules: MatchRules) {
  const summary = getKanSummary(data)
  return { ...summary, eligible: rules.variant === 'riichi' && rules.fourKanAbortive && summary.count === 4 && summary.distinctPlayers >= 2, fifthKanForbidden: rules.variant === 'riichi' && summary.count >= 4, rules }
}
export function canDeclareAnotherKan(data: GameplayData, rules: MatchRules): boolean { return rules.variant !== 'riichi' || getKanSummary(data).count < rules.maxKans }
function applyDelta(points: Points, delta: Points, sign = 1): Points { return Object.fromEntries(POSITIONS.map((seat) => [seat, points[seat] + delta[seat] * sign])) as Points }
export function syncMatch(data: GameplayData): GameplayData {
  if (!data.match || data.match.phase !== 'playing' || data.match.roundId !== data.activeRoundId) return data
  const match = structuredClone(data.match)
  if (match.variant === 'riichi' && !match.legacyUnreconciled) {
    const declarations = projectRound(data, match.roundId).riichi
    const activeIds = new Set(declarations.map((item) => item.actionId))
    for (const entry of match.ledger.filter((item) => item.kind === 'riichi' && item.roundId === match.roundId && item.status === 'active' && !activeIds.has(item.actionId!))) {
      match.points = applyDelta(match.points, entry.deltas, -1); match.pool -= entry.poolDelta; entry.status = 'reversed'
    }
    for (const declaration of declarations) {
      const existing = match.ledger.find((entry) => entry.actionId === declaration.actionId)
      if (existing?.status === 'active') continue
      if (existing?.status === 'reversed') {
        if (match.points[declaration.playerId] < 1000) throw new Error('立直需至少 1,000 點；請先核對點數。')
        match.points = applyDelta(match.points, existing.deltas); match.pool += existing.poolDelta; existing.status = 'active'; continue
      }
      if (match.legacyActionIds.includes(declaration.actionId)) continue
      if (match.points[declaration.playerId] < 1000) throw new Error('立直需至少 1,000 點；請先核對點數。')
      const deltas = zeroPoints(); deltas[declaration.playerId] = -1000
      match.points = applyDelta(match.points, deltas); match.pool += 1000
      match.ledger.push({ id: `riichi:${declaration.actionId}`, actionId: declaration.actionId, roundId: match.roundId, kind: 'riichi', deltas, poolDelta: 1000, status: 'active' })
    }
  }
  const eligibility = getFourKanDrawEligibility(data, match.rules)
  if (eligibility.eligible) {
    if (match.pendingFourKan?.signature !== eligibility.signature || match.pendingFourKan.roundId !== match.roundId) match.pendingFourKan = { roundId: match.roundId, signature: eligibility.signature, status: 'pending' }
  } else delete match.pendingFourKan
  if (JSON.stringify(match) === JSON.stringify(data.match)) return data
  return { ...data, match }
}
export function markFourKan(data: GameplayData, status: 'deferred' | 'win-pending' | 'pending'): GameplayData {
  if (!data.match?.pendingFourKan) return data
  return { ...data, match: { ...data.match, winPending: status === 'win-pending' ? true : data.match.winPending, pendingFourKan: { ...data.match.pendingFourKan, status } } }
}
export function reconcileLegacy(data: GameplayData, points: Points, pool: number): GameplayData {
  const match = data.match
  if (!match?.legacyUnreconciled || !POSITIONS.every((seat) => Number.isSafeInteger(points[seat]) && points[seat] >= 0) || !Number.isSafeInteger(pool) || pool < match.legacyActionIds.length * 1000 || pool % 1000) throw new Error('請填寫四位實際點數，供託須包含已確認的舊立直棒。')
  const ledger = [...match.ledger]
  for (const declaration of projectRound(data, match.roundId).riichi) {
    const deltas = zeroPoints(); deltas[declaration.playerId] = -1000
    ledger.push({ id: `riichi:${declaration.actionId}`, actionId: declaration.actionId, roundId: match.roundId, kind: 'riichi', deltas, poolDelta: 1000, status: 'active', includedInBaseline: true })
  }
  return { ...data, match: { ...match, points, pool, ledger, legacyUnreconciled: false } }
}
export function previewDraw(match: MatchState, type: Exclude<RoundOutcome['type'], 'win'>, tenpai?: Tenpai): MatchCursor {
  let repeat = type === 'four-kan-abortive-draw'
  if (type === 'exhaustive-draw') repeat = match.rules.variant === 'hong-kong' ? match.rules.drawDealer === 'repeat' : !!tenpai?.[match.dealer]
  const kyoku = repeat ? match.kyoku : match.kyoku % 4 + 1
  const roundWind = match.roundWind + (!repeat && match.kyoku === 4 ? 1 : 0)
  const finalWind = match.rules.variant === 'hong-kong' ? 3 : match.rules.length === 'tonpuu' ? 0 : 1
  const atFinal = match.roundWind >= finalWind && match.kyoku === 4
  const deltas = match.variant === 'riichi' && type === 'exhaustive-draw' ? calculateNotenPayments(tenpai!) : zeroPoints()
  return { dealer: repeat ? match.dealer : getNextPlayer(match.dealer), roundWind, kyoku, sequence: match.sequence + 1,
    honba: match.variant === 'riichi' ? match.honba + 1 : 0, points: applyDelta(match.points, deltas), pool: match.pool,
    phase: atFinal ? 'end-decision' : 'between', roundId: '', winPending: false }
}
function cursor(match: MatchState): MatchCursor {
  const { dealer, roundWind, kyoku, sequence, honba, points, pool, phase, roundId, winPending } = match
  return { dealer, roundWind, kyoku, sequence, honba, points: structuredClone(points), pool, phase, roundId, winPending }
}
export function finalizeDraw(settings: Settings, roundId: string, type: Exclude<RoundOutcome['type'], 'win'>, tenpai: Tenpai | undefined, confirmed: boolean): Settings {
  const data = settings.gameplay; const match = data?.match
  if (!confirmed || !data || !match || match.phase !== 'playing' || settings.setup?.phase !== 'playing' || match.roundId !== roundId || data.activeRoundId !== roundId || match.history.some((item) => item.roundId === roundId && !item.undone)) throw new Error('此局已處理或未確認，不會重複結算。')
  if (data.wins?.some((win) => win.roundId === roundId && win.status !== 'reversed')) throw new Error('本局手牌已鎖定，不能以流局覆蓋和牌結算。')
  if (match.winPending || match.pendingFourKan?.status === 'win-pending') throw new Error('和牌待處理；不會以流局取代和牌。')
  if (match.variant === 'riichi' && match.legacyUnreconciled) throw new Error('舊局未對帳，請先填寫實際點數及供託。')
  if (type === 'four-kan-abortive-draw' && !getFourKanDrawEligibility(data, match.rules).eligible) throw new Error('目前不符合四槓散了條件。')
  if (type === 'exhaustive-draw' && match.variant === 'riichi') {
    calculateNotenPayments(tenpai!)
    if (projectRound(data, roundId).riichi.some((declaration) => !tenpai![declaration.playerId])) throw new Error('已確認立直與未聽牌矛盾，請先更正立直記錄。')
  }
  const after = previewDraw(match, type, tenpai); const nextRoundId = newId(); after.roundId = nextRoundId
  const deltas = match.variant === 'riichi' && type === 'exhaustive-draw' ? calculateNotenPayments(tenpai!) : zeroPoints()
  const outcome: RoundOutcome = { id: newId(), roundId, type, ...(tenpai ? { tenpai } : {}), deltas, before: cursor(match), after, setupBefore: structuredClone(settings.setup), undone: false, timestamp: Date.now() }
  const nextData = beginRound(data, settings.variant, after.dealer, settings.players as Record<PlayerPosition, Player>, nextRoundId)
  const ledger = type === 'exhaustive-draw' && match.variant === 'riichi' ? [...match.ledger, { id: `noten:${outcome.id}`, roundId, kind: 'noten' as const, deltas, poolDelta: 0, status: 'active' as const }] : match.ledger
  return { ...settings, setup: { ...newSetup(settings.setup.hkDiceCount), dealer: after.dealer, phase: 'ready-to-roll' }, gameplay: { ...nextData, match: { ...match, ...after, history: [...match.history, outcome], ledger, pendingFourKan: undefined } } }
}
export function prepareNext(settings: Settings, decision: 'continue' | 'end' = 'continue'): Settings {
  const data = settings.gameplay; const match = data?.match
  if (!data || !match || !['between', 'end-decision'].includes(match.phase)) return settings
  if (decision === 'end') return { ...settings, gameplay: { ...archiveRound(data), match: { ...match, phase: 'ended' } } }
  return { ...settings, gameplay: { ...data, match: { ...match, phase: 'preparing' } } }
}
export function undoLatestDraw(settings: Settings): Settings {
  const data = settings.gameplay; const match = data?.match
  const outcome = match?.history.filter((item) => !item.undone).at(-1)
  if (outcome?.type === 'win') throw new Error('和牌結算須經有原因的明確撤銷流程。')
  if (!data || !match || !outcome || data.actions.some((item) => item.roundId === match.roundId) || data.drafts.some((draft) => draft.roundId === match.roundId)) throw new Error('下一局已有記錄，不能撤回上一局。')
  const rounds = data.rounds.map((round) => round.id === match.roundId ? { ...round, status: 'archived' as const } : round.id === outcome.roundId ? { ...round, status: 'active' as const } : round)
  return { ...settings, setup: structuredClone(outcome.setupBefore), gameplay: syncMatch({ ...data, rounds, activeRoundId: outcome.roundId, match: { ...match, ...outcome.before, pendingFourKan: undefined, history: match.history.map((item) => item.id === outcome.id ? { ...item, undone: true } : item), ledger: match.ledger.map((entry) => entry.id === `noten:${outcome.id}` ? { ...entry, status: 'reversed' } : entry) } }) }
}
export function resetMatch(settings: Settings, clearPlayers: boolean): Settings {
  const data = settings.gameplay
  const gameplay = data ? { ...archiveRound(data), pastMatches: [...(data.pastMatches ?? []), ...(data.match ? [data.match] : [])], match: undefined } : undefined
  return { ...settings, players: clearPlayers ? {} : settings.players, setup: newSetup(preferencesFor(settings).hongKong.dice), ...(gameplay ? { gameplay } : {}) }
}
export function frozenRiichiRules(data: GameplayData, roundId: string): JapaneseRiichiRules | undefined {
  const match = [data.match, ...(data.pastMatches ?? [])].find((item) => item?.roundId === roundId || item?.history.some((outcome) => outcome.roundId === roundId))
  return match?.rules.variant === 'riichi' ? match.rules : undefined
}
