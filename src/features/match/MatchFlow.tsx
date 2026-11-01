import { reverseWinningSettlement } from '../scoring/settlement'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition } from '../../types/mahjong'
import type { Settings } from '../../storage/settings'
import { assignSeatWinds } from '../game/rules'
import { calculateNotenPayments, finalizeDraw, markFourKan, prepareNext, previewDraw, reconcileLegacy, roundLabel, undoLatestDraw } from './engine'
import type { Points, Tenpai } from './models'
export type MatchView = 'draw' | 'four-kan' | 'summary'
interface Props { settings: Settings; view: MatchView; onUpdate: (update: (s: Settings) => Settings) => void; onClose: () => void; onRules: () => void; onWin: (seat: PlayerPosition) => void; onIndicators: () => void; onViewWin: (id: string) => void }
export function MatchFlow({ settings, view, onUpdate, onClose, onRules, onWin, onIndicators, onViewWin }: Props) {
  const data = settings.gameplay!; const match = data.match!
  const [reversalReason, setReversalReason] = useState('')
  const [reverseConfirmed, setReverseConfirmed] = useState(false)
  const latestOutcome = match.history.filter((item) => !item.undone).at(-1)
  const [tenpai, setTenpai] = useState<Partial<Tenpai>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [winner, setWinner] = useState(false)
  const [error, setError] = useState('')
  const [baseline, setBaseline] = useState<Partial<Points>>({})
  const [pool, setPool] = useState('')
  const [clearWin, setClearWin] = useState(false)
  const winds = assignSeatWinds(match.dealer)
  const type = view === 'four-kan' ? 'four-kan-abortive-draw' : 'exhaustive-draw'
  const allAnswered = POSITIONS.every((seat) => typeof tenpai[seat] === 'boolean')
  const ready = view === 'four-kan' || match.variant === 'hong-kong' || allAnswered
  const preview = ready ? previewDraw(match, type, tenpai as Tenpai) : null
  const deltas = ready && match.variant === 'riichi' && view === 'draw' ? calculateNotenPayments(tenpai as Tenpai) : null
  const run = (operation: (s: Settings) => Settings, close = true) => { try { onUpdate(operation); if (close) onClose(); setError('') } catch (err) { setError(err instanceof Error ? err.message : '未能處理。') } }
  const name = (seat: PlayerPosition) => settings.players[seat]?.nickname ?? seat
  const summary = view === 'summary' || match.phase !== 'playing'
  return <Sheet title={summary ? '牌局摘要與記錄' : view === 'four-kan' ? '偵測到四槓散了條件' : match.variant === 'riichi' ? '確認荒牌流局' : '確認流局'} onClose={onClose}>
    <p>{roundLabel(match)} · 莊家：{name(match.dealer)}{match.variant === 'riichi' && <> · {match.honba} 本場 · 供託 {match.pool.toLocaleString()} 點</>}</p>
    {match.legacyUnreconciled ? <section className="legacy-baseline"><h3>舊立直局尚未對帳</h3><p>舊版立直從未扣點。請按實體牌桌填寫目前四人實際點數及已包含舊立直棒的供託；不會再次扣除舊棒。</p>{POSITIONS.map((seat) => <label className="action-field" key={seat}>{name(seat)}<input type="number" min="0" aria-label={name(seat) + '實際點數'} value={baseline[seat] ?? ''} onChange={(e) => setBaseline({ ...baseline, [seat]: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>)}<label className="action-field">實際供託<input type="number" min="0" step="1000" aria-label="實際供託" value={pool} onChange={(e) => setPool(e.target.value)} /></label><label className="check-line"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />確認以上是目前實際數值</label><button type="button" className="primary-button" disabled={!confirmed || pool === '' || !POSITIONS.every((seat) => baseline[seat] !== undefined)} onClick={() => run((s) => ({ ...s, gameplay: reconcileLegacy(s.gameplay!, baseline as Points, Number(pool)) }))}>確認對帳基準</button></section>
    : summary ? <>
      {<ul className="balance-list">{POSITIONS.map((seat) => <li key={seat}>{name(seat)}：{match.points[seat].toLocaleString()} 點</li>)}</ul>}
      {match.winPending && !data.wins?.some((win) => win.roundId === match.roundId && win.status === 'locked') && <div><p role="status">和牌待處理：請從贏家的和牌流程完成核對、鎖定及結算，不能以流局覆蓋。</p><label className="check-line"><input type="checkbox" checked={clearWin} onChange={(e) => setClearWin(e.target.checked)} />經核對，先前和牌標記有誤，本局繼續；草稿仍保留</label><button type="button" disabled={!clearWin} onClick={() => run((s) => ({ ...s, gameplay: { ...s.gameplay!, match: { ...s.gameplay!.match!, winPending: false, pendingFourKan: s.gameplay!.match!.pendingFourKan ? { ...s.gameplay!.match!.pendingFourKan!, status: 'deferred' } : undefined } } }))}>更正和牌標記</button></div>}
      {data.wins?.filter((win) => win.roundId === match.roundId && win.status === 'locked').map((win) => <button className="primary-button action-wide" type="button" key={win.id} onClick={() => { onViewWin(win.id); onClose() }}>查看鎖定和牌及結算</button>)}
      <button className="secondary-button action-wide" type="button" onClick={onRules}>查看本局規則</button>
      {match.variant === 'riichi' && <button className="secondary-button action-wide" type="button" onClick={onIndicators}>查看／更正本局寶牌指示牌</button>}
      {latestOutcome?.type === 'win' && latestOutcome.winId && <details><summary>審計撤銷最近和牌結算</summary><p>只在下一局尚無動作／草稿時可撤銷。原快照保留，並記錄撤銷原因。</p><label className="action-field">撤銷原因<input aria-label="和牌撤銷原因" value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} /></label><label className="check-line"><input type="checkbox" checked={reverseConfirmed} onChange={(event) => setReverseConfirmed(event.target.checked)} />四位玩家確認撤銷已結算和牌並恢復結算前帳目</label><button type="button" className="secondary-button action-wide" disabled={!reverseConfirmed || reversalReason.trim().length < 3} onClick={() => run((current) => reverseWinningSettlement(current, latestOutcome.winId!, reversalReason, reverseConfirmed))}>確認審計撤銷</button></details>}
      {data.wins?.some((win) => win.roundId !== match.roundId) && <details><summary>已封存和牌快照</summary>{data.wins.filter((win) => win.roundId !== match.roundId && win.rules.variant === match.variant).map((win) => <button className="secondary-button action-wide" type="button" key={win.id} onClick={() => { onViewWin(win.id); onClose() }}>{win.score.label} · {win.status === 'locked' ? '已封存，未支付' : win.status === 'reversed' ? '已審計撤銷' : '已結算'}</button>)}</details>}
      <h3>牌局結果記錄</h3><ul className="round-history">{match.history.map((item) => <li key={item.id}>{roundLabel({ ...match, ...item.before })} · {item.type === 'win' ? '和牌結算' : item.type === 'four-kan-abortive-draw' ? '四槓散了（途中流局）' : '流局'}{item.undone ? ' · 已撤回' : ''}{item.winId && <button className="text-action" type="button" onClick={() => { onViewWin(item.winId!); onClose() }}>查看和牌結果</button>}<div>{POSITIONS.map((seat) => <span key={seat}>{name(seat)} {item.deltas[seat] >= 0 ? '+' : ''}{item.deltas[seat]} </span>)}</div></li>)}</ul>
      {latestOutcome && latestOutcome.type !== 'win' && <button className="secondary-button action-wide" type="button" onClick={() => run(undoLatestDraw)}>撤回最近流局</button>}
      {['between', 'end-decision'].includes(match.phase) && <>{match.phase === 'end-decision' && <p role="status">已到原定最後一局。請明確選擇結束或延長牌局。</p>}<button className="primary-button action-wide" type="button" onClick={() => run((s) => prepareNext(s, 'continue'))}>{match.phase === 'end-decision' ? '延長牌局並準備下一局' : '準備下一局'}</button>{match.phase === 'end-decision' && <button className="secondary-button action-wide" type="button" onClick={() => run((s) => prepareNext(s, 'end'))}>結束牌局</button>}</>}
      {match.phase === 'ended' && <p>牌局已結束。重設開局可開始新牌局；舊記錄保留。</p>}
    </> : <>
      {view === 'four-kan' ? <><p>本局已有至少兩位玩家合共開槓四次。請確認第四槓後已由王牌補嶺上牌、完成出牌，而且沒有玩家和牌。</p><p>莊家與局數不變，本場加一；不作聽牌／未聽牌支付，供託保留。</p><button className="secondary-button action-wide" type="button" onClick={() => run((s) => ({ ...s, gameplay: markFourKan(s.gameplay!, 'deferred') }))}>尚未完成／返回牌局</button><button className="secondary-button action-wide" type="button" onClick={() => { run((s) => ({ ...s, gameplay: markFourKan(s.gameplay!, 'win-pending') }), false); setWinner(true) }}>有人和牌</button>{winner && <div className="player-action-grid">{POSITIONS.map((seat) => <button type="button" key={seat} onClick={() => { onWin(seat); onClose() }}>{name(seat)} 和牌</button>)}</div>}</>
        : <><p>只在實體牌局已確認流局時結算。未回答不會視為未聽牌。</p>{match.variant === 'riichi' && POSITIONS.map((seat) => <fieldset className="tenpai-player" key={seat}><legend>{settings.players[seat]?.avatar} {name(seat)}（{winds[seat]}）</legend>{[true, false].map((answer) => <label key={String(answer)}><input type="radio" name={'tenpai-' + seat} checked={tenpai[seat] === answer} onChange={() => { setTenpai({ ...tenpai, [seat]: answer }); setConfirmed(false) }} />{answer ? '聽牌 (Tenpai)' : '未聽牌 (Noten)'}</label>)}</fieldset>)}</>}
      {preview && <section className="draw-preview"><h3>結算預覽</h3>{deltas && <ul>{POSITIONS.map((seat) => <li key={seat}>{name(seat)}：{deltas[seat] >= 0 ? '+' : ''}{deltas[seat]} → {preview.points[seat]}</li>)}</ul>}<p>下一局：{roundLabel({ ...match, ...preview })} · 莊家 {name(preview.dealer)}{match.variant === 'riichi' && <> · {preview.honba} 本場 · 供託 {preview.pool}</>}</p></section>}
      <label className="check-line"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{view === 'four-kan' ? '第四槓後已完成出牌，而且沒有人和牌' : '已與四位玩家核對流局及以上結果'}</label>
      <div className="sheet-buttons"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" disabled={!ready || !confirmed || match.winPending || winner} onClick={() => run((s) => finalizeDraw(s, match.roundId, type, match.variant === 'riichi' && view === 'draw' ? tenpai as Tenpai : undefined, confirmed), false)}>{view === 'four-kan' ? '確認四槓散了' : '確認流局'}</button></div>
      {match.winPending && <p role="alert">和牌待處理，流局已鎖定。請由局名開啟摘要核對。</p>}
    </>}
    {error && <p role="alert" className="game-error">{error}</p>}
  </Sheet>
}
