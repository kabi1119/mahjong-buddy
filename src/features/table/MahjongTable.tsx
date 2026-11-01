import { POSITIONS, POSITION_LABELS } from '../../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../../types/mahjong'
import { assignSeatWinds } from '../game/rules'
import type { GameSetup } from '../game/setup'
interface Props { players: Partial<Record<PlayerPosition, Player>>; variant: MahjongVariant; setup: GameSetup; pickingDealer: boolean; onEdit: (position: PlayerPosition) => void; disabled?: boolean }
export function MahjongTable({ players, variant, setup, pickingDealer, onEdit, disabled }: Props) {
  const winds = setup.dealer ? assignSeatWinds(setup.dealer) : null
  return <div className="mahjong-table" aria-label="四人麻雀枱">
    <div className="felt-border" aria-hidden="true" />
    <span className="table-corner corner-top" aria-hidden="true">✧</span><span className="table-corner corner-bottom" aria-hidden="true">✧</span>
    {POSITIONS.map((position) => {
      const player = players[position]
      return <button type="button" disabled={disabled} className={`player-seat seat-${position} ${player ? 'occupied' : ''} ${setup.dealer === position ? 'dealer-seat' : ''} ${setup.turn === position ? 'current-seat' : ''}`} key={position} onClick={() => onEdit(position)} aria-current={setup.turn === position ? 'true' : undefined} aria-label={player ? `${pickingDealer ? '選為莊家' : '編輯'}${POSITION_LABELS[position]}玩家：${player.nickname}` : `加入${POSITION_LABELS[position]}玩家`}>
        {setup.dealer === position && <span className="dealer-badge">東 · 莊</span>}<span className="seat-avatar" aria-hidden="true">{player?.avatar ?? '+'}</span><span className="seat-name">{player?.nickname ?? '加入牌友'}</span><span className="seat-label">{POSITION_LABELS[position]}座位{winds && ` · ${winds[position]}`}{setup.turn === position && ' · 輪到你'}</span>
      </button>
    })}
    <div className="table-center"><span className="center-tiles" aria-hidden="true"><i>發</i><i>中</i><i>白</i></span><strong>{variant === 'hong-kong' ? '香港麻雀' : '四人立直'}</strong><span className="waiting-status">{setup.phase === 'playing' ? `手動 · ${setup.turn && winds?.[setup.turn]}家行牌` : setup.phase === 'wall-guide' ? '等待完成配牌' : setup.phase === 'ready-to-roll' ? '等待擲骰' : '等待選莊'}</span><div className="round-placeholder"><span>門風 <b>{winds ? '已分配' : '—'}</b></span><span>莊家 <b>{setup.dealer ? '東' : '—'}</b></span></div></div>
  </div>
}
