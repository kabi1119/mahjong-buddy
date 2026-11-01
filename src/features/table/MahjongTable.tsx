import { POSITIONS, POSITION_LABELS } from '../../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
import { assignSeatWinds } from '../game/rules'
import type { GameSetup } from '../game/setup'
interface Props { players: Partial<Record<PlayerPosition, Player>>; variant: MahjongVariant; setup: GameSetup; pickingDealer: boolean; onEdit: (position: PlayerPosition) => void; disabled?: boolean; riichiSeats?: PlayerPosition[]; roundText?: string; honba?: number; onSettings?: () => void; onDraw?: () => void; onSummary?: () => void; between?: boolean }
export function MahjongTable({ players, variant, setup, pickingDealer, onEdit, disabled, riichiSeats = [], roundText, honba = 0, onSettings, onDraw, onSummary, between }: Props) {
  const winds = setup.dealer ? assignSeatWinds(setup.dealer) : null
  return <div className="mahjong-table" aria-label="四人麻雀枱">
    <div className="felt-border" aria-hidden="true" />
    <span className="table-corner corner-top" aria-hidden="true">✧</span><span className="table-corner corner-bottom" aria-hidden="true">✧</span>
    {POSITIONS.map((position) => {
      const player = players[position]
      return <button type="button" disabled={disabled} className={`player-seat seat-${position} ${player ? 'occupied' : ''} ${setup.dealer === position ? 'dealer-seat' : ''}`} key={position} onClick={() => onEdit(position)} aria-label={player ? `${pickingDealer ? '選為莊家' : setup.phase === 'playing' ? '開啟動作選單：' : '編輯'}${POSITION_LABELS[position]}玩家：${player.nickname}` : `加入${POSITION_LABELS[position]}玩家`}>
        {setup.dealer === position && <span className="dealer-badge">東 · 莊</span>}<span className="seat-avatar" aria-hidden="true">{player?.avatar ?? '+'}</span><span className="seat-name">{player?.nickname ?? '加入牌友'}{riichiSeats.includes(position) && <span className="riichi-badge">立直</span>}</span><span className="seat-label">{POSITION_LABELS[position]}座位{winds && ` · ${winds[position]}`}</span>
      </button>
    })}
    <div className="table-center"><button type="button" className="round-title" onClick={onSummary ?? onSettings} disabled={disabled}><strong>{roundText ?? (variant === 'hong-kong' ? '東圈東局' : '東一局')}</strong></button>{variant === 'riichi' && <span>{honba} 本場</span>}<span className="center-dealer">{setup.dealer ? '莊家：' + players[setup.dealer]?.nickname : '等待選莊'}</span><button className="center-action" type="button" disabled={disabled} onClick={between ? onSummary : setup.phase === 'playing' ? onDraw : onSettings}>{between ? '牌局摘要' : setup.phase === 'playing' ? '流局' : '牌局設定'}</button></div>
  </div>
}
