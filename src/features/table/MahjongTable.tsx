import { POSITIONS, POSITION_LABELS } from '../../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
interface Props { players: Partial<Record<PlayerPosition, Player>>; variant: MahjongVariant; onEdit: (position: PlayerPosition) => void }
export function MahjongTable({ players, variant, onEdit }: Props) {
  return <div className="mahjong-table" aria-label="四人麻雀枱">
    <div className="felt-border" aria-hidden="true" />
    <span className="table-corner corner-top" aria-hidden="true">✧</span><span className="table-corner corner-bottom" aria-hidden="true">✧</span>
    {POSITIONS.map((position) => {
      const player = players[position]
      return <button type="button" className={`player-seat seat-${position} ${player ? 'occupied' : ''}`} key={position} onClick={() => onEdit(position)} aria-label={player ? `編輯${POSITION_LABELS[position]}玩家：${player.nickname}` : `加入${POSITION_LABELS[position]}玩家`}>
        <span className="seat-avatar" aria-hidden="true">{player?.avatar ?? '+'}</span><span className="seat-name">{player?.nickname ?? '加入牌友'}</span><span className="seat-label">{POSITION_LABELS[position]}座位{player && ' · 編輯'}</span>
      </button>
    })}
    <div className="table-center"><span className="center-tiles" aria-hidden="true"><i>發</i><i>中</i><i>白</i></span><strong>{variant === 'hong-kong' ? '香港麻雀' : '四人立直'}</strong><span className="waiting-status">等待開局</span><div className="round-placeholder"><span>圈風 <b>—</b></span><span>莊家 <b>—</b></span></div></div>
  </div>
}
