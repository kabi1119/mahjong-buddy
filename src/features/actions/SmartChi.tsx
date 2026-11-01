import { useState } from 'react'
import { TileFace, TilePicker } from '../hands/TilePicker'
import type { TileType } from '../hands/tiles'
import { tileLabel } from '../hands/tiles'
import { getChiOptions } from './chi'
interface Props { sourceName: string; redAllowed: boolean; onSave: (tiles: TileType[], claimed: TileType, redIndex: number | null) => void }
export function SmartChi({ sourceName, redAllowed, onSave }: Props) {
  const [discard, setDiscard] = useState<TileType | null>(null)
  const [sequence, setSequence] = useState<TileType[] | null>(null)
  const [redIndex, setRedIndex] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  return <section className="smart-chi"><h3>上家打出邊隻牌？</h3><p>來源：{sourceName} · 只可取上家的數牌</p>
    <TilePicker label="上家棄牌" numberedOnly onPick={(type) => { setDiscard(type); setSequence(null); setConfirmed(false); setRedIndex(null) }} />
    {discard && <><h3>選擇你實際組成的順子</h3><div className="chi-options">{getChiOptions(discard).map((tiles) => <button type="button" key={tiles[0]} aria-label={tiles.map((type) => tileLabel(type)).join('、')} aria-pressed={sequence?.[0] === tiles[0]} onClick={() => { setSequence(tiles); setConfirmed(false); setRedIndex(null) }}>{tiles.map((type) => <span key={type} className={type === discard ? 'claimed-tile' : ''}><TileFace type={type} /><small>{type === discard ? '棄牌' : '手牌'}</small></span>)}</button>)}</div></>}
    {sequence && discard && <>
      {redAllowed && sequence.some((type) => /^[5][mps]$/.test(type)) && <label className="action-field">實體赤五組成<select aria-label="順子赤五" value={redIndex === null ? '' : redIndex} onChange={(e) => setRedIndex(e.target.value === '' ? null : Number(e.target.value))}><option value="">沒有赤五</option>{sequence.map((type, index) => type[0] === '5' ? <option key={type} value={index}>{tileLabel(type, true)}（{type === discard ? '上家棄牌' : '手中牌'}）</option> : null)}</select></label>}
      <label className="check-line"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />我手中確實有另外兩張牌，赤五組成亦與實體牌相符</label>
      <button className="primary-button action-wide" type="button" disabled={!confirmed} onClick={() => onSave(sequence, discard, redIndex)}>確認記錄順子</button>
    </>}
  </section>
}
