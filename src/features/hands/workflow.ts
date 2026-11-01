import type { GameplayData, HandDraft } from '../actions/models'
import { emptyConditions } from '../scoring/models'
import type { WinConditions } from '../scoring/models'
export const ordinaryConditions = (old?: WinConditions): WinConditions => ({ ...emptyConditions(), ...old, workflow: 2, exceptional: old?.exceptional ?? false })
export function firstTurnOption(data: GameplayData, draft: HandDraft): { key: 'hkHeaven' | 'hkEarth' | 'hkHuman' | 'tenhou' | 'chiihou'; label: string } | null {
  const match = data.match
  if (!match || draft.win.specialFlower) return null
  const dealer = draft.winner === match.dealer
  if (draft.variant === 'riichi') return draft.win.method === 'tsumo' ? { key: dealer ? 'tenhou' : 'chiihou', label: dealer ? '是否天和？' : '是否地和？' } : null
  const modern = match.rules.variant === 'hong-kong' && match.rules.scoring?.firstTurn === 'v1'
  if (draft.win.method === 'tsumo') return { key: dealer ? 'hkHeaven' : modern ? 'hkEarth' : 'hkHuman', label: dealer ? '是否天糊？' : modern ? '是否地糊？' : '是否人糊（舊家規）？' }
  if (!dealer && draft.win.sourcePlayer === match.dealer && (!modern || (match.rules.variant === 'hong-kong' && match.rules.scoring?.humanWin))) return { key: modern ? 'hkHuman' : 'hkEarth', label: modern ? '是否人糊？' : '是否地糊（舊家規）？' }
  return null
}
export function reconcileFirstTurn(data: GameplayData, draft: HandDraft, conditions: WinConditions): WinConditions {
  const eligible = firstTurnOption(data, draft)?.key
  const next = { ...conditions }
  for (const key of ['hkHeaven', 'hkEarth', 'hkHuman', 'tenhou', 'chiihou'] as const) if (key !== eligible) next[key] = false
  return next
}
