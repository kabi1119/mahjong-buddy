import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { POSITIONS } from '../../types/mahjong'
import type { Settings } from '../../storage/settings'
import type { Points } from '../match/models'
import { TileFace, TileRow } from '../hands/TilePicker'
import { FLOWERS } from '../hands/tiles'
import { seatWindIndex } from './evaluate'
import { finalizeWinningRound } from './settlement'
import { roundLabel, prepareNext } from '../match/engine'
import type { LockedWin, ScoreResult } from './models'
const subscribe = (notify: () => void) => { const media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); media?.addEventListener?.('change', notify); return () => media?.removeEventListener?.('change', notify) }
const snapshot = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const useReducedMotion = () => useSyncExternalStore(subscribe, snapshot, () => false)
function VictoryReveal({ score, reduced }: { score: ScoreResult; reduced: boolean }) {
  const id = useId().replaceAll(':', '')
  const tier = score.variant === 'riichi' ? score.tier : 0
  const particles = reduced ? 0 : [0, 0, 6, 12, 16, 24, 30, 36, 42][tier]
  const fiery = tier >= 5 && !reduced
  const purple = tier >= 7
  return <div className={`victory-reveal tier-${tier} ${reduced ? 'motion-reduced' : ''}`} aria-label={score.label}>
    <svg viewBox="0 0 480 190" aria-hidden="true" className="victory-art">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff8d9" /><stop offset=".55" stopColor="#f8d887" /><stop offset="1" stopColor="#c99432" /></linearGradient>
        {fiery && <filter id={`${id}-fire`} x="-40%" y="-100%" width="180%" height="300%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".025 .06" numOctaves="2" seed="8" result="noise"><animate attributeName="baseFrequency" values=".025 .06;.033 .09;.025 .06" dur={tier >= 7 ? '2.2s' : '3s'} repeatCount="indefinite" /></feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={8 + tier * 2} xChannelSelector="R" yChannelSelector="G" result="distorted" />
          <feMorphology in="distorted" operator="dilate" radius="1.5" /><feGaussianBlur stdDeviation="1.8" />
          <feColorMatrix type="matrix" values={purple ? '1 0 0 0 .2 0 .2 0 0 0 0 0 1 0 .2 0 0 0 1 0' : '1 0 0 0 .2 0 .5 0 0 .1 0 0 0 0 0 0 0 0 1 0'} />
        </filter>}
        <clipPath id={`${id}-letters`}><text x="240" y="111" textAnchor="middle" fontWeight="800" fontSize="38">{score.label}</text></clipPath>
        <linearGradient id={`${id}-shine`}><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff9d5" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      {!reduced && tier >= 4 && <g className="energy-rings" fill="none" stroke={purple ? '#d997ef' : '#e99d57'}>{Array.from({ length: tier >= 7 ? 3 : 2 }, (_, index) => <ellipse key={index} cx="240" cy="98" rx={150 + index * 12} ry={48 + index * 9} strokeWidth={index ? 1 : 2} />)}</g>}
      {tier >= 6 && <path className="victory-crest" d="M220 43 216 27 231 34 240 19 249 34 264 27 260 43Z" fill={`url(#${id}-gold)`} stroke="#a56828" />}
      {fiery && <text className="burning-letters" x="240" y="111" textAnchor="middle" fontWeight="800" fontSize="38" fill={purple ? '#d685ed' : '#ffc14f'} stroke={purple ? '#de6ec2' : '#ef6d2e'} strokeWidth="3" filter={`url(#${id}-fire)`}>{score.label}</text>}
      <text className="victory-title" x="240" y="111" textAnchor="middle" fontWeight="800" fontSize="38" fill={`url(#${id}-gold)`} stroke="#79532a" strokeWidth=".4">{score.label}</text>
      {!reduced && tier >= 2 && <g clipPath={`url(#${id}-letters)`}><rect className="victory-shine" x="-100" y="60" width="100" height="65" fill={`url(#${id}-shine)`} /></g>}
      {Array.from({ length: particles }, (_, index) => <circle className="gold-spark" key={index} cx={48 + (index * 71 % 384)} cy={52 + (index * 37 % 94)} r={index % 3 === 0 ? 1.8 : 1} fill={purple && index % 3 === 0 ? '#dfb8fb' : '#ffe6a0'} style={{ animationDelay: `${index * -.17}s`, animationDuration: `${1.5 + index % 5 * .25}s` }} />)}
    </svg>
  </div>
}
function AnimatedScoreboard({ before, after, win, settled, names, dealer }: { before: Points; after: Points; win: LockedWin; settled: boolean; names: Record<string, { nickname: string; avatar: string }>; dealer: import('../../types/mahjong').PlayerPosition }) {
  const reduced = useReducedMotion()
  const [animated, setAnimated] = useState(before)
  useEffect(() => {
    if (!settled || reduced) return
    let frame = 0; let start: number | null = null
    const tick = (time: number) => {
      start ??= time; const progress = Math.min(1, (time - start) / 1700); const eased = 1 - (1 - progress) ** 3
      setAnimated(Object.fromEntries(POSITIONS.map((seat) => [seat, progress === 1 ? after[seat] : Math.round(before[seat] + (after[seat] - before[seat]) * eased)])) as Points)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => { frame = requestAnimationFrame(tick) }, 1250)
    return () => { clearTimeout(timer); cancelAnimationFrame(frame) }
  }, [settled, reduced, before, after])
  const amounts = settled && reduced ? after : animated
  return <div className="scoreboard" aria-label="四人結算"><span className="sr-only" role="status">{settled ? '結算已完成' : '結算預覽，尚未支付'}</span>{POSITIONS.map((seat) => <article className="score-card" key={seat}>
    <header><span>{names[seat]?.avatar} {names[seat]?.nickname}</span><small>{['東', '南', '西', '北'][seatWindIndex(dealer, seat) - 27]}</small></header>
    <small>結算前 {before[seat].toLocaleString()}</small>
    <strong className="score-amount">{amounts[seat].toLocaleString()}</strong>
    <span className={`score-delta ${win.score.deltas[seat] > 0 ? 'positive' : win.score.deltas[seat] < 0 ? 'negative' : ''}`}>{win.score.deltas[seat] > 0 ? '+' : ''}{win.score.deltas[seat].toLocaleString()}</span>
    {!settled && <small>確認後 {after[seat].toLocaleString()}</small>}
  </article>)}</div>
}
export function ResultPanel({ settings, win, onUpdate, onClose, storageStatus }: { storageStatus: string; settings: Settings; win: LockedWin; onUpdate: (update: (s: Settings) => Settings) => void; onClose: () => void }) {
  const reduced = useReducedMotion(); const [replay, setReplay] = useState(0); const [confirmed, setConfirmed] = useState(false); const [error, setError] = useState('')
  const data = settings.gameplay!; const match = [data.match, ...(data.pastMatches ?? [])].find((item) => item?.roundId === win.roundId || item?.history.some((outcome) => outcome.winId === win.id)) ?? data.match!
  const outcome = match.history.find((item) => item.winId === win.id)
  const round = data.rounds.find((item) => item.id === win.roundId)!
  const before = outcome?.before.points ?? match.points
  const after = outcome?.after.points ?? Object.fromEntries(POSITIONS.map((seat) => [seat, before[seat] + win.score.deltas[seat]])) as Points
  const settled = win.status === 'finalized'
  const archivedLock = win.status === 'locked' && data.activeRoundId !== win.roundId
  const next = outcome?.after
  return <section className="scoring-result">
    <p className="action-player">{round.players[win.draft.winner].avatar} {round.players[win.draft.winner].nickname} · {win.draft.win.method === 'tsumo' ? '自摸' : win.score.variant === 'riichi' ? '榮和' : '食出銃'}</p>
    {win.draft.win.sourcePlayer && <p>來源：{round.players[win.draft.win.sourcePlayer].nickname}</p>}
    <p role="status">{archivedLock ? '已封存的鎖定手牌，沒有支付；不可在新局套用' : win.status === 'locked' ? '手牌已鎖定 · 以下為結算預覽，尚未支付' : win.status === 'reversed' ? '此結算已經審計撤銷；原快照保留' : '結算已儲存 · 動畫不會重複支付'}</p>
    <VictoryReveal key={`reveal:${win.id}:${win.status}:${replay}`} score={win.score} reduced={reduced} />
    <p className="score-total">{win.score.variant === 'hong-kong' ? `${win.score.fan} 番（原始 ${win.score.rawFan} 番）` : win.score.yakuman ? `${win.score.yakuman} 倍真正役滿` : win.score.han >= 13 ? `${win.score.han} 飜` : `${win.score.han} 飜 ${win.score.fu} 符`}</p>
    <h3>完整手牌</h3><TileRow tiles={win.draft.concealed} />{win.draft.winningTile && <div className="winning-tile"><TileFace type={win.draft.winningTile.type} red={win.draft.winningTile.red} /><small>和牌張</small></div>}
    {win.draft.melds.map((meld) => <article className="meld-card" key={meld.id}><small>{meld.kind === 'chi' ? '順子' : meld.kind === 'pon' ? '碰' : meld.kind === 'ankan' ? '暗槓' : meld.kind === 'shouminkan' ? '加槓' : '大明槓'} · {meld.open ? '明' : '暗'}</small><TileRow tiles={meld.tiles} /></article>)}
    {win.draft.flowers.length > 0 && <p>花牌：{win.draft.flowers.map((flower) => FLOWERS[flower]).join('、')}</p>}
    <h3>計分明細</h3><ul className="score-components">{win.score.components.map((item, index) => <li key={index}><span>{item.name}</span><b>{item.value} {item.kind === 'yakuman' ? '倍役滿' : item.kind === 'fan' ? '番' : '飜'}</b></li>)}</ul>
    {win.score.bonuses && <p className="action-note">寶牌 {win.score.bonuses.dora} · 槓寶牌 {win.score.bonuses.kanDora} · 裏寶牌 {win.score.bonuses.ura} · 槓裏 {win.score.bonuses.kanUra} · 赤寶牌 {win.score.bonuses.redDora}{win.score.yakuman > 0 && '（真正役滿不加算寶牌飜）'}</p>}
    {win.score.fuBreakdown.length > 0 && <details><summary>符數明細（{win.score.fu} 符）</summary><ul className="score-components">{win.score.fuBreakdown.map((item, index) => <li key={index}>{item.name}<b>{item.value}</b></li>)}</ul></details>}
    {win.draft.indicators.length > 0 && <details><summary>寶牌／裏寶牌指示牌</summary>{win.draft.indicators.map((item) => <div className="indicator-card" key={item.id}><span>{item.kind === 'ura' ? '裏寶牌' : '寶牌'}</span><TileFace type={item.tile.type} red={item.tile.red} /></div>)}</details>}
    <h3>四人結算</h3><AnimatedScoreboard key={`scores:${win.id}:${win.status}:${replay}`} win={win} before={before} after={after} settled={settled} names={round.players} dealer={round.dealer} />
    <ul className="payment-list">{win.score.payments.map((payment, index) => <li key={index}>{round.players[payment.from].nickname} → {round.players[payment.to].nickname}：{payment.amount.toLocaleString()} <small>{payment.reason}</small></li>)}</ul>
    {win.score.poolDelta < 0 && <p>供託立直棒：贏家收取 {(-win.score.poolDelta).toLocaleString()}，不會再次扣除宣告點數。</p>}
    {win.status === 'locked' && !archivedLock && <><label className="check-line"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />四位玩家已核對計分、付款及供託，確認正式結算</label><button type="button" className="primary-button action-wide" disabled={!confirmed || storageStatus !== 'saved'} onClick={() => { try { onUpdate((current) => finalizeWinningRound(current, win.id, confirmed)); setError('') } catch (err) { setError(err instanceof Error ? err.message : '結算失敗。') } }}>確認結算並結束本局</button></>}
    {settled && <><button className="secondary-button action-wide" type="button" onClick={() => setReplay((value) => value + 1)}>重播結果動畫</button>{next && <p>下一局：{roundLabel({ ...match, ...next })}{match.variant === 'riichi' && ` · ${next.honba} 本場`}</p>}{data.match?.roundId === next?.roundId && data.match?.phase === 'between' && <button className="primary-button action-wide" type="button" onClick={() => { onUpdate((current) => prepareNext(current)); onClose() }}>準備下一局</button>}{data.match?.phase === 'end-decision' && <p>已到原定最後一局，請關閉結果後從牌局摘要選擇結束或延長。</p>}</>}
    {storageStatus !== 'saved' && <p className="storage-warning">{storageStatus === 'saving' ? '正在儲存本機結算資料，請稍候。' : '未能持久儲存；資料目前只在記憶中，請勿關閉頁面。'}{storageStatus === 'error' && <button type="button" onClick={() => onUpdate((current) => ({ ...current }))}>重試本機儲存</button>}</p>}
    {error && <p className="game-error" role="alert">{error}</p>}
  </section>
}
