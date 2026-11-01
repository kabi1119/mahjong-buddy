import { POSITIONS } from '../../types/mahjong'
import { isTileType } from '../hands/tiles'
import { validateRules } from '../match/rules'
import type { GameplayData } from '../actions/models'
import type { WinConditions } from './models'
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown) => Number.isSafeInteger(value)
const tile = (value: unknown) => object(value) && typeof value.id === 'string' && !!value.id && isTileType(value.type) && typeof value.red === 'boolean' && (!value.red || /^5[mps]$/.test(value.type))
export function validConditions(value: unknown): value is WinConditions {
  if (!object(value) || value.version !== 1 || (value.workflow !== undefined && value.workflow !== 2) || (value.exceptional !== undefined && typeof value.exceptional !== 'boolean') || (value.workflow === 2 && typeof value.exceptional !== 'boolean')) return false
  const keys = ['reviewed', 'legalWinConfirmed', 'singleWinner', 'noResponsibility', 'doubleRiichi', 'ippatsu', 'rinshan', 'chankan', 'haitei', 'houtei', 'tenhou', 'chiihou', 'hkHeaven', 'hkEarth', 'hkHuman', 'consecutiveKan']
  return keys.every((key) => typeof value[key] === 'boolean') && (value.hkBaseUnit === undefined || (integer(value.hkBaseUnit) && Number(value.hkBaseUnit) > 0))
}
export function validateScoringStorage(data: GameplayData, validDraft: (draft: unknown) => boolean): void {
  for (const round of data.rounds) {
    if (round.dora === undefined) continue
    const dora = round.dora
    if (round.variant !== 'riichi' || !dora || dora.version !== 1 || !Array.isArray(dora.entries) || dora.entries.length > 5 || dora.entries.filter((entry) => entry.kind === 'initial').length !== 1 || new Set(dora.entries.map((entry) => entry.id)).size !== dora.entries.length || new Set(dora.entries.filter((entry) => entry.tile).map((entry) => entry.tile!.id)).size !== dora.entries.filter((entry) => entry.tile).length || dora.entries.some((entry) => !entry || typeof entry.id !== 'string' || !['initial', 'kan'].includes(entry.kind) || !['immediate', 'after-discard'].includes(entry.timing) || !['pending', 'effective', 'unrevealed', 'deferred'].includes(entry.status) || !integer(entry.revision) || entry.revision < 0 || (entry.kind === 'kan' && typeof entry.meldId !== 'string') || (entry.tile !== undefined && !tile(entry.tile)) || (entry.status === 'effective' && !entry.tile))) throw new Error('未知或損壞的牌局寶牌資料；保留原資料。')
  }
  for (const draft of data.drafts) if ((draft.conditions !== undefined && !validConditions(draft.conditions)) || (draft.reviewedMelds !== undefined && typeof draft.reviewedMelds !== 'boolean')) throw new Error('未知的手牌情境版本。')
  if (data.wins !== undefined) {
    if (!Array.isArray(data.wins) || new Set(data.wins.map((win) => win.id)).size !== data.wins.length) throw new Error('和牌鎖定記錄無效。')
    for (const win of data.wins) {
      if (!win || win.version !== 1 || typeof win.id !== 'string' || !data.rounds.some((round) => round.id === win.roundId) || !validDraft(win.draft) || win.draft.roundId !== win.roundId || win.draft.status !== 'confirmed' || !validConditions(win.conditions) || !win.rules || validateRules(win.rules).length || win.rules.variant !== win.draft.variant || !['locked', 'finalized', 'reversed'].includes(win.status) || typeof win.fingerprint !== 'string' || typeof win.inputFingerprint !== 'string' || win.inputFingerprint !== JSON.stringify([win.draft, win.conditions, win.rules]) || !integer(win.lockedAt)) throw new Error('未知或損壞的鎖定手牌；不覆寫。')
      const score = win.score
      if (!score || score.version !== 1 || score.variant !== win.rules.variant || !['han', 'fu', 'yakuman', 'fan', 'rawFan', 'basePoints', 'tier', 'winnerTotal'].every((key) => integer(score[key as keyof typeof score]) && Number(score[key as keyof typeof score]) >= 0) || typeof score.label !== 'string' || typeof score.interpretation !== 'string' || !Array.isArray(score.components) || score.components.some((item) => typeof item.name !== 'string' || !integer(item.value) || item.value < 0 || !['fan', 'yaku', 'bonus', 'yakuman'].includes(item.kind)) || !Array.isArray(score.fuBreakdown) || score.fuBreakdown.some((item) => typeof item.name !== 'string' || !integer(item.value) || item.value < 0) || !POSITIONS.every((seat) => integer(score.deltas?.[seat])) || !integer(score.poolDelta) || score.poolDelta > 0 || score.poolDelta % 1000 || Object.values(score.deltas).reduce((a, b) => a + b, 0) + score.poolDelta !== 0 || !Array.isArray(score.payments) || score.payments.some((item) => !POSITIONS.includes(item.from) || item.to !== win.draft.winner || item.from === item.to || !integer(item.amount) || item.amount < 0 || typeof item.reason !== 'string')) throw new Error('和牌計分／付款快照無效。')
      if (score.bonuses && ![score.bonuses.dora, score.bonuses.kanDora, score.bonuses.ura, score.bonuses.kanUra, score.bonuses.redDora].every((amount) => Number.isSafeInteger(amount) && amount >= 0)) throw new Error('寶牌分項資料無效。')
      const expected = Object.fromEntries(POSITIONS.map((seat) => [seat, 0])) as typeof score.deltas
      for (const payment of score.payments) { expected[payment.from] -= payment.amount; expected[payment.to] += payment.amount }
      expected[win.draft.winner] -= score.poolDelta
      if (POSITIONS.some((seat) => expected[seat] !== score.deltas[seat]) || score.winnerTotal !== score.deltas[win.draft.winner]) throw new Error('結算帳目不守恆。')
    }
  }
  const allMatches = [data.match, ...(data.pastMatches ?? [])].filter((match) => match !== undefined)
  for (const match of allMatches) {
    for (const outcome of match.history.filter((item) => item.type === 'win')) {
      const win = data.wins?.find((item) => item.id === outcome.winId)
      const ledger = match.ledger.find((entry) => entry.id === 'win:' + outcome.winId)
      if (!win || win.roundId !== outcome.roundId || JSON.stringify(win.score.deltas) !== JSON.stringify(outcome.deltas) || win.score.poolDelta !== outcome.poolDelta || (outcome.undone ? win.status !== 'reversed' : win.status !== 'finalized') || !ledger || ledger.roundId !== win.roundId || ledger.poolDelta !== win.score.poolDelta || POSITIONS.some((seat) => ledger.deltas[seat] !== win.score.deltas[seat]) || ledger.status !== (outcome.undone ? 'reversed' : 'active')) throw new Error('和牌結果、付款帳本與鎖定快照參照不符。')
    }
    for (const entry of match.ledger.filter((item) => item.kind === 'win')) if (!data.wins?.some((win) => entry.id === 'win:' + win.id && entry.roundId === win.roundId)) throw new Error('和牌帳本含未知或重複交易。')
  }
  for (const win of data.wins ?? []) {
    if (win.status === 'finalized' && !allMatches.some((match) => match.history.some((outcome) => outcome.winId === win.id && !outcome.undone))) throw new Error('和牌結算缺少對應歷史。')
    if (win.status === 'reversed' && !data.winReversals?.some((entry) => entry.winId === win.id)) throw new Error('和牌撤銷缺少審計原因。')
  }
  const activeRoundIds = (data.wins ?? []).filter((win) => win.status !== 'reversed').map((win) => win.roundId)
  if (new Set(activeRoundIds).size !== activeRoundIds.length) throw new Error('同一實體局有重複和牌結算。')
  if (data.winReversals !== undefined && (!Array.isArray(data.winReversals) || new Set(data.winReversals.map((item) => item.id)).size !== data.winReversals.length || data.winReversals.some((item) => !item || item.version !== 1 || typeof item.id !== 'string' || !data.wins?.some((win) => win.id === item.winId) || typeof item.reason !== 'string' || item.reason.trim().length < 3 || !integer(item.timestamp)))) throw new Error('和牌撤銷審計記錄無效。')
}
