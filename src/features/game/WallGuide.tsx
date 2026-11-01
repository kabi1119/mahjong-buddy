import { useEffect, useRef } from 'react'
import { POSITIONS, POSITION_LABELS } from '../../types/mahjong'
import type { Player, PlayerPosition } from '../../types/mahjong'
import { assignSeatWinds, RIGHT_END_GUIDE, wallStackPoint } from './rules'
import type { DiceValue, WallBreak, WallStack } from './rules'

interface Props {
  result: WallBreak
  dice: DiceValue[]
  dealer: PlayerPosition
  players: Partial<Record<PlayerPosition, Player>>
  onClose: () => void
  onDealt?: () => void
}
const same = (a: WallStack, b: WallStack | null) => a.wall === b?.wall && a.index === b.index

export function WallGuide({ result, dice, dealer, players, onClose, onDealt }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const winds = assignSeatWinds(dealer)
  const owner = (wall: PlayerPosition) => `${players[wall]?.nickname ?? POSITION_LABELS[wall]}（${winds[wall]}）`
  const location = (stack: WallStack) => `${owner(stack.wall)}牌牆，從該玩家右端起第 ${stack.index + 1} 棟`
  const direction = RIGHT_END_GUIDE[result.wall]
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  return <dialog ref={ref} className="player-dialog wall-guide" aria-labelledby="wall-guide-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="sheet-handle" aria-hidden="true" />
    <div className="editor-header"><h2 id="wall-guide-title">開門指引</h2><button type="button" className="close-button" onClick={onClose} aria-label="關閉開門指引">×</button></div>
    <ol className="guide-steps">
      <li><h3>骰子結果</h3><DiceFaces dice={dice} /><p>由莊家 {owner(dealer)} 作 1，逆時針數東 → 南 → 西 → 北。</p></li>
      <li><h3>揀選牌牆</h3><p>數到 {result.total}：在 <strong>{owner(result.wall)}</strong> 面前的牌牆開門。</p>
        <svg className="wall-diagram" viewBox="0 0 320 320" role="img" aria-label={`俯視圖：${owner(result.wall)}牌牆開門；綠色為起手位置，金色為王牌，星號為寶牌指示牌。`}>
          <defs><marker id="count-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f9dc95" /></marker></defs>
          <rect x="27" y="27" width="266" height="266" rx="22" fill="#244f3f" />
          {(() => {
            const arrows = { top: [65, 77, 255, 77], right: [243, 65, 243, 255], bottom: [255, 243, 65, 243], left: [77, 255, 77, 65] }
            const [x1, y1, x2, y2] = arrows[result.wall]
            return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f9dc95" strokeWidth="1.5" markerEnd="url(#count-arrow)" />
          })()}
          {POSITIONS.flatMap((wall) => Array.from({ length: result.stacksPerWall }, (_, index) => {
            const stack = { wall, index }
            const point = wallStackPoint(stack, result.stacksPerWall)
            const horizontal = wall === 'top' || wall === 'bottom'
            const dead = result.deadWall.some((item) => same(stack, item))
            const first = same(stack, result.firstLive)
            const dora = same(stack, result.dora)
            const tail = !result.deadWall.length && same(stack, result.replacementEnd)
            return <g key={`${wall}-${index}`}><rect x={point.x - (horizontal ? 4.5 : 9)} y={point.y - (horizontal ? 9 : 4.5)} width={horizontal ? 9 : 18} height={horizontal ? 18 : 9} rx="1.5" fill={dead ? '#dbb96f' : first ? '#9fe5c1' : tail ? '#e59c80' : '#eae9d9'} stroke={wall === result.wall ? '#f9dc95' : '#4b725b'} strokeWidth={wall === result.wall ? 1.5 : .5} />{(dora || first || tail) && <text x={point.x} y={point.y + 3} textAnchor="middle" fontSize="9" fill="#17382d">{dora ? '★' : first ? '始' : '尾'}</text>}</g>
          }))}
          <text x="160" y="118" textAnchor="middle" fill="#f4efda" fontSize="14">順時針取牌 ↻</text>
          <text x="160" y="145" textAnchor="middle" fill="#d5dfc8" fontSize="11">金框：開門牌牆</text>
          <text x="160" y="165" textAnchor="middle" fill="#9fe5c1" fontSize="11">始：莊家第一棟</text>
          <text x="160" y="185" textAnchor="middle" fill="#dbb96f" fontSize="11">{result.deadWall.length ? '金色：王牌　★：指示牌' : '尾：補花／補槓端'}</text>
          {POSITIONS.map((wall) => {
            const positions = { top: [160, 15], bottom: [160, 311], left: [18, 158], right: [302, 158] }
            const [x, y] = positions[wall]
            return <text key={wall} x={x} y={y} textAnchor="middle" fontSize="11" fill="#244f3f">{winds[wall]}{wall === dealer ? '莊' : ''}</text>
          })}
          {(() => {
            const p = wallStackPoint(result.counted, result.stacksPerWall)
            const dx = result.wall === 'top' ? 1 : result.wall === 'bottom' ? -1 : 0
            const dy = result.wall === 'right' ? 1 : result.wall === 'left' ? -1 : 0
            const x = p.x + dx * 105 / result.stacksPerWall
            const y = p.y + dy * 105 / result.stacksPerWall
            return <circle cx={x} cy={y} r="5" fill="#be624a" stroke="#fff3d5" strokeWidth="1.5" />
          })()}
        </svg>
        <ul className="wall-owners">{POSITIONS.map((wall) => <li key={wall}>{POSITION_LABELS[wall]}：{owner(wall)}</li>)}</ul>
      </li>
      <li><h3>從玩家右端數 {result.total} 棟</h3><p>面向牌牆的 {owner(result.wall)}，其右手端是<strong>{direction.start}</strong>。沿畫面<strong>{direction.direction}</strong>數，在第 {result.total} 棟之後開門。每棟兩張。</p>
        <div className="counted-strip" style={{ gridTemplateColumns: `repeat(${result.stacksPerWall}, minmax(0, 1fr))` }} aria-label="按玩家右端至左端排列的棟數">
          {Array.from({ length: result.stacksPerWall }, (_, index) => <span key={index} className={index + 1 === result.total ? 'break-stack' : index < result.total ? 'counted-stack' : ''}>{index + 1}</span>)}
        </div><p className="guide-note">上列為數數清單（右端 1 → 左端 {result.stacksPerWall}），實際畫面方向請按俯視圖。紅點／紅框：第 {result.total} 棟後的開門位置。</p>
      </li>
      <li><h3>莊家開始配牌</h3><p>第一棟：<strong>{location(result.firstLive)}</strong>。由開門後的活牌端順時針繼續取牌；跨角時接到下一幅牌牆的玩家右端。</p>
        <p>配牌次序：{[dealer, ...Array.from({ length: 3 }, (_, index) => POSITIONS[(POSITIONS.indexOf(dealer) - index - 1 + 4) % 4])].map(owner).join(' → ')}。每家每次取兩棟，共三輪；莊家再取下一棟及第三棟的上層牌（跳牌），閒家依序各取下一張。莊家起手 14 張，其他各 13 張。</p>
        {result.dora ? <><p><strong>王牌不可作普通摸牌。</strong>由開門處向取牌反方向留起七棟（14 張），可能跨角延伸至另一幅牌牆。</p><p>寶牌指示牌：<strong>{location(result.dora)}</strong>的上層牌，即由開門處沿王牌端倒數第 3 棟。只翻開指示牌，不是直接指定寶牌。</p></> : <p>補花／補槓從尾端開始：<strong>{location(result.replacementEnd)}</strong>，沿普通取牌的反方向取用。本版採有花 18 棟、摸到尾，不固定留王牌；補花次序的家規請開局前約定。</p>}
      </li>
    </ol>
    <div className="editor-actions"><button type="button" className="secondary-button" onClick={onClose}>返回牌桌</button>{onDealt && <button type="button" className="primary-button" onClick={onDealt}>已完成配牌</button>}</div>
  </dialog>
}

export function DiceFaces({ dice }: { dice: DiceValue[] }) {
  return <div className="dice-result" aria-label={`骰子 ${dice.join('、')}，合共 ${dice.reduce((sum, die) => sum + die, 0)} 點`}><span aria-hidden="true">{dice.map((die, index) => <span className="die-face" key={index}>{['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1]}</span>)}</span><strong>合共 {dice.reduce((sum, die) => sum + die, 0)} 點</strong></div>
}
