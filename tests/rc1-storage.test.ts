import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { decodeSettings, loadSettings, saveSettings } from '../src/storage/settings'
import { createMatch, finalizeDraw, getFourKanDrawEligibility, syncMatch, prepareNext, undoLatestDraw } from '../src/features/match/engine'
import { defaultPreferences, defaultRiichi } from '../src/features/match/rules'
import { recordAction, correctAction } from '../src/features/actions/engine'
import { reconcileGameplay } from '../src/features/actions/reconcile'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { call, fourPlayers, newGame } from './handFixtures'
import type { Settings } from '../src/storage/settings'
const ready = updateSetup(updateSetup(newSetup(), { type: 'dealer', position: 'bottom' }), { type: 'confirm-dealer' })
const playing = updateSetup(updateSetup(ready, { type: 'rolled', dice: [1, 1] }), { type: 'dealt' })
const fixture = (): Settings => { const data = newGame('riichi'); return { variant: 'riichi', players: fourPlayers, setup: playing, preferences: defaultPreferences(), gameplay: { ...data, match: createMatch(data, defaultRiichi(), false) } } }
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => vi.unstubAllGlobals())
describe('RC1 additive persisted match record', () => {
  it('keeps next-hand identity and frozen rules through preparation, reload and dealing', async () => {
    const initial = fixture()
    const drawn = finalizeDraw(initial, 'round-a', 'exhaustive-draw', { top: false, right: true, bottom: false, left: false }, true)
    await saveSettings(drawn); const restored = await loadSettings()
    expect(restored).toEqual(drawn)
    const next = prepareNext(restored)
    const rolled = { ...next, setup: updateSetup(next.setup!, { type: 'rolled', dice: [2, 2] }) }
    const dealt = reconcileGameplay(rolled, { ...rolled, setup: updateSetup(rolled.setup!, { type: 'dealt' }) })
    expect(dealt.gameplay?.activeRoundId).toBe(restored.gameplay?.activeRoundId)
    expect(dealt.gameplay?.match).toMatchObject({ phase: 'playing', honba: 1, dealer: 'right', rules: { startingPoints: 25000 } })
    expect(dealt.gameplay?.rounds).toHaveLength(2)
  })
  it('rejects future rule/match/setup versions instead of dropping them', () => {
    const settings = fixture(); const outer = { schemaVersion: 1, ...settings }
    expect(() => decodeSettings({ ...outer, preferences: { ...settings.preferences, version: 2 } })).toThrow()
    expect(() => decodeSettings({ ...outer, gameplay: { ...settings.gameplay, match: { ...settings.gameplay?.match, version: 2 } } })).toThrow()
    expect(() => decodeSettings({ ...outer, setup: { ...playing, version: 2 } })).toThrow()
    expect(() => decodeSettings({ ...outer, themePreference: 'future' })).toThrow()
  })
  it('counts all Kan types once, persists pending and removes it after a robbed correction', async () => {
    let settings = fixture(); let data = settings.gameplay!
    data = recordAction(data, 'bottom', call('pon', '1m', 'pon-a'), 'pon')
    data = recordAction(data, 'bottom', { kind: 'shouminkan', tile: '1m', meldId: 'pon-a', targetMeldId: 'pon-a', physicalConfirmed: true, kanStatus: 'completed' }, 'upgrade')
    data = recordAction(data, 'bottom', call('ankan', '2m', 'kan-b'), 'ankan')
    data = recordAction(data, 'right', call('daiminkan', '3m', 'kan-c'), 'open')
    data = recordAction(data, 'right', call('ankan', '4m', 'kan-d'), 'fourth')
    settings = { ...settings, gameplay: syncMatch(data) }; await saveSettings(settings)
    const restored = await loadSettings()
    expect(getFourKanDrawEligibility(restored.gameplay!, defaultRiichi())).toMatchObject({ count: 4, distinctPlayers: 2, eligible: true })
    expect(restored.gameplay?.match?.pendingFourKan?.status).toBe('pending')
    const corrected = syncMatch(correctAction(restored.gameplay!, 'fourth', { ...call('ankan', '4m', 'kan-d'), kanStatus: 'robbed' }))
    expect(corrected.match?.pendingFourKan).toBeUndefined()
    expect(getFourKanDrawEligibility(corrected, defaultRiichi()).count).toBe(3)
  })
  it('preserves disabled policy after reload and still prevents a fifth Kan', async () => {
    const settings = fixture(); settings.gameplay!.match!.rules = { ...defaultRiichi(), fourKanAbortive: false }
    for (let index = 0; index < 4; index++) settings.gameplay = recordAction(settings.gameplay!, index < 2 ? 'bottom' : 'right', call('ankan', (['1m', '2m', '3m', '4m'] as const)[index], 'k-' + index))
    settings.gameplay = syncMatch(settings.gameplay!); await saveSettings(settings)
    const data = (await loadSettings()).gameplay!
    expect(data.match?.pendingFourKan).toBeUndefined()
    expect(() => recordAction(data, 'top', call('ankan', '9p', 'fifth'))).toThrow()
  })
  it('refuses undo once the next hand has recorded player actions', () => {
    const drawn = finalizeDraw(fixture(), 'round-a', 'exhaustive-draw', { top: false, right: false, bottom: false, left: false }, true)
    const prepared = prepareNext(drawn)
    const playingNext = { ...prepared.gameplay!, match: { ...prepared.gameplay!.match!, phase: 'playing' as const } }
    const data = recordAction(playingNext, 'right', call('pon', 'white', 'new'))
    expect(() => undoLatestDraw({ ...prepared, gameplay: data })).toThrow(/下一局已有記錄/)
  })
})
