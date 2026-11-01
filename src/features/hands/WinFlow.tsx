import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition } from '../../types/mahjong'
import { activeRound, getEligibleAddedKanMelds, makeMeld, projectRound } from '../actions/engine'
import { ACTION_LABELS } from '../actions/models'
import type { GameplayData, HandDraft, MeldKind } from '../actions/models'
import { completedKanCount, createDraft, hasConfirmedRiichi, logicalTileCount, physicalTileCount, saveDraft, setMeldRedCount, upgradeDraftPon, validateDraft } from './drafts'
import { FLOWERS, getDoraFromIndicator, newId, tileInstance, tileLabel } from './tiles'
import type { FlowerType, TileType } from './tiles'
import { TileFace, TilePicker, TileRow } from './TilePicker'
interface Props { data: GameplayData; playerId: PlayerPosition; onChange: (data: GameplayData) => void; onClose: () => void }
type Target = 'concealed' | 'winning' | 'dora' | 'ura' | Exclude<MeldKind, 'shouminkan'>
export function WinFlow({ data, playerId, onChange, onClose }: Props) {
  const round = activeRound(data)!
  const [draft, setDraft] = useState(() => createDraft(data, round.id, playerId))
  const [stage, setStage] = useState<'context' | 'builder'>('context')
  const [target, setTarget] = useState<Target>('winning')
  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [kanConfirmed, setKanConfirmed] = useState(false)
  const [upgradeId, setUpgradeId] = useState('')
  const [syncConfirmed, setSyncConfirmed] = useState(false)
  const draftRound = data.rounds.find((item) => item.id === draft.roundId)!
  const winnerName = draftRound.players[draft.winner].nickname
  const uraAllowed = hasConfirmedRiichi(data, draft)
  const kans = completedKanCount(data, draft)
  const errors = validateDraft(draft, data, true)
  function change(next: HandDraft, enforceLimits = true) {
    const problems = validateDraft(next, data)
    if (enforceLimits && problems.length) { setError(problems.join(' ')); return }
    setDraft({ ...next, status: 'draft' }); setDirty(true); setError('')
  }
  function pick(type: TileType, red: boolean) {
    if (target === 'winning') change({ ...draft, winningTile: tileInstance(type, red) })
    else if (target === 'concealed') change({ ...draft, concealed: [...draft.concealed, tileInstance(type, red)] })
    else if (target === 'dora' || target === 'ura') change({ ...draft, indicators: [...draft.indicators, { id: newId(), kind: target, tile: tileInstance(type, red) }] })
    else {
      if ((target === 'ankan' || target === 'daiminkan') && !kanConfirmed) { setError('請先確認此組槓已完成。'); return }
      const source = target === 'chi' && draft.variant === 'riichi' ? POSITIONS[(POSITIONS.indexOf(draft.winner) + 1) % 4] : null
      change({ ...draft, melds: [...draft.melds, makeMeld(target, type, draft.winner, draft.roundId, draft.variant, newId(), source)] })
      setKanConfirmed(false)
    }
  }
  function persist(confirm: boolean) {
    try { onChange(saveDraft(data, draft, confirm)); onClose() }
    catch (err) { setShowErrors(confirm); setError(err instanceof Error ? err.message : '未能儲存草稿。') }
  }
  const chooseTarget = (next: Target) => { setTarget(next); setError(''); setKanConfirmed(false) }
  const savedDrafts = data.drafts.filter((item) => item.winner === playerId && item.variant === round.variant)
  return <Sheet title={stage === 'context' ? '食糊／和牌記錄' : '贏牌 Hand Builder'} className="hand-builder" onClose={() => dirty ? setClosing(true) : onClose()}>
    {closing ? <div className="discard-confirm"><h3>放棄未儲存修改？</h3><p>已儲存的草稿會保留。</p><button type="button" className="primary-button action-wide" onClick={() => setClosing(false)}>繼續編輯</button><button type="button" className="secondary-button action-wide" onClick={onClose}>放棄未儲存修改</button></div> : <>
      <p className="action-player"><img src="/mahjong.svg" alt="" width="32" height="32" /> {winnerName} · {draft.variant === 'hong-kong' ? '香港麻雀' : '四人立直'}</p>
      <p className="action-note">只重建本次贏牌輸入；不計分、不判定合法食糊、不結束牌局。</p>
      {stage === 'context' && savedDrafts.length > 0 && <details className="saved-drafts"><summary>繼續已儲存草稿／記錄（{savedDrafts.length}）</summary>{savedDrafts.map((item) => <button type="button" className="secondary-button action-wide" key={item.id} onClick={() => { setDraft(structuredClone(item)); setDirty(false); setStage('builder'); setTarget('concealed'); setError('') }}>{item.status === 'draft' ? '繼續草稿' : '編輯已確認輸入'} · {new Intl.DateTimeFormat('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(item.updatedAt)}{item.roundId !== round.id && '（舊局）'}</button>)}</details>}
      <section className="builder-section"><h3>贏家與方式</h3>
        <label className="action-field">方式<select aria-label="贏牌方式" value={draft.win.method} onChange={(event) => change({ ...draft, win: { ...draft.win, method: event.target.value as 'tsumo' | 'ron', sourcePlayer: null } })}><option value="tsumo">自摸 / Tsumo</option><option value="ron">出銃 / Ron</option></select></label>
        {draft.win.method === 'ron' && <label className="action-field">出銃玩家<select aria-label="出銃玩家" value={draft.win.sourcePlayer ?? ''} onChange={(event) => change({ ...draft, win: { ...draft.win, sourcePlayer: (event.target.value || null) as PlayerPosition | null } })}><option value="">請選擇</option>{POSITIONS.filter((seat) => seat !== draft.winner).map((seat) => <option key={seat} value={seat}>{draftRound.players[seat].nickname}</option>)}</select></label>}
        {draft.variant === 'hong-kong' && <label className="check-line"><input type="checkbox" checked={draft.win.specialFlower} onChange={(event) => change({ ...draft, win: { ...draft.win, specialFlower: event.target.checked } })} />花糊記錄（不要求一般 14 張；資格自行核對）</label>}
      </section>
      {stage === 'builder' && <>
        <section className="builder-section"><h3>暗牌 <small>不包括食糊／和牌牌張</small></h3>
          <TileRow tiles={draft.concealed} onRemove={(id) => change({ ...draft, concealed: draft.concealed.filter((tile) => tile.id !== id) })} />
          <button className="secondary-button action-wide" type="button" onClick={() => chooseTarget('concealed')}>加入暗牌</button>
        </section>
        <section className="builder-section"><h3>副露與槓 <small>只改重建，不改動作記錄</small></h3>
          {(['calls', 'kans'] as const).map((group) => <div key={group}><h4>{group === 'calls' ? '明副露 · 上／吃、碰' : '槓 · 暗槓、大明槓、加槓'}</h4>{draft.melds.filter((meld) => group === 'calls' ? meld.kind === 'chi' || meld.kind === 'pon' : meld.kind !== 'chi' && meld.kind !== 'pon').map((meld) => <article className="meld-card" key={meld.id}>
            <div className="meld-heading"><strong>{ACTION_LABELS[meld.kind]} · {meld.open ? '明' : '暗'} · {meld.tiles.length} 張／1 組</strong><button type="button" className="text-action" onClick={() => change({ ...draft, melds: draft.melds.filter((item) => item.id !== meld.id) })}>移除此組</button></div>
            <TileRow tiles={meld.tiles} />
            {draft.variant === 'riichi' && meld.tiles.some((tile) => /^5[mps]$/.test(tile.type)) && <label className="action-field">此組赤五數量<select aria-label={`第 ${draft.melds.indexOf(meld) + 1} 組副露赤五數量`} value={meld.redCount ?? ''} onChange={(event) => change({ ...draft, melds: draft.melds.map((item) => item.id === meld.id ? setMeldRedCount(item, Number(event.target.value)) : item) })}><option value="" disabled>請核對實體牌</option>{Array.from({ length: meld.tiles.filter((tile) => /^5[mps]$/.test(tile.type)).length + 1 }, (_, count) => <option key={count} value={count}>{count}</option>)}</select></label>}
            {meld.open && <label className="action-field">來源玩家<select aria-label={`第 ${draft.melds.indexOf(meld) + 1} 組副露來源`} value={meld.sourcePlayer ?? ''} onChange={(event) => change({ ...draft, melds: draft.melds.map((item) => item.id === meld.id ? { ...item, sourcePlayer: (event.target.value || null) as PlayerPosition | null } : item) })}><option value="">未記錄</option>{POSITIONS.filter((seat) => seat !== draft.winner).map((seat) => <option key={seat} value={seat}>{draftRound.players[seat].nickname}</option>)}</select></label>}
            {getEligibleAddedKanMelds(draft.winner, draft.roundId, [meld]).length > 0 && <button type="button" className="text-action" onClick={() => setUpgradeId(meld.id)}>將這組碰改為加槓</button>}
            {meld.kind === 'shouminkan' && meld.originalPon && <button type="button" className="text-action" onClick={() => change({ ...draft, melds: draft.melds.map((item) => item.id === meld.id ? structuredClone(meld.originalPon!) : item) })}>還原為碰</button>}
          </article>)}</div>)}
          {upgradeId && <div className="upgrade-confirm"><p>確認已取得相同的第四張實體牌，並已完成這組加槓？</p><button className="primary-button action-wide" type="button" onClick={() => { try { change(upgradeDraftPon(draft, upgradeId, true)); setUpgradeId('') } catch (err) { setError(String(err)) } }}>確認第四張並升級</button><button className="secondary-button action-wide" type="button" onClick={() => setUpgradeId('')}>取消加槓</button></div>}
          <div className="builder-tools">{(['chi', 'pon', 'ankan', 'daiminkan'] as const).map((kind) => <button className="secondary-button" type="button" key={kind} onClick={() => chooseTarget(kind)}>新增{ACTION_LABELS[kind]}</button>)}</div>
          <details><summary>重新載入已記錄副露</summary><p>會取代草稿副露，暗牌仍保留。</p><label className="check-line"><input type="checkbox" checked={syncConfirmed} onChange={(event) => setSyncConfirmed(event.target.checked)} />確認取代</label><button type="button" className="secondary-button action-wide" disabled={!syncConfirmed} onClick={() => { change({ ...draft, melds: structuredClone(projectRound(data, draft.roundId).melds.filter((meld) => meld.playerId === draft.winner)) }); setSyncConfirmed(false) }}>同步已記錄副露</button></details>
        </section>
      </>}
      <section className="builder-section"><h3>食糊／和牌牌張 <small>獨立計算一次</small></h3>
        {draft.winningTile && <TileRow tiles={[draft.winningTile]} onRemove={() => change({ ...draft, winningTile: null })} />}
        <button className="secondary-button action-wide" type="button" onClick={() => chooseTarget('winning')}>{draft.winningTile ? '更改贏牌牌張' : '選擇贏牌牌張'}</button>
      </section>
      {stage === 'builder' && draft.variant === 'hong-kong' && <section className="builder-section"><h3>花牌 <small>各一張，不計入暗牌</small></h3><div className="flower-palette">{Object.entries(FLOWERS).map(([id, label]) => <button type="button" key={id} aria-label={`花牌 ${label}`} aria-pressed={draft.flowers.includes(id as FlowerType)} onClick={() => change({ ...draft, flowers: draft.flowers.includes(id as FlowerType) ? draft.flowers.filter((item) => item !== id) : [...draft.flowers, id as FlowerType] })}>{label}</button>)}</div></section>}
      {stage === 'builder' && draft.variant === 'riichi' && <>
        <details className="builder-section"><summary>赤五家規設定</summary><label className="check-line"><input type="checkbox" checked={draft.redFives.enabled} onChange={(event) => change({ ...draft, redFives: { ...draft.redFives, enabled: event.target.checked } })} />使用赤五（與普通五牌共享四張上限）</label>{draft.redFives.enabled && (['m', 'p', 's'] as const).map((suit) => <label className="action-field" key={suit}>{suit === 'm' ? '萬' : suit === 'p' ? '筒' : '索'}赤五數量<select aria-label={`${({ m: '萬', p: '筒', s: '索' })[suit]}赤五設定`} value={draft.redFives.perSuit[suit]} onChange={(event) => change({ ...draft, redFives: { ...draft.redFives, perSuit: { ...draft.redFives.perSuit, [suit]: Number(event.target.value) } } })}>{[0, 1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>)}</details>
        <section className="builder-section"><h3>寶牌指示牌（牌山實際揭開的牌）</h3><p className="action-note">只輸入實際揭開的牌，並非直接選寶牌。寶牌不等於役，不計番。</p>
          {kans > 0 && <p>已確認 {kans} 組完成的槓，請核對額外已揭指示牌；未完成／被搶槓不計。</p>}
          {draft.indicators.map((indicator) => <div className="indicator-card" key={indicator.id}><span>{indicator.kind === 'ura' ? '裏寶牌指示牌' : '寶牌指示牌'}</span><TileFace type={indicator.tile.type} red={indicator.tile.red} /><span>→ 實際寶牌（自動計算）：{tileLabel(getDoraFromIndicator(indicator.tile.type))}</span><button className="text-action" type="button" onClick={() => change({ ...draft, indicators: draft.indicators.filter((item) => item.id !== indicator.id) })}>移除指示牌</button></div>)}
          <button type="button" className="secondary-button action-wide" disabled={draft.indicators.filter((item) => item.kind === 'dora').length >= 1 + kans} onClick={() => chooseTarget('dora')}>新增寶牌指示牌</button>
          {uraAllowed && <button type="button" className="secondary-button action-wide" onClick={() => chooseTarget('ura')}>新增裏寶牌指示牌（已手動確認立直）</button>}
        </section>
      </>}
      <section className="builder-section picker-section"><h3>{({ concealed: '加入暗牌', winning: '選擇贏牌牌張', dora: '選擇寶牌指示牌', ura: '選擇裏寶牌指示牌', chi: '選擇順子的起始牌', pon: '選擇碰牌', ankan: '選擇已完成暗槓', daiminkan: '選擇已完成大明槓' })[target]}</h3>
        {(target === 'ankan' || target === 'daiminkan') && <label className="check-line"><input type="checkbox" checked={kanConfirmed} onChange={(event) => setKanConfirmed(event.target.checked)} />確認這組槓已實際完成；如已立直，已自行核對暗槓限制及聽牌不變</label>}
        <TilePicker key={target} label="贏牌牌種" sequence={target === 'chi'} redFives={draft.variant === 'riichi' && draft.redFives.enabled && ['concealed', 'winning', 'dora', 'ura'].includes(target)} onPick={pick} />
      </section>
      {stage === 'context' ? <button type="button" className="primary-button action-wide" onClick={() => { setStage('builder'); setTarget('concealed') }}>繼續重建贏牌</button> : <p className="hand-count" role="status">邏輯牌：{logicalTileCount(draft)} · 實體牌：{physicalTileCount(draft)}（花牌、指示牌另計）；數量正確不代表合法贏牌。</p>}
      {showErrors && errors.length > 0 && <ul className="game-error">{errors.map((item) => <li key={item}>{item}</li>)}</ul>}
      {error && <p className="game-error" role="alert">{error}</p>}
      <div className="builder-save"><button className="secondary-button" type="button" onClick={() => persist(false)}>儲存未完成草稿</button>{stage === 'builder' && <button className="primary-button" type="button" onClick={() => persist(true)}>確認輸入（不計分）</button>}</div>
    </>}
  </Sheet>
}
