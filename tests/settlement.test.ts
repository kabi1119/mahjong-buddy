import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { lockWinningHand, finalizeWinningRound, reverseWinningSettlement } from '../src/features/scoring/settlement'
import { evaluateWin } from '../src/features/scoring/evaluate'
import { syncRoundIndicators, updateIndicator } from '../src/features/scoring/indicators'
import { recordAction, undoAction, correctAction } from '../src/features/actions/engine'
import { createDraft, logicalTileCount, physicalTileCount, saveDraft } from '../src/features/hands/drafts'
import { addSelectedTile, designateWinningTile, removeSelectedTile, refreshRecordedMelds } from '../src/features/hands/builder'
import { syncMatch, undoLatestDraw } from '../src/features/match/engine'
import { decodeSettings, loadSettings, saveSettings } from '../src/storage/settings'
import type { Settings } from '../src/storage/settings'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { draftFor, reviewedConditions, scoringGame } from './scoringFixtures'
import { added, call, fourPlayers } from './handFixtures'
const setup = updateSetup(updateSetup(updateSetup(updateSetup(newSetup(), { type: 'dealer', position: 'bottom' }), { type: 'confirm-dealer' }), { type: 'rolled', dice: [1, 1] }), { type: 'dealt' })
const settingsFor = (variant: 'riichi' | 'hong-kong' = 'riichi'): Settings => ({ variant, players: fourPlayers, setup: { ...setup, dice: variant === 'hong-kong' ? [1, 1, 1] : [1, 1] }, gameplay: scoringGame(variant) })
const conditions = reviewedConditions()
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => vi.unstubAllGlobals())
describe('locked scoring and safe settlement', () => {
  it('locks only after explicit confirmation, never moves balances at preview/lock, and reloads immutably', async () => {
    const settings = settingsFor(); const draft = draftFor('123456m55789p234s', '4s')
    expect(() => lockWinningHand(settings.gameplay!, draft, conditions, false)).toThrow()
    const data = lockWinningHand(settings.gameplay!, draft, conditions, true)
    expect(data.match!.points).toEqual({ top: 25000, right: 25000, bottom: 25000, left: 25000 })
    expect(data.match!.history).toHaveLength(0); expect(data.match!.ledger).toHaveLength(0)
    expect(() => lockWinningHand(data, draft, conditions, true)).toThrow(/已有鎖定/)
    expect(() => saveDraft(data, draft, false)).toThrow(/已鎖定/)
    await saveSettings({ ...settings, gameplay: data }); expect((await loadSettings()).gameplay!.wins).toEqual(data.wins)
    expect(() => recordAction(data, 'top', call('pon'))).toThrow(/鎖定/)
  })
  it('does not finalize invalid composition, wrong winning context or unsupported exception payments', () => {
    const data = scoringGame(); const draft = draftFor('123456m55789p234s', '4s')
    expect(() => lockWinningHand(data, { ...draft, winningTile: null }, conditions, true)).toThrow()
    expect(() => lockWinningHand(data, draft, { ...conditions, singleWinner: false }, true)).toThrow(/多家/)
    expect(() => lockWinningHand(data, draft, { ...conditions, noResponsibility: false }, true)).toThrow(/責任/)
    expect(() => lockWinningHand(data, draft, { ...conditions, ippatsu: true }, true)).toThrow(/立直/)
    expect(() => lockWinningHand(data, draft, { ...conditions, rinshan: true }, true)).toThrow(/自摸/)
    expect(() => lockWinningHand(data, { ...draft, reviewedMelds: false }, conditions, true)).toThrow(/副露/)
  })
  it('applies one atomic payment, archives the old ID and advances a non-dealer win', async () => {
    let settings = settingsFor(); settings.gameplay!.match!.honba = 2
    const data = lockWinningHand(settings.gameplay!, draftFor('123456m55789p234s', '4s'), conditions, true)
    const id = data.wins![0].id; settings = { ...settings, gameplay: data }
    expect(() => finalizeWinningRound(settings, id, false)).toThrow()
    const next = finalizeWinningRound(settings, id, true)
    expect(next.gameplay!.match).toMatchObject({ dealer: 'right', kyoku: 2, honba: 0, points: { right: 26600, bottom: 23400 }, phase: 'between' })
    expect(next.gameplay!.activeRoundId).not.toBe('round-a')
    expect(next.gameplay!.rounds.find((round) => round.id === 'round-a')!.status).toBe('archived')
    expect(next.gameplay!.match!.ledger.filter((entry) => entry.kind === 'win')).toHaveLength(1)
    expect(() => finalizeWinningRound(next, id, true)).toThrow()
    await saveSettings(next); expect(await loadSettings()).toEqual(next)
    expect(() => undoLatestDraw(next)).toThrow(/審|原因/)
  })
  it('repeats a dealer win with Honba +1 and preserves original seats', () => {
    const settings = settingsFor(); const draft = draftFor('123456m55789p234s', '4s'); draft.winner = 'bottom'; draft.win.sourcePlayer = 'right'
    settings.gameplay = lockWinningHand(settings.gameplay!, draft, conditions, true)
    const next = finalizeWinningRound(settings, settings.gameplay.wins![0].id, true)
    expect(next.gameplay!.match).toMatchObject({ dealer: 'bottom', kyoku: 1, honba: 1, points: { bottom: 26500, right: 23500 } })
    expect(next.players).toEqual(fourPlayers)
  })
  it('awards existing Riichi pool exactly once without charging a second declaration', () => {
    let settings = settingsFor(); let data = syncMatch(recordAction(settings.gameplay!, 'right', { kind: 'riichi', confirmed: true }, 'riichi-a'))
    const draft = draftFor('123456m55789p234s', '4s'); draft.indicators.push({ id: 'ura', kind: 'ura', tile: { id: 'ura-tile', type: 'west', red: false } })
    data = lockWinningHand(data, draft, conditions, true); settings = { ...settings, gameplay: data }
    const next = finalizeWinningRound(settings, data.wins![0].id, true)
    expect(next.gameplay!.match).toMatchObject({ pool: 0, points: { right: 27000, bottom: 23000 } })
    expect(Object.values(next.gameplay!.match!.points).reduce((a, b) => a + b, 0)).toBe(100000)
    expect(next.gameplay!.match!.ledger.filter((entry) => entry.kind === 'riichi')).toHaveLength(1)
  })
  it('blocks stale balances/indicators and does not accept tampered score snapshots', () => {
    const settings = settingsFor(); settings.gameplay = lockWinningHand(settings.gameplay!, draftFor('123456m55789p234s', '4s'), conditions, true)
    const id = settings.gameplay.wins![0].id
    expect(() => updateIndicator(settings.gameplay!, 'initial:round-a', 'effective', 'east')).toThrow(/鎖定/)
    const changed = structuredClone(settings); changed.gameplay!.match!.points.top += 100
    expect(() => finalizeWinningRound(changed, id, true)).toThrow(/改變/)
    const changedHand = structuredClone(settings); changedHand.gameplay!.wins![0].draft.winningTile!.red = true
    expect(() => finalizeWinningRound(changedHand, id, true)).toThrow(/鎖定輸入快照/)
    const tampered = structuredClone(settings); tampered.gameplay!.wins![0].score.han += 1
    expect(() => finalizeWinningRound(tampered, id, true)).toThrow(/不符/)
  })
  it('requires an audited reversal and restores all balances, pool and prior round', async () => {
    const settings = settingsFor(); settings.gameplay = syncMatch(recordAction(settings.gameplay!, 'right', { kind: 'riichi', confirmed: true }, 'r'))
    const draft = draftFor('123456m55789p234s', '4s'); draft.indicators = [{ id: 'u', kind: 'ura', tile: { id: 'u-tile', type: 'west', red: false } }]
    const before = structuredClone(settings.gameplay!.match)
    settings.gameplay = lockWinningHand(settings.gameplay!, draft, conditions, true); const id = settings.gameplay.wins![0].id
    const settled = finalizeWinningRound(settings, id, true)
    expect(() => reverseWinningSettlement(settled, id, '', true)).toThrow()
    const reversed = reverseWinningSettlement(settled, id, '核對後發現和牌張有誤', true)
    expect(reversed.gameplay!.activeRoundId).toBe('round-a')
    expect(reversed.gameplay!.match!.points).toEqual(before!.points); expect(reversed.gameplay!.match!.pool).toBe(1000)
    expect(reversed.gameplay!.wins![0].status).toBe('reversed')
    expect(reversed.gameplay!.winReversals![0].reason).toContain('和牌張')
    await saveSettings(reversed); expect(await loadSettings()).toEqual(reversed)
  })
  it('retains HK dealer or rotates after a non-dealer win and uses zero-based net balances', () => {
    const settings = settingsFor('hong-kong'); const draft = draftFor('123456m55789p234s', '4s', 'hong-kong')
    settings.gameplay = lockWinningHand(settings.gameplay!, draft, { ...conditions, hkBaseUnit: 1 }, true)
    expect(finalizeWinningRound(settings, settings.gameplay.wins![0].id, true).gameplay!.match).toMatchObject({ dealer: 'right', kyoku: 2, points: { right: 16, bottom: -16 } })
    const dealer = settingsFor('hong-kong'); draft.winner = 'bottom'; draft.win.sourcePlayer = 'right'
    dealer.gameplay = lockWinningHand(dealer.gameplay!, draft, { ...conditions, hkBaseUnit: 1 }, true)
    expect(finalizeWinningRound(dealer, dealer.gameplay.wins![0].id, true).gameplay!.match).toMatchObject({ dealer: 'bottom', kyoku: 1, honba: 0 })
  })
  it('migrates RC3 version-1 gameplay in memory without changing record identities', async () => {
    const settings = settingsFor('hong-kong'); settings.gameplay!.version = 1
    const action = recordAction(settings.gameplay!, 'right', call('pon', 'white', 'legacy-pon'), 'legacy-action')
    const old = { ...settings, gameplay: { ...action, version: 1 as const } }
    await saveSettings(old)
    const restored = await loadSettings()
    expect(restored.gameplay!.version).toBe(2)
    expect(restored.gameplay!.activeRoundId).toBe(old.gameplay.activeRoundId)
    expect(restored.gameplay!.actions).toEqual(old.gameplay.actions)
    expect(restored.players).toEqual(old.players)
  })
  it('fails closed on future score/indicator/audit versions and malformed conservation', () => {
    const settings = settingsFor(); settings.gameplay = lockWinningHand(settings.gameplay!, draftFor('123456m55789p234s', '4s'), conditions, true)
    const outer = { schemaVersion: 1, ...settings }
    const invalid = structuredClone(outer); invalid.gameplay!.wins![0].score.version = 99 as 1
    expect(() => decodeSettings(invalid)).toThrow()
    const dora = structuredClone(outer); dora.gameplay!.rounds[0].dora!.version = 2 as 1
    expect(() => decodeSettings(dora)).toThrow()
    const deltas = structuredClone(outer); deltas.gameplay!.wins![0].score.deltas.top = -1
    expect(() => decodeSettings(deltas)).toThrow()
  })
})
describe('round-level Kan-Dora and stable builder identities', () => {
  it('does not invent an initial indicator and creates no duplicate first position', () => {
    const data = scoringGame(); const again = syncRoundIndicators(syncRoundIndicators(data))
    expect(again.rounds[0].dora!.entries).toHaveLength(1)
    const noFirst = structuredClone(data); noFirst.rounds[0].dora!.entries[0].status = 'pending'; delete noFirst.rounds[0].dora!.entries[0].tile
    expect(() => evaluateWin(noFirst, draftFor('123456m55789p234s', '4s'), conditions)).toThrow(/初始|第一張/)
  })
  it('creates one pending Kan position per completed Kan, respecting reveal timing and undo', () => {
    let data = scoringGame(); data = recordAction(data, 'bottom', call('pon', '5p', 'meld-a'), 'pon')
    const robbed = syncRoundIndicators(recordAction(data, 'bottom', { ...added(), kanStatus: 'robbed' }, 'robbed'))
    expect(robbed.rounds[0].dora!.entries).toHaveLength(1)
    data = syncRoundIndicators(recordAction(data, 'bottom', added(), 'upgrade'))
    expect(data.rounds[0].dora!.entries[1]).toMatchObject({ meldId: 'meld-a', status: 'pending', timing: 'after-discard' })
    data = updateIndicator(data, 'kan:meld-a', 'unrevealed')
    expect(data.rounds[0].dora!.entries[1].status).toBe('unrevealed')
    expect(syncRoundIndicators(undoAction(data, 'upgrade')).rounds[0].dora!.entries).toHaveLength(1)
  })
  it('makes a concealed Kan indicator immediate, but not automatically revealed', () => {
    const data = syncRoundIndicators(recordAction(scoringGame(), 'bottom', call('ankan', '1m', 'kan-a')))
    expect(data.rounds[0].dora!.entries[1]).toMatchObject({ timing: 'immediate', status: 'pending' })
  })
  it('counts one Pon plus one Kan as six logical and seven physical tiles', () => {
    let data = scoringGame('hong-kong'); data = recordAction(data, 'right', call('pon', '1m', 'pon')); data = recordAction(data, 'right', call('ankan', '2m', 'kan'))
    const draft = createDraft(data, 'round-a', 'right')
    expect(logicalTileCount(draft)).toBe(6); expect(physicalTileCount(draft)).toBe(7)
    expect(14 - logicalTileCount(draft)).toBe(8)
  })
  it('keeps the last selected tile stable across sorting and permits designation without rebuilding', () => {
    const data = scoringGame('hong-kong'); let draft = createDraft(data, 'round-a', 'right')
    draft = addSelectedTile(draft, '9s', false); const first = draft.winningTile!.id
    draft = addSelectedTile(draft, '1m', false); const second = draft.winningTile!.id
    expect(draft.concealed[0].id).toBe(first)
    draft = designateWinningTile(draft, first); expect(draft.winningTile!.id).toBe(first)
    expect(draft.concealed.map((tile) => tile.id)).toContain(second)
    expect(() => designateWinningTile(draft, 'fixed-meld-tile')).toThrow()
    draft = removeSelectedTile(draft, first); expect(draft.winningTile!.id).toBe(second)
  })
  it('imports only active current-player melds and excludes previous/undone attempts', () => {
    let data = scoringGame('hong-kong'); data = recordAction(data, 'right', call('pon', '1m', 'keep'), 'keep-a'); data = recordAction(data, 'top', call('pon', '2m', 'other'), 'other-a'); data = recordAction(data, 'right', call('ankan', '3m', 'undone'), 'undone-a'); data = undoAction(data, 'undone-a')
    const draft = refreshRecordedMelds(data, createDraft(data, 'round-a', 'right'))
    expect(draft.melds.map((meld) => meld.id)).toEqual(['keep'])
    expect(() => correctAction({ ...data, wins: [{ roundId: 'round-a', status: 'locked' } as never] }, 'keep-a', call('pon', '1m', 'keep'))).toThrow()
  })
})
