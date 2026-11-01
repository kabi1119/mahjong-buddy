import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { evaluateWin, isOrdinaryTileAvailable } from '../src/features/scoring/evaluate'
import { importRoundIndicators, syncRoundIndicators, updateIndicator } from '../src/features/scoring/indicators'
import { lockWinningHand } from '../src/features/scoring/settlement'
import { recordAction, projectRound, undoAction } from '../src/features/actions/engine'
import { createDraft, saveDraft } from '../src/features/hands/drafts'
import { finalizeDraw } from '../src/features/match/engine'
import { decodeSettings, loadSettings, saveSettings } from '../src/storage/settings'
import { tileInstance } from '../src/features/hands/tiles'
import { draftFor, reviewedConditions, scoringGame } from './scoringFixtures'
import { correctRecordedRedCount } from '../src/features/hands/builder'
import { added, call, fourPlayers } from './handFixtures'
const conditions = reviewedConditions()
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => vi.unstubAllGlobals())
describe('scoring boundaries and migration safety', () => {
  it('counts only actually effective Kan-Dora and uses the same set for every winner', () => {
    let data = syncRoundIndicators(recordAction(scoringGame(), 'top', call('daiminkan', '9m', 'kan-nine')))
    data = updateIndicator(data, 'kan:kan-nine', 'unrevealed')
    const draft = draftFor('123456m55789p234s', '4s')
    expect(evaluateWin(data, draft, conditions).han).toBe(1)
    data = updateIndicator(data, 'kan:kan-nine', 'effective', '4p')
    expect(evaluateWin(data, draft, conditions)).toMatchObject({ han: 3, fu: 30, winnerTotal: 3900 })
    const other = { ...draft, winner: 'left' as const }
    expect(importRoundIndicators(data, other).indicators.filter((entry) => entry.kind === 'dora')).toEqual(importRoundIndicators(data, draft).indicators.filter((entry) => entry.kind === 'dora'))
  })
  it('blocks unknown Kan reveal states and missing mandatory immediate indicators', () => {
    let data = syncRoundIndicators(recordAction(scoringGame(), 'top', call('ankan', '9m', 'kan-nine')))
    const draft = draftFor('123456m55789p234s', '4s')
    expect(() => evaluateWin(data, draft, conditions)).toThrow(/新槓寶牌/)
    data = updateIndicator(data, 'kan:kan-nine', 'unrevealed')
    expect(() => evaluateWin(data, draft, conditions)).toThrow(/即時槓寶牌/)
  })
  it('blocks known responsibility-payment patterns rather than generating ordinary amounts', () => {
    let data = scoringGame()
    for (const tile of ['white', 'green', 'red'] as const) data = recordAction(data, 'right', { ...call('pon', tile, 'dragon-' + tile), sourcePlayer: 'bottom' })
    const draft = createDraft(data, 'round-a', 'right'); draft.concealed = ['1m', '2m', '3m', '2p'].map((type) => tileInstance(type as '1m')); draft.winningTile = tileInstance('2p'); draft.reviewedMelds = true
    expect(() => evaluateWin(data, draft, conditions)).toThrow(/責任支付/)
  })
  it('requires recorded final melds and manual confirmation of untracked physical win legality', () => {
    const data = scoringGame(); const draft = draftFor('123456m55789p234s', '4s')
    expect(() => evaluateWin(data, draft, { ...conditions, legalWinConfirmed: false })).toThrow(/振聽/)
    const withCall = recordAction(data, 'right', call('pon', 'white', 'extra'))
    expect(() => evaluateWin(withCall, draft, conditions)).toThrow(/最後副露/)
  })
  it('refuses to infer a closed hand from an invalid recorded meld that projection cannot apply', () => {
    const data = recordAction(scoringGame(), 'right', call('pon', 'white', 'invalid-source'))
    const action = data.actions.at(-1)!
    if (action.kind === 'pon') action.sourcePlayer = 'right'
    expect(() => evaluateWin(data, draftFor('123456m55789p234s', '4s'), conditions)).toThrow(/未能套用的動作記錄/)
  })
  it('shares red/normal five capacity, including actual indicator copies', () => {
    const data = scoringGame(); const draft = createDraft(data, 'round-a', 'right')
    draft.concealed = [tileInstance('5m'), tileInstance('5m'), tileInstance('5m')]
    expect(isOrdinaryTileAvailable(data, draft, '5m', false)).toBe(false)
    expect(isOrdinaryTileAvailable(data, draft, '5m', true)).toBe(true)
    draft.winningTile = tileInstance('5m', true)
    expect(isOrdinaryTileAvailable(data, draft, '5m', true)).toBe(false)
    expect(isOrdinaryTileAvailable(data, draft, '5m', false)).toBe(false)
  })
  it('keeps unknown exposed fives selectable, then requires explicit shared composition before locking', () => {
    let data = recordAction(scoringGame(), 'top', call('pon', '5m', 'other-five'))
    const draft = draftFor('123456m55789p234s', '4s')
    const partial = structuredClone(draft); partial.concealed = partial.concealed.filter((tile) => tile.type !== '5m')
    expect(isOrdinaryTileAvailable(data, partial, '5m')).toBe(true)
    expect(() => evaluateWin(data, draft, conditions)).toThrow(/其他牌友副露/)
    const ordinary = correctRecordedRedCount(data, 'other-five', 0)
    expect(() => evaluateWin(ordinary, draft, conditions)).toThrow(/實體供應量/)
    data = correctRecordedRedCount(data, 'other-five', 1)
    expect(evaluateWin(data, draft, conditions)).toMatchObject({ han: 1, fu: 30, winnerTotal: 1000 })
  })
  it('preserves original Pon identity and places a newly added red five in the fourth physical position', () => {
    let data = recordAction(scoringGame(), 'top', { ...call('pon', '5p', 'five-pon'), redCount: 0 }, 'five-call')
    const pon = structuredClone(projectRound(data, 'round-a').melds[0])
    data = recordAction(data, 'top', { ...added('five-pon'), redCount: 1 }, 'five-upgrade')
    const kan = projectRound(data, 'round-a').melds[0]
    expect(kan.tiles.slice(0, 3)).toEqual(pon.tiles)
    expect(kan.tiles[3]).toMatchObject({ id: 'five-upgrade:fourth', red: true })
    expect(kan.originalPon).toEqual(pon)
    expect(projectRound(undoAction(data, 'five-upgrade'), 'round-a').melds[0]).toEqual(pon)
  })
  it('does not invent the fourth five colour for a legacy Added Kan, and retains corrections on reload', async () => {
    let data = recordAction(scoringGame(), 'top', { ...call('pon', '5p', 'five-pon'), redCount: 0 })
    data = recordAction(data, 'top', added('five-pon'))
    expect(projectRound(data, 'round-a').melds[0].redCount).toBeNull()
    expect(() => correctRecordedRedCount(data, 'five-pon', 2)).toThrow(/原有碰牌/)
    data = correctRecordedRedCount(data, 'five-pon', 1)
    await saveSettings({ variant: 'riichi', players: fourPlayers, gameplay: data })
    expect(projectRound((await loadSettings()).gameplay!, 'round-a').melds[0].tiles[3].red).toBe(true)
  })
  it('retains old private indicators for review without silently treating them as shared revealed tiles', async () => {
    const data = scoringGame(); const draft = draftFor('123456m55789p234s', '4s')
    const legacy = { id: 'rc3-private-indicator', kind: 'dora' as const, tile: tileInstance('3m') }; draft.indicators = [legacy]
    const imported = importRoundIndicators(data, draft)
    expect(imported.legacyIndicators).toEqual([legacy])
    expect(imported.indicators.filter((entry) => entry.kind === 'dora').map((entry) => entry.tile.type)).toEqual(['west'])
    await saveSettings({ variant: 'riichi', players: fourPlayers, gameplay: saveDraft(data, imported, false) })
    expect((await loadSettings()).gameplay!.drafts[0].legacyIndicators).toEqual([legacy])
  })
  it('does not let an incorrect winPending flag bypass a locked winning snapshot', () => {
    const data = lockWinningHand(scoringGame(), draftFor('123456m55789p234s', '4s'), conditions, true)
    data.match!.winPending = false
    expect(() => finalizeDraw({ variant: 'riichi', players: fourPlayers, gameplay: data, setup: { version: 1, hkDiceCount: 3, dealer: 'bottom', phase: 'playing', dice: [1, 1], turn: 'bottom' } }, 'round-a', 'exhaustive-draw', { top: false, right: false, bottom: false, left: false }, true)).toThrow(/鎖定/)
  })
  it('calculates different half/full-la payments from explicit identical units', () => {
    const data = scoringGame('hong-kong'); const draft = draftFor('123456m55789p234s', '4s', 'hong-kong')
    draft.flowers = ['spring', 'summer', 'autumn', 'winter', 'orchid']
    expect(evaluateWin(data, draft, { ...conditions, hkBaseUnit: 1 })).toMatchObject({ fan: 5, winnerTotal: 48 })
    data.match!.rules = { ...data.match!.rules, payment: 'full-la' } as typeof data.match.rules
    expect(evaluateWin(data, draft, { ...conditions, hkBaseUnit: 1 })).toMatchObject({ fan: 5, winnerTotal: 64 })
  })
  it('blocks a payment that would overflow a persisted player balance', () => {
    const data = scoringGame(); data.match!.points.right = Number.MAX_SAFE_INTEGER
    expect(() => evaluateWin(data, draftFor('123456m55789p234s', '4s'), conditions)).toThrow(/整數範圍/)
  })
  it('keeps legacy fractional payout preferences readable, but refuses fractional payment', () => {
    const data = scoringGame('hong-kong')
    data.match!.rules = { ...data.match!.rules, payment: 'custom', payouts: Array.from({ length: 11 }, (_, index) => ({ fan: index + 3, ron: 12.5, tsumo: 5.5 })) } as typeof data.match.rules
    expect(() => decodeSettings({ schemaVersion: 1, variant: 'hong-kong', players: fourPlayers, gameplay: data })).not.toThrow()
    expect(() => evaluateWin(data, draftFor('123456m55789p234s', '4s', 'hong-kong'), conditions)).toThrow(/整數/)
  })
})
