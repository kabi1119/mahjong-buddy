import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../../components/Sheet'
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
  onReset?: (clearPlayers: boolean) => void
  fixedDealer?: boolean
}

export function GameControls({ variant, players, setup, disabled, onAction, onBusyChange, onSelectDealer, editingPlayers, onEditPlayers, onReset, fixedDealer }: Props) {
  const [resetting, setResetting] = useState(false)
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

  const resetDialog = resetting && <Sheet title={setup.phase === 'playing' ? '確定要重設開局？' : '清除牌友並重設？'} onClose={() => setResetting(false)}><p>{setup.phase === 'playing' ? '保留玩家名稱及頭像；重設莊家、骰子與本局進度。現有動作會封存，草稿及歷史記錄保留。' : '移除目前牌友並返回加入玩家畫面。全域規則偏好、草稿及歷史記錄保留。'}</p><div className="sheet-buttons"><button className="secondary-button" type="button" onClick={() => setResetting(false)}>取消</button><button className="primary-button" type="button" onClick={() => { onReset?.(setup.phase !== 'playing'); setResetting(false) }}>{setup.phase === 'playing' ? '確認重設' : '確認清除'}</button></div></Sheet>
  if (setup.phase === 'playing') return <section className="game-controls"><button type="button" className="secondary-button action-wide" onClick={() => setResetting(true)}>重設開局（保留牌友）</button>{resetDialog}</section>
  if (!complete) return null
  const result = setup.dice && setup.dealer ? calculateWallBreak(variant, setup.dice.reduce((sum, die) => sum + die, 0), setup.dealer) : null
  const label = (position: PlayerPosition) => `${players[position]?.nickname}（${winds?.[position]}）`
  const changeDealer = () => { onAction({ type: 'change-dealer' }); setGuideOpen(false); onSelectDealer() }
  const confirmDealt = () => { onAction({ type: 'dealt' }); setGuideOpen(false) }

  return <section className="preparation game-controls" aria-labelledby="preparation-heading" aria-busy={rolling}>
    <h2 id="preparation-heading" className="sr-only">{'開局準備'}</h2>
    <div className="primary-controls">
      <div className="game-actions">
        {setup.phase === 'selecting-dealer' ? <>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => {
            try { onAction({ type: 'dealer', position: POSITIONS[randomIndex(4)] }); setError('') }
            catch { setError('未能隨機選莊，請點選玩家。') }
          }}>隨機選莊</button>
          <button type="button" className="primary-button" disabled={disabled || !setup.dealer} onClick={() => { onAction({ type: 'confirm-dealer' }); onSelectDealer() }}>確認莊家</button>
        </> : setup.phase === 'wall-guide' ? <>
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
            {!fixedDealer && <button className="secondary-button" type="button" disabled={disabled || rolling} onClick={changeDealer}>更改莊家</button>}

            {setup.dice && <DiceFaces dice={setup.dice} />}
            {setup.dice && <button type="button" className="secondary-button" disabled={disabled || rolling} onClick={roll}>重新擲骰並重設配牌</button>}

          </>}
          <button type="button" className="text-action reset-setup" disabled={disabled || rolling} onClick={() => setResetting(true)}>清除牌友並重設</button>
        </div>
      </details>
    </div>
    {resetDialog}
    {rolling && <div className="rolling-placeholder" role="status"><span aria-hidden="true">◇ ◇ {count === 3 && '◇'}</span>正在擲骰…</div>}
    {error && <p role="alert" className="game-error">{error}</p>}
    {guideOpen && result && setup.dice && setup.dealer && !rolling && <WallGuide result={result} dice={setup.dice} dealer={setup.dealer} players={players} onClose={() => setGuideOpen(false)} onDealt={setup.phase === 'wall-guide' ? confirmDealt : undefined} />}
  </section>
}
