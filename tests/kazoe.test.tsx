import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { riichiLimit, scoreRiichi } from '../src/features/scoring/riichi'
import { defaultRiichiScoreRules } from '../src/features/scoring/models'
import type { RiichiScoreRules } from '../src/features/scoring/models'
import { defaultPreferences, defaultRiichi, validateRules } from '../src/features/match/rules'
import { MatchSettings } from '../src/features/match/MatchSettings'
import { ResultPanel } from '../src/features/scoring/ResultPanel'
import { evaluateWin } from '../src/features/scoring/evaluate'
import { finalizeWinningRound, lockWinningHand } from '../src/features/scoring/settlement'
import { syncRoundIndicators, updateIndicator } from '../src/features/scoring/indicators'
import { makeMeld, recordAction } from '../src/features/actions/engine'
import { syncMatch } from '../src/features/match/engine'
import { tileInstance } from '../src/features/hands/tiles'
import { DATABASE_NAME, decodeSettings, loadSettings, saveSettings } from '../src/storage/settings'
import type { Settings } from '../src/storage/settings'
import { draftFor, reviewedConditions, scoringGame } from './scoringFixtures'
import { call, fourPlayers } from './handFixtures'
const profile = defaultRiichiScoreRules()
const uncapped = { ...profile, kazoe: 'uncapped' as const }
const conditions = reviewedConditions()
function countedHand() {
  let data = scoringGame()
  if (data.match!.rules.variant !== 'riichi') throw Error('Riichi fixture required')
  data.match!.rules.scoring = uncapped
  for (const player of ['right', 'bottom'] as const) data = syncMatch(recordAction(data, player, { kind: 'riichi', confirmed: true }))
  for (const [index, tile] of (['east', 'south', 'white', 'red'] as const).entries()) data = syncMatch(recordAction(data, index % 2 ? 'left' : 'top', call('ankan', tile, 'kan-' + index)))
  data = syncRoundIndicators(data)
  for (const [index, entry] of data.rounds[0].dora!.entries.entries()) data = updateIndicator(data, entry.id, 'effective', (['1m', '1m', '2m', '2m', '8m'] as const)[index])
  data.match!.honba = 2
  const draft = draftFor('11223344556677m', '7m')
  draft.concealed.find((tile) => tile.type === '5m')!.red = true
  draft.indicators = (['3m', '3m', '4m', '8s', '8p'] as const).map((type, index) => ({ id: 'ura-' + index, kind: 'ura', tile: tileInstance(type) }))
  const settings: Settings = { variant: 'riichi', players: fourPlayers, setup: { version: 1, hkDiceCount: 3, dealer: 'bottom', phase: 'playing', dice: [1, 1], turn: 'bottom' }, gameplay: data }
  return { settings, draft }
}
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('RC5 counted limit boundaries', () => {
  it.each([12, 13, 25, 26, 52])('keeps the default policy unchanged at %i Han', (han) => {
    expect(riichiLimit(han, 30, 0, profile)).toEqual(han === 12 ? { basePoints: 6000, label: '三倍滿', tier: 4 } : { basePoints: 8000, label: '累計役滿', tier: 5 })
  })
  it.each([[13, 1, '累計役滿', 5], [25, 1, '累計役滿', 5], [26, 2, '累計雙倍役滿', 6], [38, 2, '累計雙倍役滿', 6], [39, 3, '累計三倍役滿', 7], [51, 3, '累計三倍役滿', 7], [52, 4, '累計四倍役滿', 8], [64, 4, '累計四倍役滿', 8], [65, 5, '累計5 倍役滿', 8], [130, 10, '累計10 倍役滿', 8]] as const)('scores uncapped %i Han as %ix', (han, multiple, label, tier) => {
    expect(riichiLimit(han, 30, 0, uncapped)).toEqual({ basePoints: multiple * 8000, label, tier })
    expect(tier).toBe(riichiLimit(0, 0, multiple, profile).tier)
  })
  it.each([13, 25, 26, 39, 52, 130])('caps %i Han at Sanbaiman under the capped policy', (han) => expect(riichiLimit(han, 30, 0, { ...profile, kazoe: 'sanbaiman' })).toEqual({ basePoints: 6000, label: '三倍滿（累計上限）', tier: 4 }))
  it('does not apply uncapped policy below 13 Han or add counted multiples to genuine Yakuman', () => {
    expect(riichiLimit(12, 30, 0, uncapped)).toEqual({ basePoints: 6000, label: '三倍滿', tier: 4 })
    expect(riichiLimit(52, 30, 3, uncapped)).toEqual({ basePoints: 24000, label: '三倍役滿', tier: 7 })
    const hand = draftFor('111222333444z55z', 'white')
    expect(scoreRiichi(hand, { ...defaultRiichi(), scoring: uncapped }, conditions, true, 28, 27)).toMatchObject({ han: 0, yakuman: 3, basePoints: 24000, label: '三倍役滿' })
  })
  it('still rejects a Dora-only open hand', () => {
    const hand = draftFor('123m456p789s234m55p', '5p'); hand.concealed = hand.concealed.slice(3)
    hand.melds = [makeMeld('chi', '1m', 'right', hand.roundId, 'riichi')]
    hand.indicators = [{ id: 'dora', kind: 'dora', tile: tileInstance('4p') }]
    expect(() => scoreRiichi(hand, { ...defaultRiichi(), scoring: uncapped }, conditions, false, 28, 27)).toThrow(/役/)
  })
})
describe('RC5 counted scoring through existing payments and storage', () => {
  it.each([['right', 'ron', [64600], 66600], ['bottom', 'ron', [96600], 98600], ['right', 'tsumo', [16200, 16200, 32200], 66600], ['bottom', 'tsumo', [32200, 32200, 32200], 98600]] as const)('settles %s %s with Honba and existing sticks', (winner, method, payments, total) => {
    const { settings, draft } = countedHand(); draft.winner = winner
    draft.win = { method, sourcePlayer: method === 'ron' ? winner === 'right' ? 'bottom' : 'right' : null, specialFlower: false }
    const before = structuredClone(settings.gameplay!.match!.points)
    const score = evaluateWin(settings.gameplay!, draft, conditions)
    expect(score).toMatchObject({ han: method === 'ron' ? 26 : 27, yakuman: 0, basePoints: 16000, label: '累計雙倍役滿', tier: 6, winnerTotal: total, poolDelta: -2000, bonuses: { dora: 2, kanDora: 6, ura: 2, kanUra: 4, redDora: 1 } })
    expect(score.payments.map((p) => p.amount).sort((a, b) => a - b)).toEqual([...payments])
    expect(Object.values(score.deltas).reduce((a, b) => a + b, 0) + score.poolDelta).toBe(0)
    const locked = lockWinningHand(settings.gameplay!, draft, conditions, true)
    expect(locked.match!.points).toEqual(before)
    const id = locked.wins![0].id
    const paid = finalizeWinningRound({ ...settings, gameplay: locked }, id, true)
    expect(paid.gameplay!.match!.points[winner]).toBe(before[winner] + total)
    expect(paid.gameplay!.match!.pool).toBe(0)
    expect(paid.gameplay!.match!.ledger.filter((entry) => entry.kind === 'win')).toHaveLength(1)
    expect(paid.gameplay!.match!.dealer).toBe(winner === 'bottom' ? 'bottom' : 'right')
    expect(paid.gameplay!.match!.honba).toBe(winner === 'bottom' ? 3 : 0)
    expect(() => finalizeWinningRound(paid, id, true)).toThrow(/不會重複支付/)
  })
  it.each(['yakuman', 'sanbaiman', 'uncapped', undefined] as const)('round-trips %s preferences without changing the frozen active policy', async (kazoe) => {
    const settings: Settings = { variant: 'riichi', players: fourPlayers, preferences: defaultPreferences(), setup: { version: 1, hkDiceCount: 3, dealer: 'bottom', phase: 'playing', dice: [1, 1], turn: 'bottom' }, gameplay: scoringGame() }
    settings.preferences!.riichi.scoring = kazoe ? { ...profile, kazoe } : undefined
    const before = structuredClone(settings.gameplay)
    await saveSettings(settings)
    const restored = await loadSettings()
    expect(restored.preferences).toEqual(settings.preferences)
    expect(restored.gameplay).toEqual(before)
    expect(DATABASE_NAME).toBe('mahjong-companion')
    expect(defaultRiichiScoreRules().kazoe).toBe('yakuman')
  })
  it('round-trips an RC5 locked snapshot and keeps an RC4 locked snapshot payable', async () => {
    const { settings, draft } = countedHand()
    settings.gameplay = lockWinningHand(settings.gameplay!, draft, conditions, true)
    await saveSettings(settings)
    const restored = await loadSettings()
    expect(restored.gameplay!.wins).toEqual(settings.gameplay.wins)
    expect(finalizeWinningRound(restored, restored.gameplay!.wins![0].id, true).gameplay!.match!.pool).toBe(0)
    const old = scoringGame(); old.match!.rules = { ...defaultRiichi(), scoring: { ...profile, kazoe: 'yakuman' } }
    const oldLock = lockWinningHand(old, draftFor('123456m55789p234s', '4s'), conditions, true)
    const decoded = decodeSettings({ schemaVersion: 1, variant: 'riichi', players: fourPlayers, setup: settings.setup, gameplay: oldLock })
    expect(decoded.gameplay!.wins).toEqual(oldLock.wins)
    expect(finalizeWinningRound(decoded, oldLock.wins![0].id, true).gameplay!.wins![0].status).toBe('finalized')
    expect(validateRules({ ...defaultRiichi(), scoring: { ...profile, kazoe: 'unknown' as RiichiScoreRules['kazoe'] } })).not.toEqual([])
  })
})
describe('RC5 settings and presentation', () => {
  it('offers the three exact labels and saves uncapped as an explicit opt-in', () => {
    const settings: Settings = { variant: 'riichi', players: fourPlayers, preferences: defaultPreferences() }
    const save = vi.fn(); render(<MatchSettings settings={settings} onSave={save} onClose={() => {}} />)
    const select = screen.getByRole('combobox', { name: '累計役滿規則' })
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['單倍累計役滿（預設）', '三倍滿封頂', '無封頂累計役滿'])
    expect(select).toHaveProperty('value', 'yakuman')
    fireEvent.change(select, { target: { value: 'uncapped' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存設定' }))
    const changed = save.mock.calls[0][0](settings) as Settings
    expect(changed.preferences!.riichi.scoring!.kazoe).toBe('uncapped')
    expect(changed.preferences!.hongKong).toEqual(settings.preferences!.hongKong)
  })
  it('keeps the active match policy frozen even when future preferences differ', () => {
    const settings: Settings = { variant: 'riichi', players: fourPlayers, preferences: defaultPreferences(), gameplay: scoringGame() }
    settings.preferences!.riichi.scoring = uncapped
    render(<MatchSettings settings={settings} onSave={vi.fn()} onClose={() => {}} />)
    const select = screen.getByRole('combobox', { name: '累計役滿規則' })
    expect(select).toHaveProperty('value', 'yakuman')
    expect(select.closest('fieldset')).toHaveProperty('disabled', true)
  })
  it('shows actual counted Han, keeps breakdowns, respects reduced motion and never pays on replay', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const { settings, draft } = countedHand(); settings.gameplay = lockWinningHand(settings.gameplay!, draft, conditions, true)
    const win = settings.gameplay.wins![0]
    const paid = finalizeWinningRound(settings, win.id, true)
    const onUpdate = vi.fn()
    const view = render(<ResultPanel settings={paid} win={paid.gameplay!.wins![0]} onUpdate={onUpdate} onClose={() => {}} storageStatus="saved" />)
    expect(screen.getByText('26 飜')).toBeTruthy()
    expect(screen.getByText('二盃口')).toBeTruthy()
    expect(screen.getByText(/符數明細/)).toBeTruthy()
    expect(view.container.querySelector('.victory-reveal.tier-6.motion-reduced')).toBeTruthy()
    expect(view.container.querySelector('.victory-title')!.textContent).toBe('累計雙倍役滿')
    expect(view.container.querySelector('animate, .gold-spark')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重播結果動畫' }))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(paid.gameplay!.match!.ledger.filter((entry) => entry.kind === 'win')).toHaveLength(1)
  })
})
