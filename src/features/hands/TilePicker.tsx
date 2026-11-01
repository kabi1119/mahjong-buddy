import { useState } from 'react'
import { HONORS, HONOR_LABELS, TILE_CATALOG, isFive, tileLabel } from './tiles'
import type { TileInstance, TileType } from './tiles'

export function TileFace({ type, red = false }: { type: TileType; red?: boolean }) {
  const rank = Number(type[0])
  const suit = type[1]
  const color = red || type === 'red' ? '#a93e32' : suit === 'p' || type === 'white' ? '#315c7d' : '#285d44'
  const dots = Array.from({ length: Number.isNaN(rank) ? 0 : rank }, (_, i) => ({ x: 11 + i % 3 * 9, y: 15 + Math.floor(i / 3) * 11 }))
  return <svg viewBox="0 0 40 56" className="mahjong-tile-art" aria-hidden="true">
    <rect x="1" y="3" width="38" height="52" rx="5" fill="#b7cab0" />
    <rect x="1" y="1" width="38" height="50" rx="5" fill="#fffbeb" stroke="#c6ccb7" />
    {suit === 'p' && rank ? dots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r="3.1" fill="none" stroke={color} strokeWidth="1.8" />)
      : suit === 's' && rank === 1 ? <image href="/mahjong.svg" x="5" y="6" width="30" height="38" />
      : suit === 's' && rank ? dots.map((dot, i) => <path key={i} d={`M${dot.x} ${dot.y - 3}v7m-2-5h4m-4 3h4`} stroke={color} strokeWidth="1.9" strokeLinecap="round" />)
      : type === 'white' ? <rect x="10" y="11" width="20" height="28" rx="1" fill="none" stroke={color} strokeWidth="2" />
      : <text x="20" y={suit === 'm' ? 24 : 35} textAnchor="middle" fill={color} fontSize={suit === 'm' ? 22 : 26} fontFamily="serif" fontWeight="600">{suit === 'm' ? rank : HONOR_LABELS[HONORS.indexOf(type as typeof HONORS[number])]}</text>}
    {suit === 'm' && <text x="20" y="44" textAnchor="middle" fill={color} fontSize="18" fontFamily="serif">萬</text>}
    {red && <circle cx="33" cy="46" r="2" fill="#b34839" />}
  </svg>
}
export function TilePicker({ label, onPick, redFives = false, sequence = false, numberedOnly = false }: { label: string; onPick: (tile: TileType, red: boolean) => void; redFives?: boolean; sequence?: boolean; numberedOnly?: boolean }) {
  const [group, setGroup] = useState('m')
  const tiles = TILE_CATALOG.filter((tile) => group === 'honors' ? HONORS.includes(tile as typeof HONORS[number]) : tile.endsWith(group))
    .filter((tile) => !sequence || /^[1-7][mps]$/.test(tile))
  return <section className="tile-picker" aria-label={label}>
    <div className="tile-tabs" role="group" aria-label="牌種分類">{[['m', '萬'], ['p', '筒'], ['s', '索'], ...(!sequence && !numberedOnly ? [['honors', '字牌']] : [])].map(([id, text]) => <button type="button" key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{text}</button>)}</div>
    <div className="tile-palette">{tiles.map((type) => <button type="button" key={type} aria-label={`${sequence ? '順子起始牌：' : ''}${tileLabel(type)}`} onClick={() => onPick(type, false)}><TileFace type={type} /><span>{tileLabel(type)}</span></button>)}
      {redFives && tiles.filter(isFive).map((type) => <button type="button" key={`red-${type}`} aria-label={tileLabel(type, true)} onClick={() => onPick(type, true)}><TileFace type={type} red /><span>{tileLabel(type, true)}</span></button>)}
    </div>
  </section>
}
export function TileRow({ tiles, onRemove }: { tiles: readonly TileInstance[]; onRemove?: (id: string) => void }) {
  return <div className="hand-tile-row">{tiles.map((tile, index) => onRemove ? <button type="button" key={tile.id} onClick={() => onRemove(tile.id)} aria-label={`移除${tileLabel(tile.type, tile.red)}，第 ${index + 1} 張`}><TileFace type={tile.type} red={tile.red} /></button> : <span key={tile.id} aria-label={tileLabel(tile.type, tile.red)}><TileFace type={tile.type} red={tile.red} /></span>)}</div>
}
