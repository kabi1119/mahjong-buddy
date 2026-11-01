import { describe, expect, it } from 'vitest'
import { createMatch, calculateNotenPayments, finalizeDraw, getFourKanDrawEligibility, getKanSummary, prepareNext, previewDraw, syncMatch, undoLatestDraw, resetMatch } from '../src/features/match/engine'
import { defaultHK, defaultRiichi } from '../src/features/match/rules'
import { beginRound, recordAction, undoAction } from '../src/features/actions/engine'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { call, added, fourPlayers, newGame } from './handFixtures'
import type { Settings } from '../src/storage/settings'
import type { GameplayData } from '../src/features/actions/models'
import { POSITIONS } from '../src/types/mahjong'
const playing = updateSetup(updateSetup(updateSetup(updateSetup(newSetup(), { type: 'dealer', position: 'bottom' }), { type: 'confirm-dealer' }), { type: 'rolled', dice: [1, 1] }), { type: 'dealt' })
function fixture(variant: 'hong-kong' | 'riichi' = 'riichi'): Settings {
  const data = newGame(variant)
  return { variant, players: fourPlayers, setup: playing, gameplay: { ...data, match: createMatch(data, variant === 'riichi' ? defaultRiichi() : defaultHK(), false) } }
}
function fourKans(players: ('bottom' | 'right' | 'top' | 'left')[]): GameplayData {
  let data = newGame('riichi')
  for (const [index, player] of players.entries()) data = recordAction(data, player, call('ankan', (['1m', '2m', '3m', '4m'] as const)[index], `kan-${index}`), `action-${index}`)
  return data
}
describe('ordinary draws and ledger', () => {
  it.each([0, 1, 2, 3, 4])('balances the 3000-point transfer for %i Tenpai', (count) => {
    const tenpai = Object.fromEntries(POSITIONS.map((seat, i) => [seat, i < count])) as Record<typeof POSITIONS[number], boolean>
    const deltas = calculateNotenPayments(tenpai)
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0)
    for (const seat of POSITIONS) expect(deltas[seat]).toBe(count === 0 || count === 4 ? 0 : tenpai[seat] ? 3000 / count : -3000 / (4 - count))
  })
  it('requires all declarations and changes nothing until confirmed', () => {
    const settings = fixture()
    expect(() => calculateNotenPayments({} as never)).toThrow()
    expect(() => finalizeDraw(settings, 'round-a', 'exhaustive-draw', { top: false, bottom: true, left: false, right: false }, false)).toThrow()
    expect(settings.gameplay!.match!.honba).toBe(0)
  })
  it('repeats/rotates HK by policy and crosses East North to South East', () => {
    const match = fixture('hong-kong').gameplay!.match!
    expect(previewDraw(match, 'exhaustive-draw').dealer).toBe('bottom')
    const rotate = { ...match, kyoku: 4, rules: { ...defaultHK(), drawDealer: 'rotate' as const } }
    expect(previewDraw(rotate, 'exhaustive-draw')).toMatchObject({ kyoku: 1, roundWind: 1, dealer: 'right' })
  })
  it('finalizes once, retains deposits, archives the round and supports full undo', () => {
    let settings = fixture()
    let data = recordAction(settings.gameplay!, 'bottom', { kind: 'riichi', confirmed: true }, 'r')
    data = syncMatch(data)
    expect(syncMatch(data).match).toEqual(data.match)
    expect(data.match).toMatchObject({ pool: 1000, points: { bottom: 24000 } })
    settings = { ...settings, gameplay: data }
    const next = finalizeDraw(settings, 'round-a', 'exhaustive-draw', { top: false, bottom: true, left: false, right: false }, true)
    expect(next.gameplay!.match).toMatchObject({ honba: 1, kyoku: 1, dealer: 'bottom', pool: 1000, points: { bottom: 27000, top: 24000 } })
    expect(next.gameplay!.activeRoundId).not.toBe('round-a')
    expect(() => finalizeDraw(next, 'round-a', 'exhaustive-draw', undefined, true)).toThrow()
    const undone = undoLatestDraw(next)
    expect(undone.gameplay!.match).toMatchObject({ honba: 0, pool: 1000, points: { bottom: 24000, top: 25000 }, roundId: 'round-a' })
    expect(undone.setup).toEqual(playing)
    expect(undone.gameplay!.match!.history[0].undone).toBe(true)
    expect(syncMatch({ ...data, actions: undoAction(data, 'r').actions }).match).toMatchObject({ pool: 0, points: { bottom: 25000 } })
  })
  it('rotates Noten dealer, increments Honba and offers final-hand decision', () => {
    const match = fixture().gameplay!.match!
    const tenpai = { top: true, bottom: false, left: false, right: false }
    expect(previewDraw(match, 'exhaustive-draw', tenpai)).toMatchObject({ dealer: 'right', kyoku: 2, honba: 1 })
    expect(previewDraw({ ...match, roundWind: 1, kyoku: 4 }, 'exhaustive-draw', tenpai).phase).toBe('end-decision')
  })
  it('does not debit legacy declarations without explicit reconciliation', () => {
    const data = recordAction(newGame('riichi'), 'bottom', { kind: 'riichi', confirmed: true }, 'legacy')
    const legacy = { ...data, match: createMatch(data, defaultRiichi(), true) }
    expect(syncMatch(legacy).match).toMatchObject({ legacyUnreconciled: true, pool: 0, points: { bottom: 25000 } })
  })
  it('prepares a new physical round and retains profiles/rules on reset', () => {
    const settings = fixture('hong-kong')
    const drawn = finalizeDraw(settings, 'round-a', 'exhaustive-draw', undefined, true)
    expect(prepareNext(drawn).gameplay!.match!.phase).toBe('preparing')
    expect(resetMatch(drawn, false).players).toEqual(fourPlayers)
    expect(resetMatch(drawn, true).players).toEqual({})
    expect(resetMatch(drawn, true).gameplay!.rounds).toHaveLength(2)
  })
})
describe('Four-Kan casual profile', () => {
  it.each([['bottom', 'bottom', 'right', 'right'], ['bottom', 'bottom', 'bottom', 'right']] as const)('detects multiple players: %s', (...owners) => {
    const data = fourKans([...owners])
    expect(getFourKanDrawEligibility(data, defaultRiichi())).toMatchObject({ eligible: true, count: 4, distinctPlayers: 2, fifthKanForbidden: true })
    expect(() => recordAction(data, 'top', call('ankan', '9p', 'fifth'))).toThrow()
  })
  it('does not abort four Kans by one player, three Kans, disabled profile or HK', () => {
    const same = fourKans(['bottom', 'bottom', 'bottom', 'bottom'])
    expect(getFourKanDrawEligibility(same, defaultRiichi()).eligible).toBe(false)
    expect(getFourKanDrawEligibility(fourKans(['bottom', 'bottom', 'right']), defaultRiichi()).eligible).toBe(false)
    const mixed = fourKans(['bottom', 'bottom', 'right', 'right'])
    expect(getFourKanDrawEligibility(mixed, { ...defaultRiichi(), fourKanAbortive: false }).eligible).toBe(false)
    expect(getFourKanDrawEligibility(mixed, defaultHK()).eligible).toBe(false)
  })
  it('counts an upgrade once and excludes robbed, undone and previous-hand Kans', () => {
    let data = recordAction(newGame('riichi'), 'bottom', call('pon'), 'pon')
    const robbed = recordAction(data, 'bottom', { ...added(), kanStatus: 'robbed' }, 'robbed')
    expect(getKanSummary(robbed).count).toBe(0)
    data = recordAction(data, 'bottom', added(), 'upgrade')
    expect(getKanSummary(data).count).toBe(1)
    expect(getKanSummary(undoAction(data, 'upgrade')).count).toBe(0)
    expect(getKanSummary(beginRound(data, 'riichi', 'bottom', fourPlayers, 'next')).count).toBe(0)
  })
  it('persists a pending condition, gives wins precedence and finalizes no Noten payment', () => {
    let settings = fixture()
    const kans = fourKans(['bottom', 'bottom', 'right', 'right'])
    const data = syncMatch({ ...kans, match: settings.gameplay!.match })
    expect(data.match!.pendingFourKan?.status).toBe('pending')
    expect(data.match!.honba).toBe(0)
    settings = { ...settings, gameplay: data }
    expect(() => finalizeDraw({ ...settings, gameplay: { ...data, match: { ...data.match!, winPending: true } } }, 'round-a', 'four-kan-abortive-draw', undefined, true)).toThrow(/和牌/)
    const next = finalizeDraw(settings, 'round-a', 'four-kan-abortive-draw', undefined, true)
    expect(next.gameplay!.match).toMatchObject({ dealer: 'bottom', kyoku: 1, honba: 1, pool: 0 })
    expect(next.gameplay!.match!.points).toEqual(settings.gameplay!.match!.points)
    expect(next.gameplay!.match!.history[0]).toMatchObject({ type: 'four-kan-abortive-draw', deltas: { top: 0, right: 0, bottom: 0, left: 0 } })
    expect(next.gameplay!.match!.ledger).toHaveLength(0)
    expect(undoLatestDraw(next).gameplay!.activeRoundId).toBe('round-a')
  })
})

