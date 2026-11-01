export type Suit = 'm' | 'p' | 's'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type TileType = `${Rank}${Suit}` | 'east' | 'south' | 'west' | 'north' | 'white' | 'green' | 'red'
export type FlowerType = 'spring' | 'summer' | 'autumn' | 'winter' | 'plum' | 'orchid' | 'chrysanthemum' | 'bamboo'
export interface TileInstance { id: string; type: TileType; red: boolean }
const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
export const HONORS = ['east', 'south', 'west', 'north', 'white', 'green', 'red'] as const
export const HONOR_LABELS = ['東', '南', '西', '北', '白', '發', '中']
export const TILE_CATALOG: readonly TileType[] = [
  ...(['m', 'p', 's'] as const).flatMap((suit) => Array.from({ length: 9 }, (_, i) => `${i + 1}${suit}` as TileType)), ...HONORS,
]
export const FLOWERS: Record<FlowerType, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬', plum: '梅', orchid: '蘭', chrysanthemum: '菊', bamboo: '竹' }
export const isTileType = (value: unknown): value is TileType => TILE_CATALOG.some((tile) => tile === value)
export const isFive = (tile: TileType) => /^5[mps]$/.test(tile)
export const tileLabel = (tile: TileType, red = false): string => `${red ? '赤' : ''}${HONOR_LABELS[HONORS.indexOf(tile as typeof HONORS[number])] ?? `${numerals[Number(tile[0]) - 1]}${({ m: '萬', p: '筒', s: '索' })[tile[1] as Suit]}`}`
export const newId = () => crypto.randomUUID()
export const tileInstance = (type: TileType, red = false): TileInstance => ({ id: newId(), type, red })
export function sequenceFrom(tile: TileType): TileType[] {
  if (!/^[1-7][mps]$/.test(tile)) throw new Error('順子須由一至七的數牌開始。')
  return [0, 1, 2].map((offset) => `${Number(tile[0]) + offset}${tile[1]}` as TileType)
}
export function getDoraFromIndicator(indicator: TileType): TileType {
  if (!isTileType(indicator)) throw new Error('未知寶牌指示牌')
  if (/^[1-9][mps]$/.test(indicator)) return `${Number(indicator[0]) % 9 + 1}${indicator[1]}` as TileType
  const cycle = HONORS.slice(0, 4).includes(indicator as 'east') ? HONORS.slice(0, 4) : HONORS.slice(4)
  return cycle[(cycle.indexOf(indicator as 'east') + 1) % cycle.length]
}
