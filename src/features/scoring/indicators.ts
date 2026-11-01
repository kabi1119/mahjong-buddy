import type { Settings } from '../../storage/settings'
import { withActiveRound } from '../actions/reconcile'
import type { GameplayData, HandDraft } from '../actions/models'
import { activeRound, projectRound } from '../actions/engine'
import { isTileType, newId, tileInstance } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
import { defaultRiichiScoreRules } from './models'
import type { RoundDora, RoundIndicator } from './models'
export function syncRoundIndicators(data: GameplayData): GameplayData {
  const round = activeRound(data)
  if (!round || round.variant !== 'riichi') return data
  const kans = projectRound(data, round.id).melds.filter((meld) => meld.tiles.length === 4)
  const profile = data.match?.rules.variant === 'riichi' ? data.match.rules.scoring ?? defaultRiichiScoreRules() : defaultRiichiScoreRules()
  const previous = round.dora?.entries ?? []
  const entries: RoundIndicator[] = [previous.find((entry) => entry.kind === 'initial') ?? { id: `initial:${round.id}`, kind: 'initial', timing: 'immediate', status: 'pending', revision: 0 }, ...kans.map((meld): RoundIndicator => previous.find((entry) => entry.kind === 'kan' && entry.meldId === meld.id) ?? { id: `kan:${meld.id}`, kind: 'kan', meldId: meld.id, timing: profile.kanReveal === 'immediate' || meld.kind === 'ankan' ? 'immediate' : 'after-discard', status: 'pending', revision: 0 })]
  if (JSON.stringify(previous) === JSON.stringify(entries)) return data
  return { ...data, version: 2, rounds: data.rounds.map((item) => item.id === round.id ? { ...item, dora: { version: 1, entries } } : item) }
}
export function updateIndicator(data: GameplayData, id: string, status: RoundIndicator['status'], type?: TileType, red = false): GameplayData {
  const synced = syncRoundIndicators(data); const round = activeRound(synced)
  if (!round || round.variant !== 'riichi' || !round.dora?.entries.some((entry) => entry.id === id)) throw new Error('此局沒有這個指示牌位置。')
  if (data.wins?.some((win) => win.roundId === round.id && win.status !== 'reversed')) throw new Error('手牌已鎖定，指示牌不可更改。')
  if (type !== undefined && (!isTileType(type) || (red && !/^5[mps]$/.test(type)))) throw new Error('未知指示牌或無效赤牌。')
  if (type && red && synced.match?.rules.variant === 'riichi' && synced.match.rules.redFives[type[1] as 'm' | 'p' | 's'] < 1) throw new Error('本局該花色未啟用赤五。')
  if (type) {
    const known = [...projectRound(synced, round.id).melds.flatMap((meld) => meld.tiles), ...round.dora.entries.filter((entry) => entry.id !== id && entry.status === 'effective' && entry.tile).map((entry) => entry.tile!)]
    if (known.filter((tile) => tile.type === type).length >= 4) throw new Error('副露及指示牌已用盡四張相同實體牌。')
  }
  if (status === 'effective' && !type) throw new Error('請輸入實際揭開的指示牌。')
  const dora: RoundDora = { version: 1, entries: round.dora.entries.map((entry) => entry.id === id ? { ...entry, status, ...(type ? { tile: { ...tileInstance(type, red), id: entry.tile?.id ?? newId() } } : {}), revision: entry.revision + 1 } : entry) }
  return { ...synced, rounds: synced.rounds.map((item) => item.id === round.id ? { ...item, dora } : item) }
}
export function effectiveIndicators(data: GameplayData, roundId: string) {
  return data.rounds.find((round) => round.id === roundId)?.dora?.entries.filter((entry) => entry.status === 'effective' && entry.tile) ?? []
}
export function importRoundIndicators(data: GameplayData, draft: HandDraft): HandDraft {
  if (draft.variant !== 'riichi') return draft
  const visible = effectiveIndicators(data, draft.roundId).map((entry) => ({ id: entry.id, kind: 'dora' as const, tile: structuredClone(entry.tile!) }))
  const old = draft.indicators.filter((entry) => entry.kind === 'dora' && !visible.some((current) => current.id === entry.id && JSON.stringify(current.tile) === JSON.stringify(entry.tile)))
  const legacy = [...new Map([...(draft.legacyIndicators ?? []), ...old].map((entry) => [entry.id + ':' + JSON.stringify(entry.tile), entry])).values()]
  return { ...draft, ...(legacy.length ? { legacyIndicators: legacy } : {}), indicators: [...visible, ...draft.indicators.filter((entry) => entry.kind === 'ura')] }
}

export function prepareRoundIndicators(settings: Settings): Settings {
  if (settings.variant !== 'riichi' || settings.setup?.phase !== 'wall-guide' || !settings.setup.dealer) return settings
  const temporary = withActiveRound({ ...settings, setup: { ...settings.setup, phase: 'playing', turn: settings.setup.dealer } })
  return { ...temporary, setup: settings.setup, gameplay: syncRoundIndicators({ ...temporary.gameplay!, match: { ...temporary.gameplay!.match!, phase: 'preparing' } }) }
}
