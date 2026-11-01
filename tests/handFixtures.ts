import { POSITIONS } from '../src/types/mahjong'
import type { Player, PlayerPosition } from '../src/types/mahjong'
import { beginRound, emptyGameplay, recordAction } from '../src/features/actions/engine'
import type { ActionInput, GameplayData } from '../src/features/actions/models'
import type { TileType } from '../src/features/hands/tiles'
export const fourPlayers = Object.fromEntries(POSITIONS.map((position) => [position, { position, nickname: position, avatar: '🐱' }])) as Record<PlayerPosition, Player>
export const newGame = (variant: 'hong-kong' | 'riichi' = 'hong-kong', roundId = 'round-a') => beginRound(emptyGameplay(), variant, 'bottom', fourPlayers, roundId)
export const call = (kind: 'pon' | 'chi' | 'ankan' | 'daiminkan', tile: TileType = '5p', meldId = 'meld-a'): Exclude<ActionInput, { kind: 'riichi' | 'shouminkan' }> => ({ kind, tile, meldId, sourcePlayer: kind === 'chi' ? 'left' : null, kanStatus: 'completed', riichiAnkanConfirmed: false })
export const ponGame = (variant: 'hong-kong' | 'riichi' = 'hong-kong'): GameplayData => recordAction(newGame(variant), 'bottom', call('pon'), 'pon-a')
export const added = (target = 'meld-a', tile: TileType = '5p', confirmed = true): Extract<ActionInput, { kind: 'shouminkan' }> => ({ kind: 'shouminkan', tile, targetMeldId: target, meldId: target, physicalConfirmed: confirmed, kanStatus: 'completed' })
