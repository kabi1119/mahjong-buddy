import { describe, expect, it } from 'vitest'
import { POSITIONS } from '../src/types/mahjong'
import { assignSeatWinds, calculateWallBreak, generateDiceResults, getNextPlayer, getSelectedWall, nextWallStack, randomIndex, wallStackPoint } from '../src/features/game/rules'
import { decodeSetup, newSetup, updateSetup } from '../src/features/game/setup'

describe('seat winds and player turns (counter-clockwise)', () => {
  it('maps the bottom dealer exactly as the physical-table example', () => {
    expect(assignSeatWinds('bottom')).toEqual({ bottom: '東', right: '南', top: '西', left: '北' })
  })
  it.each(POSITIONS)('assigns all winds without moving seats for dealer %s', (dealer) => {
    const winds = assignSeatWinds(dealer)
    let position = dealer
    for (const wind of ['東', '南', '西', '北']) {
      expect(winds[position]).toBe(wind)
      position = getNextPlayer(position)
    }
    expect(position).toBe(dealer)
  })
  it.each(POSITIONS)('selects the correct wall for all totals with dealer %s', (dealer) => {
    const winds = assignSeatWinds(dealer)
    for (const [total, wind] of [[2, '南'], [3, '西'], [4, '北'], [5, '東'], [8, '北'], [13, '東']] as const) {
      expect(winds[getSelectedWall(dealer, total)]).toBe(wind)
    }
    for (let total = 2; total <= 18; total++) {
      expect(winds[getSelectedWall(dealer, total)]).toBe(['東', '南', '西', '北'][(total - 1) % 4])
    }
  })
})

describe('unbiased dice with deterministic uint32 injection', () => {
  it.each([2, 3] as const)('generates %i independent valid dice', (count) => {
    let sample = 0
    for (let round = 0; round < 12; round++) {
      const dice = generateDiceResults(count, () => sample++)
      expect(dice).toHaveLength(count)
      expect(dice.every((die) => die >= 1 && die <= 6)).toBe(true)
    }
  })
  it('shows every face from injected samples and rejects modulo-biased tail values', () => {
    let sample = 0
    expect([...generateDiceResults(3, () => sample++), ...generateDiceResults(3, () => sample++)]).toEqual([1, 2, 3, 4, 5, 6])
    const samples = [4294967295, 4294967294, 4294967293, 4294967292, 5]
    expect(generateDiceResults(2, () => samples.shift() ?? 0)).toEqual([6, 1])
    expect(samples).toHaveLength(0)
    expect([0, 1, 2, 3].map((value) => randomIndex(4, () => value))).toEqual([0, 1, 2, 3])
    expect(() => generateDiceResults(2, () => -1)).toThrow()
    expect(() => generateDiceResults(2, () => .5)).toThrow()
  })
})

describe('clockwise physical wall geometry', () => {
  it('uses each owner’s right end, never the screen’s right end', () => {
    const cases = [
      ['top', { x: 60.833333333333336, y: 52 }, 'x', 1],
      ['right', { x: 268, y: 60.833333333333336 }, 'y', 1],
      ['bottom', { x: 259.1666666666667, y: 268 }, 'x', -1],
      ['left', { x: 52, y: 259.1666666666667 }, 'y', -1],
    ] as const
    for (const [wall, start, axis, sign] of cases) {
      const first = wallStackPoint({ wall, index: 0 }, 18)
      const next = wallStackPoint({ wall, index: 1 }, 18)
      expect(first.x).toBeCloseTo(start.x)
      expect(first.y).toBeCloseTo(start.y)
      expect(Math.sign(next[axis] - first[axis])).toBe(sign)
    }
  })
  it.each(POSITIONS)('crosses the corner after the last stack of wall %s', (wall) => {
    expect(nextWallStack({ wall, index: 17 }, 18)).toEqual({ wall: POSITIONS[(POSITIONS.indexOf(wall) + 1) % 4], index: 0 })
  })
  it.each(POSITIONS)('calculates all HK breaks, including 18, for dealer %s', (dealer) => {
    for (let total = 2; total <= 18; total++) {
      const result = calculateWallBreak('hong-kong', total, dealer)
      expect(result.stacksPerWall).toBe(18)
      expect(result.counted).toEqual({ wall: getSelectedWall(dealer, total), index: total - 1 })
      expect(result.firstLive).toEqual(nextWallStack(result.counted, 18))
      expect(result.replacementEnd).toEqual(result.counted)
      expect(result.deadWall).toEqual([])
      expect(result.dora).toBeNull()
    }
  })
  it.each(POSITIONS)('reserves exactly seven dead stacks with the third-from-break dora for dealer %s', (dealer) => {
    for (let total = 2; total <= 12; total++) {
      const result = calculateWallBreak('riichi', total, dealer)
      expect(result.stacksPerWall).toBe(17)
      expect(result.deadWall).toHaveLength(7)
      expect(new Set(result.deadWall.map((stack) => `${stack.wall}:${stack.index}`)).size).toBe(7)
      expect(result.dora).toEqual(nextWallStack(result.firstLive, 17, -3))
      const live = Array.from({ length: 61 }, (_, index) => nextWallStack(result.firstLive, 17, index))
      expect(live.some((stack) => result.deadWall.some((dead) => dead.wall === stack.wall && dead.index === stack.index))).toBe(false)
      expect(nextWallStack(live[60], 17)).toEqual(result.deadWall[6])
    }
  })
  it('wraps the dead wall around a corner for a roll of 2', () => {
    const result = calculateWallBreak('riichi', 2, 'bottom')
    expect(result.deadWall).toEqual([
      { wall: 'right', index: 1 }, { wall: 'right', index: 0 },
      ...[16, 15, 14, 13, 12].map((index) => ({ wall: 'top', index })),
    ])
    expect(result.dora).toEqual({ wall: 'top', index: 16 })
  })
  it('rejects impossible totals', () => {
    for (const total of [0, 1, 19, 2.5]) expect(() => calculateWallBreak('hong-kong', total, 'bottom')).toThrow()
    expect(() => calculateWallBreak('riichi', 13, 'bottom')).toThrow()
  })
})

