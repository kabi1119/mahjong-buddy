import { describe, expect, it } from 'vitest'
import { getChiOptions, precedingPlayer } from '../src/features/actions/chi'
import { getNextPlayer } from '../src/features/game/rules'
import { POSITIONS } from '../src/types/mahjong'
import { recordAction, projectRound, correctAction, undoAction } from '../src/features/actions/engine'
import { call, newGame } from './handFixtures'
import type { TileType } from '../src/features/hands/tiles'
describe('Smart Chi pure rules', () => {
  it.each([['5s', ['3s', '4s', '5s']], ['1m', ['1m']], ['2m', ['1m', '2m']], ['8p', ['6p', '7p']], ['9s', ['7s']]] as const)('generates all starts for %s', (discard, starts) => expect(getChiOptions(discard).map((tiles) => tiles[0])).toEqual(starts))
  it.each(['east', 'red', 'white', 'spring', '0m', '10p', 'bad'])('rejects non-numbered identities: %s', (tile) => expect(getChiOptions(tile as TileType)).toEqual([]))
  it('uses physical turn order at every position', () => { for (const seat of POSITIONS) expect(getNextPlayer(precedingPlayer(seat))).toBe(seat) })
  it('keeps stable IDs when correcting and undoing a confirmed Chi', () => {
    const input = { ...call('chi', '3s'), sourcePlayer: 'left' as const, claimedTile: '5s' as const, suppliedTiles: ['3s', '4s'] as TileType[], physicalConfirmed: true, chiRedIndex: 2 }
    const data = recordAction(newGame('riichi'), 'bottom', input, 'chi-a')
    const corrected = correctAction(data, 'chi-a', { ...input, chiRedIndex: null })
    expect(projectRound(corrected, 'round-a').melds[0]).toMatchObject({ id: 'meld-a', redCount: 0, claimedTile: '5s' })
    expect(projectRound(undoAction(corrected, 'chi-a'), 'round-a').melds).toHaveLength(0)
    expect(() => recordAction(newGame(), 'bottom', { ...input, sourcePlayer: 'right' })).toThrow(/來源/)
    expect(() => recordAction(newGame(), 'bottom', { ...input, physicalConfirmed: false })).toThrow()
  })
})
