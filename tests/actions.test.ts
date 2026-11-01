import { describe, expect, it } from 'vitest'
import { archiveRound, beginRound, correctAction, getEligibleAddedKanMelds, makeMeld, projectRound, recordAction, undoAction } from '../src/features/actions/engine'
import type { Meld } from '../src/features/actions/models'
import { added, call, fourPlayers, newGame, ponGame } from './handFixtures'

describe('known Pon and Added Kan eligibility', () => {
  it('records a stable, identified three-tile open Pon for its owner and round', () => {
    const data = ponGame()
    const meld = projectRound(data, 'round-a').melds[0]
    expect(meld).toMatchObject({ id: 'meld-a', playerId: 'bottom', roundId: 'round-a', tile: '5p', kind: 'pon', open: true, status: 'active' })
    expect(meld.tiles).toHaveLength(3)
    expect(getEligibleAddedKanMelds('bottom', 'round-a', [meld])).toEqual([meld])
  })
  it('filters another player, another round, unknown tiles, removed, already upgraded and malformed Pon', () => {
    const good = projectRound(ponGame(), 'round-a').melds[0]
    const invalid = [
      { ...good, playerId: 'left' }, { ...good, roundId: 'old-round' },
      { ...good, tile: 'unknown' }, { ...good, status: 'removed' },
      { ...good, kind: 'shouminkan' }, { ...good, upgradeActionId: 'upgrade' },
      { ...good, open: false }, { ...good, tiles: good.tiles.slice(0, 2) },
      { ...good, tiles: [...good.tiles.slice(0, 2), { ...good.tiles[2], type: '6p' }] },
    ] as Meld[]
    expect(getEligibleAddedKanMelds('bottom', 'round-a', invalid)).toEqual([])
    expect(getEligibleAddedKanMelds('bottom', 'round-a', [good], '6p')).toEqual([])
    expect(getEligibleAddedKanMelds('bottom', 'round-a', [good], '5p')).toHaveLength(1)
    const red = { ...good, tiles: good.tiles.map((tile, i) => ({ ...tile, red: i === 0 })) }
    expect(getEligibleAddedKanMelds('bottom', 'round-a', [red], '5p')).toHaveLength(1)
  })
  it('rejects Added Kan without a Pon, a matching tile or physical confirmation', () => {
    expect(() => recordAction(newGame(), 'bottom', added())).toThrow()
    expect(() => recordAction(ponGame(), 'left', added())).toThrow()
    expect(() => recordAction(ponGame(), 'bottom', added('meld-a', '6p'))).toThrow()
    expect(() => recordAction(ponGame(), 'bottom', added('meld-a', '5p', false))).toThrow()
  })
  it('offers each of multiple eligible Pons without choosing one implicitly', () => {
    let data = ponGame()
    data = recordAction(data, 'bottom', call('pon', '3m', 'meld-b'))
    data = recordAction(data, 'bottom', call('pon', 'white', 'meld-c'))
    expect(getEligibleAddedKanMelds('bottom', 'round-a', projectRound(data, 'round-a').melds).map((meld) => meld.id)).toEqual(['meld-a', 'meld-b', 'meld-c'])
  })
  it('upgrades the same meld once, preserving the original Pon and source, then undo restores it', () => {
    let data = recordAction(newGame(), 'bottom', { ...call('pon'), sourcePlayer: 'right' }, 'pon-a')
    data = recordAction(data, 'top', call('pon', 'white', 'other-meld'), 'other-action')
    data = recordAction(data, 'bottom', added(), 'added-a')
    const view = projectRound(data, 'round-a')
    const meld = view.melds.find((item) => item.id === 'meld-a')!
    expect(meld).toMatchObject({ id: 'meld-a', kind: 'shouminkan', sourcePlayer: 'right', originalPon: { kind: 'pon', sourcePlayer: 'right', id: 'meld-a' } })
    expect(meld.tiles).toHaveLength(4)
    expect(view.melds).toHaveLength(2)
    expect(getEligibleAddedKanMelds('bottom', 'round-a', view.melds)).toHaveLength(0)
    expect(() => recordAction(data, 'bottom', added())).toThrow()
    data = undoAction(data, 'added-a')
    expect(projectRound(data, 'round-a').melds.find((item) => item.id === 'meld-a')?.kind).toBe('pon')
    expect(projectRound(data, 'round-a').melds.find((item) => item.id === 'other-meld')?.kind).toBe('pon')
    expect(getEligibleAddedKanMelds('bottom', 'round-a', projectRound(data, 'round-a').melds)).toHaveLength(1)
    data = undoAction(data, 'pon-a')
    expect(getEligibleAddedKanMelds('bottom', 'round-a', projectRound(data, 'round-a').melds)).toHaveLength(0)
  })
  it('keeps robbed Added Kan as history without upgrading or producing a completed Kan', () => {
    const data = recordAction(ponGame('riichi'), 'bottom', { ...added(), kanStatus: 'robbed' }, 'robbed')
    expect(projectRound(data, 'round-a').melds[0].kind).toBe('pon')
    expect(data.actions.find((action) => action.id === 'robbed')).toMatchObject({ kanStatus: 'robbed' })
  })
  it('never offers old-round Pons and preserves archived history', () => {
    const old = ponGame()
    const current = beginRound(old, 'hong-kong', 'right', fourPlayers, 'round-b')
    expect(getEligibleAddedKanMelds('bottom', 'round-b', projectRound(current, 'round-a').melds)).toEqual([])
    expect(() => recordAction(current, 'bottom', added())).toThrow()
    expect(archiveRound(current).actions).toEqual(old.actions)
  })
  it('corrects an identified action and prevents breaking dependent upgrades silently', () => {
    const old = ponGame()
    const changed = correctAction(old, 'pon-a', call('pon', '3m'))
    expect(projectRound(changed, 'round-a').melds[0].tile).toBe('3m')
    expect(changed.actions[0]).toMatchObject({ id: 'pon-a', revision: 1 })
    const upgraded = recordAction(old, 'bottom', added())
    expect(() => correctAction(upgraded, 'pon-a', call('pon', '3m'))).toThrow()
  })
  it('does not accept more than four known physical copies across called groups', () => {
    expect(() => recordAction(ponGame(), 'right', call('pon', '5p', 'second'))).toThrow(/四張/)
  })
})

