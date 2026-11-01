import { useState } from 'react'
import type { GameplayData, HandDraft, Meld, MeldKind } from '../actions/models'
import { ACTION_LABELS } from '../actions/models'
import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition } from '../../types/mahjong'
import { TilePicker, TileRow } from './TilePicker'
import type { TileType } from './tiles'
import { tileLabel } from './tiles'
import { refreshRecordedMelds, removeRecordedMeld, saveRecordedMeld } from './builder'
export function MeldReview({ data, draft, onChange, onClose }: { data: GameplayData; draft: HandDraft; onChange: (next: GameplayData, draft: HandDraft) => void; onClose: () => void }) {
  const [kind, setKind] = useState<MeldKind>('chi')
  const [tile, setTile] = useState<TileType | null>(null)
  const [source, setSource] = useState<PlayerPosition | null>(null)
  const [editing, setEditing] = useState<Meld | undefined>(undefined)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const round = data.rounds.find((item) => item.id === draft.roundId)!
  function apply(next: GameplayData) { onChange(next, refreshRecordedMelds(next, draft)); setEditing(undefined); setTile(null); setConfirmed(false); setError('') }
  return <section className="meld-review"><h3>補充遺漏副露</h3><p className="action-note">只核對實際完成的上／吃、碰、槓。修改會更正本局動作記錄，原記錄仍保留審計。暗槓保留日本門前清；明副露及加槓不保留。</p>
    {draft.melds.map((meld) => <article className="meld-card" key={meld.id}><strong>{ACTION_LABELS[meld.kind]}</strong><TileRow tiles={meld.tiles} /><div className="history-actions"><button type="button" onClick={() => { setEditing(meld); setKind(meld.kind); setTile(meld.tile); setSource(meld.sourcePlayer); setConfirmed(false) }}>更正此組</button><button type="button" onClick={() => { try { apply(removeRecordedMeld(data, meld.id)) } catch (err) { setError(String(err)) } }}>移除錯誤記錄</button></div></article>)}
    <label className="action-field">牌組類型<select aria-label="補充牌組類型" value={kind} onChange={(event) => { setKind(event.target.value as MeldKind); setTile(null); setConfirmed(false) }}>{(['chi', 'pon', 'ankan', 'daiminkan', 'shouminkan'] as const).map((value) => <option key={value} value={value}>{ACTION_LABELS[value]}</option>)}</select></label>
    <TilePicker key={kind} label="補充副露牌種" sequence={kind === 'chi'} onPick={(type) => { setTile(type); setConfirmed(false) }} />
    {tile && <p>{kind === 'chi' ? '順子起始牌' : '同牌'}：{tileLabel(tile)}</p>}
    {kind !== 'ankan' && kind !== 'chi' && <label className="action-field">來源玩家<select aria-label="補充副露來源" value={source ?? ''} onChange={(event) => setSource((event.target.value || null) as PlayerPosition | null)}><option value="">未記錄</option>{POSITIONS.filter((seat) => seat !== draft.winner).map((seat) => <option key={seat} value={seat}>{round.players[seat].nickname}</option>)}</select></label>}
    <label className="check-line"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />確認實體牌種、明暗、來源及已完成狀態；加槓包括原有碰與第四張牌，立直後暗槓亦已核對限制</label>
    <div className="sheet-buttons"><button className="secondary-button" type="button" onClick={onClose}>完成副露檢查</button><button className="primary-button" type="button" disabled={!tile || !confirmed} onClick={() => { try { apply(saveRecordedMeld(data, draft.winner, kind, tile!, source, editing)) } catch (err) { setError(err instanceof Error ? err.message : '副露資料無效。') } }}>{editing ? '儲存更正牌組' : '補錄牌組'}</button></div>
    {error && <p className="game-error" role="alert">{error}</p>}
  </section>
}
