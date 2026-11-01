import { useState } from 'react'
import type { GameplayData } from '../actions/models'
import { activeRound } from '../actions/engine'
import { TileFace, TilePicker } from '../hands/TilePicker'
import { getDoraFromIndicator, tileLabel } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
import { updateIndicator } from './indicators'
export function IndicatorEditor({ data, onChange }: { data: GameplayData; onChange: (data: GameplayData) => void }) {
  const round = activeRound(data)
  const [target, setTarget] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ type: TileType; red: boolean } | null>(null)
  const [error, setError] = useState('')
  if (round?.variant !== 'riichi') return null
  const locked = data.wins?.some((win) => win.roundId === round.id && win.status !== 'reversed')
  const entries = round.dora?.entries ?? []
  function save(status: 'effective' | 'unrevealed' | 'deferred', id = target!) {
    try { onChange(updateIndicator(data, id, status, status === 'effective' ? selection?.type : undefined, selection?.red)); setTarget(null); setSelection(null); setError('') }
    catch (err) { setError(err instanceof Error ? err.message : '未能記錄指示牌。') }
  }
  return <section className="round-indicators"><h3>寶牌指示牌</h3><p className="action-note">輸入牌山實際揭開的牌，所有玩家共用。槓後由王牌補嶺上牌；寶牌指示牌不會被摸走。</p>
    {entries.map((entry) => <article className="indicator-card" key={entry.id}>
      <strong>{entry.kind === 'initial' ? '首張寶牌指示牌' : '新槓寶牌指示牌已翻開？'}</strong>
      {entry.kind === 'kan' && <small>{entry.timing === 'immediate' ? '本局規則：槓完成後即時翻開' : '本局規則：明／加槓後出牌才翻開'}</small>}
      {entry.status === 'effective' && entry.tile ? <><TileFace type={entry.tile.type} red={entry.tile.red} /><span>實際寶牌（自動計算）：{tileLabel(getDoraFromIndicator(entry.tile.type))}</span></> : <span>{({ pending: '待確認', unrevealed: '尚未翻開（不計入）', deferred: '稍後補錄（計分前須核對）', effective: '已揭開' })[entry.status]}</span>}
      {!locked && <div className="history-actions"><button type="button" onClick={() => { setTarget(entry.id); setSelection(null) }}>{entry.status === 'effective' ? '更正指示牌' : '已翻開，輸入指示牌'}</button>{entry.kind === 'kan' && <><button type="button" onClick={() => save('unrevealed', entry.id)}>尚未翻開</button><button type="button" onClick={() => save('deferred', entry.id)}>稍後補錄</button></>}</div>}
    </article>)}
    {target && <div className="indicator-input"><TilePicker label="實際寶牌指示牌" redFives onPick={(type, red) => { setSelection({ type, red }) }} />
      {selection && <p>指示牌：{tileLabel(selection.type, selection.red)} → 實際寶牌：{tileLabel(getDoraFromIndicator(selection.type))}</p>}
      <div className="sheet-buttons"><button className="secondary-button" type="button" onClick={() => setTarget(null)}>取消輸入</button><button className="primary-button" type="button" disabled={!selection} onClick={() => save('effective')}>確認指示牌</button></div>
    </div>}
    {error && <p className="game-error" role="alert">{error}</p>}
  </section>
}