describe('setup progression and validation', () => {
  const chosen = updateSetup(newSetup(), { type: 'dealer', position: 'bottom' })
  const ready = updateSetup(chosen, { type: 'confirm-dealer' })
  const rolled = updateSetup(ready, { type: 'rolled', dice: [1, 2, 3] })
  it('requires a dealer before confirming and a confirmed dealer before rolling', () => {
    expect(updateSetup(newSetup(), { type: 'confirm-dealer' })).toEqual(newSetup())
    expect(updateSetup(chosen, { type: 'rolled', dice: [1, 2, 3] })).toEqual(chosen)
  })
  it('clears previous dice and turns on dealer or dice-count changes and on reroll', () => {
    const playing = updateSetup(rolled, { type: 'dealt' })
    for (const action of [{ type: 'dealer', position: 'left' }, { type: 'change-dealer' }, { type: 'dice-count', count: 2 }, { type: 'begin-roll' }] as const) {
      const reset = updateSetup(playing, action)
      expect(reset.dice).toBeNull()
      expect(reset.turn).toBeNull()
    }
    const second = updateSetup(updateSetup(rolled, { type: 'begin-roll' }), { type: 'rolled', dice: [6, 6, 6] })
    expect(second.dice).toEqual([6, 6, 6])
    expect(calculateWallBreak('hong-kong', 18, 'bottom')).not.toEqual(calculateWallBreak('hong-kong', 6, 'bottom'))
  })
  it('starts at East, advances normally, supports a claim override, and resets manually', () => {
    let setup = updateSetup(rolled, { type: 'dealt' })
    expect(setup.turn).toBe('bottom')
    for (const position of ['right', 'top', 'left', 'bottom']) {
      setup = updateSetup(setup, { type: 'next-turn' })
      expect(setup.turn).toBe(position)
    }
    setup = updateSetup(setup, { type: 'turn', position: 'top' })
    expect(updateSetup(setup, { type: 'next-turn' }).turn).toBe('left')
    expect(updateSetup(setup, { type: 'reset-turn' }).turn).toBe('bottom')
  })
  it('restores valid phases and discards invalid dice and turns safely', () => {
    expect(decodeSetup(rolled, 'hong-kong')).toEqual(rolled)
    const playing = updateSetup(rolled, { type: 'dealt' })
    expect(decodeSetup(playing, 'hong-kong')).toEqual(playing)
    for (const dice of [[0, 2, 3], [7, 2, 3], [1, 2], ['1', 2, 3]]) {
      expect(decodeSetup({ ...playing, dice }, 'hong-kong')).toEqual(ready)
    }
    expect(decodeSetup(rolled, 'riichi')).toEqual(ready)
    expect(decodeSetup({ ...playing, turn: 'bad' }, 'hong-kong')?.phase).toBe('wall-guide')
    expect(decodeSetup({ ...rolled, version: 2 }, 'hong-kong')).toBeUndefined()
    expect(decodeSetup(null, 'hong-kong')).toBeUndefined()
  })
})
