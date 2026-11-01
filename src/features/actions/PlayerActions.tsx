import { syncMatch } from '../match/engine'
import { SmartChi } from './SmartChi'
import { precedingPlayer } from './chi'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition } from '../../types/mahjong'
import { assignSeatWinds } from '../game/rules'
import { TileFace, TilePicker } from '../hands/TilePicker'
import { newId, tileLabel } from '../hands/tiles'
import type { TileType } from '../hands/tiles'
import { ACTION_LABELS } from './models'
import type { ActionInput, GameplayData, PlayerAction } from './models'
import { activeRound, correctAction, getEligibleAddedKanMelds, projectRound, recordAction, undoAction } from './engine'

interface Props { data: GameplayData; playerId: PlayerPosition; onChange: (data: GameplayData) => void; onClose: () => void; onEdit: () => void; onWin: () => void }
type Step = 'menu' | 'kan' | 'added-list' | 'chi' | 'pon' | 'ankan' | 'daiminkan' | 'shouminkan' | 'riichi'
export function PlayerActions({ data, playerId, onChange, onClose, onEdit, onWin }: Props) {
  const round = activeRound(data)!
  const player = round.players[playerId]
  const [step, setStep] = useState<Step>('menu')
  const [tile, setTile] = useState<TileType | null>(null)
  const [source, setSource] = useState<PlayerPosition | null>(null)
  const [target, setTarget] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [kanStatus, setKanStatus] = useState<'completed' | 'robbed'>('completed')
  const [correcting, setCorrecting] = useState<PlayerAction | null>(null)
  const [error, setError] = useState('')
  const before = correcting ? { ...data, actions: data.actions.filter((action) => action.order < correcting.order) } : data
  const view = projectRound(before, round.id)
  const currentView = projectRound(data, round.id)
  const candidates = getEligibleAddedKanMelds(playerId, round.id, view.melds)
  const declared = view.riichi.some((item) => item.playerId === playerId)
  const opened = view.melds.some((meld) => meld.playerId === playerId && meld.open)
  const predecessor = precedingPlayer(playerId)
  const choose = (next: Step) => { setStep(next); setError(''); setConfirmed(false); setTile(null); setSource(next === 'chi' && round.variant === 'riichi' ? predecessor : null); setCorrecting(null); setKanStatus('completed') }
  const selectPon = (id: string) => { const pon = candidates.find((item) => item.id === id)!; setTarget(id); setTile(pon.tile); setConfirmed(false); setStep('shouminkan') }
  function editAction(action: PlayerAction) {
    setCorrecting(action); setStep(action.kind); setTile(action.kind === 'riichi' ? null : action.tile)
    setSource('sourcePlayer' in action ? action.sourcePlayer : null)
    setTarget(action.kind === 'shouminkan' ? action.targetMeldId : '')
    setKanStatus('kanStatus' in action ? action.kanStatus : 'completed'); setConfirmed(false); setError('')
  }
  function commit() {
    try {
      let input: ActionInput
      if (step === 'riichi') input = { kind: 'riichi', confirmed }
      else if (step === 'shouminkan' && tile) input = { kind: 'shouminkan', tile, meldId: target, targetMeldId: target, physicalConfirmed: confirmed, kanStatus }
      else if (['chi', 'pon', 'ankan', 'daiminkan'].includes(step) && tile) input = { kind: step as 'chi' | 'pon' | 'ankan' | 'daiminkan', tile, meldId: correcting && 'meldId' in correcting ? correcting.meldId : newId(), sourcePlayer: step === 'ankan' ? null : source, kanStatus, riichiAnkanConfirmed: step === 'ankan' && declared ? confirmed : false }
      else throw new Error('請先選擇牌種。')
      onChange(syncMatch(correcting ? correctAction(data, correcting.id, input) : recordAction(data, playerId, input)))
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : '未能儲存記錄。') }
  }
  const isKan = ['ankan', 'daiminkan', 'shouminkan'].includes(step)
  return <Sheet title={`${player.nickname}・玩家動作`} onClose={onClose}>
    <p className="action-player"><span aria-hidden="true">{player.avatar}</span> {player.nickname} · {assignSeatWinds(round.dealer)[playerId]}家</p>
    {step === 'menu' ? <>
      <div className="player-action-grid">
        <button type="button" onClick={() => choose('chi')}>{round.variant === 'hong-kong' ? '上牌' : '吃'}</button>
        <button type="button" onClick={() => choose('pon')}>碰</button>
        <button type="button" onClick={() => choose('kan')}>槓</button>
        {round.variant === 'riichi' && <button type="button" onClick={() => choose('riichi')}>立直</button>}
        <button className="primary-button" type="button" onClick={onWin}>{round.variant === 'hong-kong' ? '食糊' : '和牌'}</button>
      </div>
      <p className="action-note">記錄實體動作；日本四麻確認立直會扣除 1,000 點至供託。和牌計分尚未支援。</p>
      <details className="action-history"><summary>動作記錄與更正</summary>
        <ol>{data.actions.filter((action) => action.roundId === round.id && action.playerId === playerId).map((action) => <li key={action.id}>
          <span>{ACTION_LABELS[action.kind]}{'tile' in action && ` · ${tileLabel(action.tile)}`} · {action.status === 'undone' ? '已撤回' : 'kanStatus' in action && action.kanStatus === 'robbed' ? '未完成／被搶槓' : '已記錄'}{action.revision > 0 && ' · 已更正'}</span>
          {currentView.issues[action.id] && <p role="status">{currentView.issues[action.id]}</p>}
          {action.status === 'active' && <div className="history-actions"><button type="button" onClick={() => editAction(action)}>更正</button><button type="button" onClick={() => onChange(syncMatch(undoAction(data, action.id)))}>撤回</button></div>}
        </li>)}</ol>
      </details>
      <button className="secondary-button action-wide" type="button" onClick={onEdit}>編輯玩家資料</button>
    </> : <>
      <button className="text-action" type="button" onClick={() => { setStep('menu'); setCorrecting(null); setError('') }}>返回動作選單</button>
      {step === 'kan' ? <div className="action-list">
        <button type="button" onClick={() => choose('ankan')}>暗槓</button>
        <button type="button" onClick={() => choose('daiminkan')}>大明槓</button>
        {candidates.length === 1 && <button type="button" onClick={() => selectPon(candidates[0].id)}>加槓（{tileLabel(candidates[0].tile)}）</button>}
        {candidates.length > 1 && <button type="button" onClick={() => setStep('added-list')}>加槓</button>}
        <p>暗槓用四張手中同牌；大明槓用三張手牌及棄牌。加槓必須對應已記錄的碰。</p>
      </div> : step === 'added-list' ? <><h3>你想將邊組碰牌加槓？</h3><div className="action-list">{candidates.map((meld) => <button type="button" key={meld.id} onClick={() => selectPon(meld.id)}>{tileLabel(meld.tile)} · 記錄 {meld.order}</button>)}</div></>
        : step === 'chi' ? <SmartChi sourceName={round.players[predecessor].nickname} redAllowed={round.variant === 'riichi' && (data.match?.rules.variant !== 'riichi' || Object.values(data.match.rules.redFives).some((n) => n > 0))} onSave={(tiles, claimed, redIndex) => {
          try {
            if (redIndex !== null && data.match?.rules.variant === 'riichi' && data.match.rules.redFives[tiles[redIndex][1] as 'm' | 'p' | 's'] === 0) throw new Error('此花色未啟用赤五。')
            const input: ActionInput = { kind: 'chi', tile: tiles[0], meldId: correcting && 'meldId' in correcting ? correcting.meldId : newId(), sourcePlayer: predecessor, claimedTile: claimed, suppliedTiles: tiles.filter((type) => type !== claimed), chiRedIndex: redIndex, physicalConfirmed: true, riichiAnkanConfirmed: false, kanStatus: 'completed' }
            onChange(syncMatch(correcting ? correctAction(data, correcting.id, input) : recordAction(data, playerId, input))); onClose()
          } catch (err) { setError(err instanceof Error ? err.message : '未能記錄順子。') }
        }} /> : step === 'riichi' ? <>
          <p>立直需要門前清及聽牌；程式無法檢查實體手牌。確認後扣除 1,000 點至供託（舊局須先對帳）。</p>
          {(opened || declared) && <p role="alert">{opened ? '已有明副露，不能記錄為有效立直。' : '此玩家已記錄立直。'}</p>}
          <label className="check-line"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />我已自行確認門前清、聽牌及此局立直條件</label>
          <button type="button" className="primary-button action-wide" disabled={!confirmed || opened || declared} onClick={commit}>確認立直記錄</button>
        </> : <>
          <h3>{step === 'pon' ? '碰咗邊隻牌？' : `${ACTION_LABELS[step as keyof typeof ACTION_LABELS]}：選擇同牌`}</h3>
          {step !== 'shouminkan' && <TilePicker label="動作牌種" onPick={(type) => setTile(type)} />}
          {tile && <p className="chosen-tile"><TileFace type={tile} /><strong>{tileLabel(tile)}{step === 'pon' ? ' × 3' : ' × 4'}</strong></p>}
          {(step === 'pon' || step === 'daiminkan') && <label className="action-field">來源玩家（如知道）<select aria-label="來源玩家" value={source ?? ''} onChange={(event) => setSource((event.target.value || null) as PlayerPosition | null)}><option value="">未記錄</option>{POSITIONS.filter((seat) => seat !== playerId).map((seat) => <option key={seat} value={seat}>{round.players[seat].nickname}</option>)}</select></label>}
          {isKan && <>
            <label className="check-line"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{step === 'shouminkan' ? '確認已實際取得第四張相同牌，可加到這組碰' : step === 'ankan' && declared ? '我已自行核對立直後暗槓限制及實體四張同牌' : '我已自行核對四張同牌及此槓的實體條件'}</label>
            <label className="action-field">槓的狀態<select aria-label="槓的狀態" value={kanStatus} onChange={(event) => setKanStatus(event.target.value as 'completed' | 'robbed')}><option value="completed">已完成</option><option value="robbed">未完成／被搶槓</option></select></label>
            <p className="action-note">未完成的槓不增加寶牌指示牌。立直後暗槓須自行核對聽牌不變等限制。</p>
          </>}
          <button type="button" className="primary-button action-wide" disabled={!tile || (isKan && !confirmed)} onClick={commit}>{correcting ? '儲存更正' : '確認記錄'}</button>
        </>}
    </>}
    {error && <p role="alert" className="game-error">{error}</p>}
  </Sheet>
}
