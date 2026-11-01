import { useEffect, useRef, useState } from 'react'
import { POSITIONS } from '../../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
import { assignSeatWinds, calculateWallBreak, generateDiceResults, randomIndex } from './rules'
import { diceCountFor } from './setup'
import type { GameSetup, SetupAction } from './setup'
import { DiceFaces, WallGuide } from './WallGuide'

interface Props {
  variant: MahjongVariant
  players: Partial<Record<PlayerPosition, Player>>
  setup: GameSetup
  disabled: boolean
  onAction: (action: SetupAction) => void
  onBusyChange: (busy: boolean) => void
  onSelectDealer: () => void
  editingPlayers: boolean
  onEditPlayers: () => void
}

export function GameControls({ variant, players, setup, disabled, onAction, onBusyChange, onSelectDealer, editingPlayers, onEditPlayers }: Props) {
  const [rolling, setRolling] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const complete = POSITIONS.every((position) => players[position])
  const winds = setup.dealer ? assignSeatWinds(setup.dealer) : null
  const count = diceCountFor(variant, setup)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); onBusyChange(false) }, [onBusyChange])

  function roll() {
    if (lock.current || disabled || !complete || !setup.dealer || setup.phase === 'selecting-dealer') return
    lock.current = true
    setRolling(true)
    setGuideOpen(false)
    setError('')
    onBusyChange(true)
    onAction({ type: 'begin-roll' })
    const finish = () => {
      try {
        const dice = generateDiceResults(count)
        onAction({ type: 'rolled', dice })
        setGuideOpen(true)
      } catch { setError('未能取得安全隨機數，請重試擲骰。') }
      finally { lock.current = false; setRolling(false); onBusyChange(false) }
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish()
    else timer.current = setTimeout(finish, 450)
  }

  if (!complete) return null // The table's single contextual instruction guides adding players.
  const result = setup.dice && setup.dealer ? calculateWallBreak(variant, setup.dice.reduce((sum, die) => sum + die, 0), setup.dealer) : null
  const label = (position: PlayerPosition) => `${players[position]?.nickname}（${winds?.[position]}）`
  const changeDealer = () => { onAction({ type: 'change-dealer' }); setGuideOpen(false); onSelectDealer() }
  const confirmDealt = () => { onAction({ type: 'dealt' }); setGuideOpen(false) }

  return <section className="preparation game-controls" aria-labelledby="preparation-heading" aria-busy={rolling}>
    <h2 id="preparation-heading" className="sr-only">{setup.phase === 'playing' ? '手動行牌提示' : '開局準備'}</h2>
    <div className="primary-controls">
      <div className="game-actions">
        {setup.phase === 'selecting-dealer' ? <>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => {
            try { onAction({ type: 'dealer', position: POSITIONS[randomIndex(4)] }); setError('') }
            catch { setError('未能隨機選莊，請點選玩家。') }
          }}>隨機選莊</button>
          <button type="button" className="primary-button" disabled={disabled || !setup.dealer} onClick={() => { onAction({ type: 'confirm-dealer' }); onSelectDealer() }}>確認莊家</button>
        </> : setup.phase === 'playing' ?
          <button type="button" className="primary-button" disabled={rolling} onClick={() => onAction({ type: 'next-turn' })}>下一家</button>
          : setup.phase === 'wall-guide' ? <>
            <button type="button" className="secondary-button" onClick={() => setGuideOpen(true)}>查看開門指引</button>
            <button type="button" className="primary-button" onClick={confirmDealt}>已完成配牌</button>
          </> : <button type="button" className="primary-button" disabled={disabled || rolling} onClick={roll}>{rolling ? '擲骰中…' : '擲骰開門'}</button>}
      </div>
      <details className="secondary-actions">
        <summary>更多<span className="sr-only">設定與說明</span></summary>
        <div className="secondary-content">
          {setup.phase === 'selecting-dealer' ? <>
            <p>莊家為東，其右手邊為南；實體座位不會移動。</p>
            <button type="button" className="secondary-button" onClick={onEditPlayers}>{editingPlayers ? '返回選莊' : '編輯牌友'}</button>
          </> : <>
            <p>莊家：{label(setup.dealer!)}</p>
            <button className="secondary-button" type="button" disabled={disabled || rolling} onClick={changeDealer}>更改莊家</button>
            {variant === 'hong-kong' ? <label className="dice-count-label">港式骰子數（家規）
              <select aria-label="港式骰子數" value={setup.hkDiceCount} disabled={disabled || rolling} onChange={(event) => onAction({ type: 'dice-count', count: Number(event.target.value) as 2 | 3 })}>
                <option value="3">3 粒（預設）</option><option value="2">2 粒</option>
              </select>
            </label> : <p>四人立直：2 粒骰子 · 每邊 17 棟</p>}
            {setup.dice && <DiceFaces dice={setup.dice} />}
            {setup.dice && <button type="button" className="secondary-button" disabled={disabled || rolling} onClick={roll}>重新擲骰並重設配牌</button>}
            {setup.phase === 'playing' && setup.turn && <>
              <button type="button" className="secondary-button" onClick={() => setGuideOpen(true)}>查看開門指引</button>
              <label className="dice-count-label">上／碰／槓後手動指定玩家
                <select aria-label="手動指定玩家" value={setup.turn} onChange={(event) => onAction({ type: 'turn', position: event.target.value as PlayerPosition })}>
                  {POSITIONS.map((position) => <option key={position} value={position}>{label(position)}</option>)}
                </select>
              </label>
              <button type="button" className="secondary-button" onClick={() => onAction({ type: 'reset-turn' })}>重設至東家</button>
              <p>東家起手 14 張，先打第一張；之後南家摸牌。正常次序：東 → 南 → 西 → 北。</p>
              <p>只記錄手動指定的輪次，不會偵測摸牌、棄牌、上碰槓、立直或食糊。</p>
            </>}
          </>}
          <button type="button" className="text-action reset-setup" disabled={disabled || rolling} onClick={() => { onAction({ type: 'reset' }); setGuideOpen(false); onSelectDealer() }}>重設開局（保留牌友）</button>
        </div>
      </details>
    </div>
    {rolling && <div className="rolling-placeholder" role="status"><span aria-hidden="true">◇ ◇ {count === 3 && '◇'}</span>正在擲骰…</div>}
    {error && <p role="alert" className="game-error">{error}</p>}
    {guideOpen && result && setup.dice && setup.dealer && !rolling && <WallGuide result={result} dice={setup.dice} dealer={setup.dealer} players={players} onClose={() => setGuideOpen(false)} onDealt={setup.phase === 'wall-guide' ? confirmDealt : undefined} />}
  </section>
}