describe('Riichi, source and completion constraints', () => {
  it('only declares Riichi with user confirmation and no recorded open melds', () => {
    expect(() => recordAction(newGame('riichi'), 'bottom', { kind: 'riichi', confirmed: false })).toThrow()
    expect(() => recordAction(ponGame('riichi'), 'bottom', { kind: 'riichi', confirmed: true })).toThrow()
    expect(() => recordAction(newGame(), 'bottom', { kind: 'riichi', confirmed: true })).toThrow()
    const data = recordAction(newGame('riichi'), 'bottom', { kind: 'riichi', confirmed: true }, 'riichi')
    expect(projectRound(data, 'round-a').riichi[0]).toMatchObject({ validation: 'user-confirmed-unverified', playerId: 'bottom' })
    expect(data).not.toHaveProperty('points')
    expect(() => recordAction(data, 'bottom', call('pon'))).toThrow()
    expect(() => recordAction(data, 'bottom', call('daiminkan'))).toThrow()
    expect(() => recordAction(data, 'bottom', call('ankan'))).toThrow()
    const after = recordAction(data, 'bottom', { ...call('ankan', '1m'), riichiAnkanConfirmed: true })
    expect(projectRound(after, 'round-a').riichi).toHaveLength(1)
    expect(projectRound(after, 'round-a').melds[0].open).toBe(false)
    expect(projectRound(undoAction(after, 'riichi'), 'round-a').riichi).toHaveLength(0)
  })
  it('restricts Riichi Chi to the preceding player and records structured sequences', () => {
    const data = recordAction(newGame('riichi'), 'bottom', call('chi', '3m'))
    expect(projectRound(data, 'round-a').melds[0].tiles.map((tile) => tile.type)).toEqual(['3m', '4m', '5m'])
    expect(() => recordAction(newGame('riichi'), 'bottom', { ...call('chi', '3m'), sourcePlayer: 'right' })).toThrow()
    expect(() => makeMeld('chi', '8m', 'bottom', 'round-a', 'riichi')).toThrow()
  })
})