describe('RC1 snapshot and ledger guards', () => {
  it('freezes rules and refuses Noten contradictory to Riichi', () => {
    const settings = fixture()
    const original = settings.gameplay!.match!.rules
    settings.preferences = { version: 1, hongKong: defaultHK(), riichi: { ...defaultRiichi(), startingPoints: 30000 } }
    expect(original).toMatchObject({ startingPoints: 25000 })
    const data = syncMatch(recordAction(settings.gameplay!, 'bottom', { kind: 'riichi', confirmed: true }, 'riichi-a'))
    expect(() => finalizeDraw({ ...settings, gameplay: data }, 'round-a', 'exhaustive-draw', { top: true, right: false, bottom: false, left: false }, true)).toThrow(/矛盾/)
    expect(data.match!.ledger).toHaveLength(1)
  })
  it('four-Kan carries deposits without Noten transactions and is idempotent', () => {
    let settings = fixture()
    const kans = fourKans(['bottom', 'bottom', 'right', 'right'])
    const data = syncMatch(recordAction({ ...kans, match: settings.gameplay!.match }, 'top', { kind: 'riichi', confirmed: true }, 'r'))
    settings = { ...settings, gameplay: data }
    const next = finalizeDraw(settings, 'round-a', 'four-kan-abortive-draw', undefined, true)
    expect(next.gameplay!.match).toMatchObject({ pool: 1000, honba: 1, points: { top: 24000 } })
    expect(next.gameplay!.match!.ledger.map((entry) => entry.kind)).toEqual(['riichi'])
    expect(() => finalizeDraw(next, 'round-a', 'four-kan-abortive-draw', undefined, true)).toThrow()
    const undone = undoLatestDraw(next)
    expect(undone.gameplay!.match).toMatchObject({ pool: 1000, honba: 0, pendingFourKan: { status: 'pending' } })
  })
})
