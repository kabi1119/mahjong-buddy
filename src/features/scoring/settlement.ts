import type { Settings } from '../../storage/settings'
import { POSITIONS } from '../../types/mahjong'
import type { Player, PlayerPosition } from '../../types/mahjong'
import type { GameplayData, HandDraft } from '../actions/models'
import { beginRound } from '../actions/engine'
import { saveDraft } from '../hands/drafts'
import { newId } from '../hands/tiles'
import { getNextPlayer } from '../game/rules'
import { newSetup } from '../game/setup'
import type { MatchCursor, MatchState, RoundOutcome } from '../match/models'
import type { LockedWin, WinConditions } from './models'
import { evaluateWin, scoringFingerprint } from './evaluate'
import { importRoundIndicators } from './indicators'
export function lockWinningHand(data: GameplayData, draft: HandDraft, conditions: WinConditions, confirmed: boolean): GameplayData {
  if (!confirmed) throw new Error('須明確確認並鎖定，未有套用任何結算。')
  if (data.wins?.some((win) => win.roundId === data.activeRoundId && win.status !== 'reversed')) throw new Error('本局已有鎖定手牌，不可重複鎖定／結算。')
  const snapshot = { ...importRoundIndicators(data, draft), conditions: structuredClone(conditions) }
  const score = evaluateWin(data, snapshot, conditions)
  const saved = saveDraft(data, snapshot, true)
  const lockedDraft: HandDraft = structuredClone({ ...snapshot, status: 'confirmed' })
  const win: LockedWin = { version: 1, id: newId(), roundId: draft.roundId, draft: lockedDraft, conditions: structuredClone(conditions), rules: structuredClone(data.match!.rules), score, fingerprint: scoringFingerprint(data), inputFingerprint: JSON.stringify([lockedDraft, conditions, data.match!.rules]), lockedAt: Date.now(), status: 'locked' }
  return { ...saved, version: 3, wins: [...(saved.wins ?? []), win], match: { ...saved.match!, winPending: true } }
}
function cursor(match: MatchState): MatchCursor {
  const { dealer, roundWind, kyoku, sequence, honba, points, pool, phase, roundId, winPending } = match
  return structuredClone({ dealer, roundWind, kyoku, sequence, honba, points, pool, phase, roundId, winPending })
}
export function previewWinningProgression(match: MatchState, win: LockedWin): MatchCursor {
  const repeat = win.draft.winner === match.dealer
  const finalWind = match.rules.variant === 'hong-kong' ? 3 : match.rules.length === 'tonpuu' ? 0 : 1
  const points = Object.fromEntries(POSITIONS.map((seat) => [seat, match.points[seat] + win.score.deltas[seat]])) as MatchCursor['points']
  return { ...cursor(match), dealer: repeat ? match.dealer : getNextPlayer(match.dealer), kyoku: repeat ? match.kyoku : match.kyoku % 4 + 1,
    roundWind: match.roundWind + (!repeat && match.kyoku === 4 ? 1 : 0), honba: match.variant === 'riichi' && repeat ? match.honba + 1 : 0,
    sequence: match.sequence + 1, points, pool: match.pool + win.score.poolDelta, winPending: false, roundId: newId(), phase: match.roundWind >= finalWind && match.kyoku === 4 ? 'end-decision' : 'between' }
}
export function finalizeWinningRound(settings: Settings, winId: string, confirmed: boolean): Settings {
  const data = settings.gameplay; const match = data?.match; const win = data?.wins?.find((item) => item.id === winId)
  if (!confirmed || !data || !match || !win || win.status !== 'locked' || settings.setup?.phase !== 'playing' || match.phase !== 'playing' || win.roundId !== data.activeRoundId || match.roundId !== win.roundId || match.history.some((item) => item.roundId === win.roundId && !item.undone)) throw new Error('此結算未確認、已處理或不屬於目前牌局；不會重複支付。')
  if (scoringFingerprint(data) !== win.fingerprint || JSON.stringify(match.rules) !== JSON.stringify(win.rules)) throw new Error('鎖定後牌局／點數／指示牌資料改變，必須先作明確更正，不能用過時結果結算。')
  if (win.inputFingerprint !== JSON.stringify([win.draft, win.conditions, win.rules])) throw new Error('鎖定輸入快照不符，不能返回修改後繼續結算。')
  const verified = evaluateWin(data, win.draft, win.conditions)
  if (JSON.stringify(verified) !== JSON.stringify(win.score)) throw new Error('鎖定計分與重新核算結果不符；停止結算。')
  const after = previewWinningProgression(match, win)
  const outcome: RoundOutcome = { id: newId(), roundId: win.roundId, type: 'win', winId, deltas: structuredClone(win.score.deltas), poolDelta: win.score.poolDelta, before: cursor(match), after, setupBefore: structuredClone(settings.setup), undone: false, timestamp: Date.now() }
  const next = beginRound(data, settings.variant, after.dealer, settings.players as Record<PlayerPosition, Player>, after.roundId)
  return { ...settings, setup: { ...newSetup(settings.setup.hkDiceCount), dealer: after.dealer, phase: 'ready-to-roll' }, gameplay: { ...next,
    wins: data.wins!.map((item) => item.id === winId ? { ...item, status: 'finalized' } : item),
    match: { ...match, ...after, history: [...match.history, outcome], pendingFourKan: undefined,
      ledger: [...match.ledger, { id: `win:${winId}`, roundId: win.roundId, kind: 'win', deltas: structuredClone(win.score.deltas), poolDelta: win.score.poolDelta, status: 'active' }] } } }
}
export function reverseWinningSettlement(settings: Settings, winId: string, reason: string, confirmed: boolean): Settings {
  const data = settings.gameplay; const match = data?.match; const win = data?.wins?.find((item) => item.id === winId)
  const outcome = match?.history.filter((item) => !item.undone).at(-1)
  if (!confirmed || reason.trim().length < 3 || !data || !match || !win || win.status !== 'finalized' || outcome?.winId !== winId || data.actions.some((action) => action.roundId === match.roundId) || data.drafts.some((draft) => draft.roundId === match.roundId)) throw new Error('只可明確撤銷最近一次和牌結算，須填寫原因，且下一局尚未有動作／草稿。')
  const rounds = data.rounds.map((round) => round.id === outcome.roundId ? { ...round, status: 'active' as const } : round.id === match.roundId ? { ...round, status: 'archived' as const } : round)
  return { ...settings, setup: structuredClone(outcome.setupBefore), gameplay: { ...data, rounds, activeRoundId: outcome.roundId,
    wins: data.wins!.map((item) => item.id === winId ? { ...item, status: 'reversed' } : item),
    winReversals: [...(data.winReversals ?? []), { version: 1, id: newId(), winId, reason: reason.trim(), timestamp: Date.now() }],
    match: { ...match, ...outcome.before, winPending: false, pendingFourKan: undefined,
      history: match.history.map((item) => item.id === outcome.id ? { ...item, undone: true } : item), ledger: match.ledger.map((entry) => entry.id === `win:${winId}` ? { ...entry, status: 'reversed' } : entry) } } }
}
