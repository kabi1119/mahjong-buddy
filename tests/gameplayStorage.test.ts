import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { decodeSettings, loadSettings, saveSettings } from '../src/storage/settings'
import { activeRound, beginRound, projectRound, recordAction, undoAction } from '../src/features/actions/engine'
import { createDraft, saveDraft } from '../src/features/hands/drafts'
import { reconcileGameplay } from '../src/features/actions/reconcile'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { added, fourPlayers, newGame, ponGame } from './handFixtures'
import type { Settings } from '../src/storage/settings'

const ready = updateSetup(updateSetup(newSetup(), { type: 'dealer', position: 'bottom' }), { type: 'confirm-dealer' })
const playing = updateSetup(updateSetup(ready, { type: 'rolled', dice: [1, 2, 3] }), { type: 'dealt' })
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => vi.unstubAllGlobals())
describe('version-1 records with optional versioned gameplay', () => {
  it('loads existing players and setup unchanged and adds gameplay without replacing them', async () => {
    const old: Settings = { variant: 'hong-kong', players: fourPlayers, setup: playing }
    expect(decodeSettings({ schemaVersion: 1, ...old })).toEqual(old)
    await saveSettings(old)
    expect(await loadSettings()).toEqual(old)
    const withGame = { ...old, gameplay: ponGame() }
    await saveSettings(withGame)
    expect(await loadSettings()).toEqual(withGame)
  })
  it('persists upgrades, original Pon details, undo and Riichi declarations through new connections', async () => {
    let data = recordAction(ponGame('riichi'), 'bottom', added(), 'upgrade')
    data = recordAction(data, 'right', { kind: 'riichi', confirmed: true }, 'riichi')
    await saveSettings({ variant: 'riichi', players: fourPlayers, setup: { ...playing, dice: [1, 1] }, gameplay: data })
    const restored = (await loadSettings()).gameplay!
    expect(projectRound(restored, 'round-a').melds[0]).toMatchObject({ id: 'meld-a', kind: 'shouminkan', originalPon: { kind: 'pon' } })
    expect(projectRound(restored, 'round-a').riichi[0].playerId).toBe('right')
    await saveSettings({ variant: 'riichi', players: fourPlayers, gameplay: undoAction(restored, 'upgrade') })
    expect(projectRound((await loadSettings()).gameplay!, 'round-a').melds[0]).toMatchObject({ id: 'meld-a', kind: 'pon' })
  })
  it('retains partial and confirmed drafts when archiving/resetting or changing variants', async () => {
    let data = newGame()
    data = saveDraft(data, createDraft(data, 'round-a', 'bottom'), false)
    const old: Settings = { variant: 'hong-kong', players: fourPlayers, setup: playing, gameplay: data }
    const reset = reconcileGameplay(old, { ...old, setup: newSetup() })
    expect(reset.gameplay?.activeRoundId).toBeNull()
    expect(reset.gameplay?.drafts).toEqual(data.drafts)
    const changed = reconcileGameplay(old, { ...old, variant: 'riichi', setup: newSetup() })
    expect(changed.gameplay?.drafts).toEqual(data.drafts)
    const next = beginRound(changed.gameplay!, 'riichi', 'bottom', fourPlayers, 'round-b')
    expect(projectRound(next, 'round-b').melds).toEqual([])
    await saveSettings({ ...changed, setup: { ...playing, dice: [1, 1] }, gameplay: next })
    const restored = await loadSettings()
    expect(restored.gameplay?.drafts[0]).toMatchObject({ id: data.drafts[0].id, roundId: 'round-a', status: 'draft', variant: 'hong-kong' })
    expect(activeRound(restored.gameplay)?.id).toBe('round-b')
  })
  it('protects future or corrupted gameplay payloads instead of silently dropping drafts', () => {
    const legacy = { schemaVersion: 1, variant: 'hong-kong', players: fourPlayers }
    expect(() => decodeSettings({ ...legacy, gameplay: { ...newGame(), version: 2 } })).toThrow()
    expect(() => decodeSettings({ ...legacy, gameplay: { ...newGame(), drafts: [{ bad: true }] } })).toThrow()
    expect(() => decodeSettings({ ...legacy, gameplay: { ...ponGame(), actions: [{ bad: true }] } })).toThrow()
    expect(decodeSettings(legacy).gameplay).toBeUndefined()
  })
})
