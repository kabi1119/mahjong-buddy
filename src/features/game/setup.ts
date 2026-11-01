import { POSITIONS } from '../../types/mahjong'
import type { MahjongVariant, PlayerPosition } from '../../types/mahjong'
import { getNextPlayer } from './rules'
import type { DiceCount, DiceValue } from './rules'

export interface GameSetup {
  version: 1
  hkDiceCount: DiceCount
  dealer: PlayerPosition | null
  phase: 'selecting-dealer' | 'ready-to-roll' | 'wall-guide' | 'playing'
  dice: DiceValue[] | null
  turn: PlayerPosition | null
}

export function newSetup(hkDiceCount: DiceCount = 3): GameSetup {
  return { version: 1, hkDiceCount, dealer: null, phase: 'selecting-dealer', dice: null, turn: null }
}

export function diceCountFor(variant: MahjongVariant, setup: GameSetup): DiceCount {
  return variant === 'riichi' ? 2 : setup.hkDiceCount
}

export type SetupAction =
  | { type: 'dealer'; position: PlayerPosition }
  | { type: 'confirm-dealer' }
  | { type: 'change-dealer' }
  | { type: 'dice-count'; count: DiceCount }
  | { type: 'begin-roll' }
  | { type: 'rolled'; dice: DiceValue[] }
  | { type: 'dealt' }
  | { type: 'next-turn' }
  | { type: 'turn'; position: PlayerPosition }
  | { type: 'reset-turn' }
  | { type: 'reset' }

export function updateSetup(setup: GameSetup, action: SetupAction): GameSetup {
  switch (action.type) {
    case 'reset': return newSetup(setup.hkDiceCount)
    case 'dealer': return { ...setup, dealer: action.position, phase: 'selecting-dealer', dice: null, turn: null }
    case 'change-dealer': return { ...setup, phase: 'selecting-dealer', dice: null, turn: null }
    case 'confirm-dealer': return setup.dealer ? { ...setup, phase: 'ready-to-roll', dice: null, turn: null } : setup
    case 'dice-count': return { ...setup, hkDiceCount: action.count, dice: null, turn: null,
      phase: setup.phase === 'selecting-dealer' ? 'selecting-dealer' : 'ready-to-roll' }
    case 'begin-roll': return setup.dealer && setup.phase !== 'selecting-dealer'
      ? { ...setup, phase: 'ready-to-roll', dice: null, turn: null } : setup
    case 'rolled': return setup.dealer && setup.phase === 'ready-to-roll'
      ? { ...setup, phase: 'wall-guide', dice: action.dice, turn: null } : setup
    case 'dealt': return setup.dealer && setup.dice && setup.phase === 'wall-guide'
      ? { ...setup, phase: 'playing', turn: setup.dealer } : setup
    case 'next-turn': return setup.phase === 'playing' && setup.turn ? { ...setup, turn: getNextPlayer(setup.turn) } : setup
    case 'turn': return setup.phase === 'playing' ? { ...setup, turn: action.position } : setup
    case 'reset-turn': return setup.phase === 'playing' ? { ...setup, turn: setup.dealer } : setup
  }
}

const isPosition = (value: unknown): value is PlayerPosition => POSITIONS.some((position) => position === value)
export function decodeSetup(value: unknown, variant: MahjongVariant): GameSetup | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  if (data.version !== 1 || (data.hkDiceCount !== 2 && data.hkDiceCount !== 3)) return undefined
  const setup = newSetup(data.hkDiceCount)
  if (!isPosition(data.dealer)) return setup
  setup.dealer = data.dealer
  if (data.phase === 'selecting-dealer') return setup
  setup.phase = 'ready-to-roll'
  const count = diceCountFor(variant, setup)
  if (!Array.isArray(data.dice) || data.dice.length !== count || !data.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6)) return setup
  if (data.phase !== 'wall-guide' && data.phase !== 'playing') return setup
  setup.dice = data.dice as DiceValue[]
  setup.phase = 'wall-guide'
  if (data.phase === 'playing' && isPosition(data.turn)) { setup.phase = 'playing'; setup.turn = data.turn }
  return setup
}
