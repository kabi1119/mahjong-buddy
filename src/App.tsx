import { useState } from 'react'
import { PlayerEditor } from './features/players/PlayerEditor'
import { MahjongTable } from './features/table/MahjongTable'
import { POSITIONS, VARIANTS } from './types/mahjong'
import type { PlayerPosition } from './types/mahjong'
import { useSettings } from './storage/useSettings'
import { version } from '../package.json'
import { GameControls } from './features/game/GameControls'
import { diceCountFor, newSetup, updateSetup } from './features/game/setup'
import type { SetupAction } from './features/game/setup'
import { assignSeatWinds } from './features/game/rules'
import './App.css'

function App() {
  const { settings: { variant, players, setup: savedSetup }, status, updateSettings } = useSettings()
  const [editing, setEditing] = useState<PlayerPosition | null>(null)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [rolling, setRolling] = useState(false)
  const setup = savedSetup ?? newSetup()
  const playerCount = POSITIONS.filter((position) => players[position]).length
  const complete = playerCount === 4
  const pickingDealer = complete && setup.phase === 'selecting-dealer' && !editingPlayers
  const dispatch = (action: SetupAction) => updateSettings((current) => ({ ...current, setup: updateSetup(current.setup ?? newSetup(), action) }))
  const dealerName = setup.dealer ? players[setup.dealer]?.nickname : ''
  const turnWind = setup.dealer && setup.turn ? assignSeatWinds(setup.dealer)[setup.turn] : ''
  const context = !complete ? `點選座位加入牌友（${playerCount}/4）`
    : editingPlayers && setup.phase === 'selecting-dealer' ? '點選座位編輯牌友，再返回選莊'
    : setup.phase === 'selecting-dealer' ? setup.dealer ? `已選 ${dealerName} 為莊，可點選另一位更改` : '點選牌友選莊，再確認開局'
    : rolling ? '正在擲骰，請稍候…'
    : setup.phase === 'ready-to-roll' ? `${dealerName} 做莊 · ${diceCountFor(variant, setup)} 粒骰子，準備開門`
    : setup.phase === 'wall-guide' ? `${setup.dice?.reduce((sum, die) => sum + die, 0)} 點 · 按指引配牌，完成後確認`
    : `手動記錄：${players[setup.turn!]?.nickname}（${turnWind}）行牌`

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main-table" aria-label="麻雀小夥伴，前往牌桌">
          <img className="brand-logo" src="/mahjong.svg" alt="" width="44" height="44" />
          <span>麻雀小夥伴<small>MAHJONG BUDDY</small></span>
        </a>
        <span className="edition">v{version.replace(/-([a-z])$/, '$1')}</span>
      </header>
      <div className="mode-selector" role="group" aria-label="麻雀模式">
        {VARIANTS.map((mode) => (
          <button key={mode.id} type="button" disabled={status === 'loading' || rolling}
            aria-pressed={variant === mode.id} className={variant === mode.id ? 'mode active' : 'mode'}
            onClick={() => updateSettings((current) => ({ ...current, variant: mode.id }))}>
            <img className="mode-tile" src={mode.icon} alt="" aria-hidden="true" width="24" height="30" />
            {mode.label}
          </button>
        ))}
      </div>
      <section id="main-table" aria-labelledby="table-heading">
        <div className="section-heading">
          <div><p className="eyebrow">LET’S PLAY</p><h1 id="table-heading">齊人，開枱。</h1></div>
          <span className="table-variant">{variant === 'hong-kong' ? '港式四人' : '四人立直'}</span>
        </div>
        <MahjongTable players={players} variant={variant} setup={setup} pickingDealer={pickingDealer}
          onEdit={(position) => { if (pickingDealer) dispatch({ type: 'dealer', position }); else setEditing(position) }}
          disabled={status === 'loading' || rolling} />
        <p className="table-hint" aria-live="polite">{context}</p>
      </section>
      <GameControls key={variant} variant={variant} players={players} setup={setup}
        disabled={status === 'loading'} onAction={dispatch} onBusyChange={setRolling}
        onSelectDealer={() => setEditingPlayers(false)} editingPlayers={editingPlayers}
        onEditPlayers={() => setEditingPlayers((value) => !value)} />
      <footer className="app-footer">
        <span role="status" className={status === 'error' || status === 'unavailable' ? 'storage-warning' : 'storage-status'}>
          {status === 'loading' ? '正在讀取本機設定…' : status === 'saving' ? '正在儲存設定…' : status === 'saved' ? '設定已於此瀏覽器自動儲存' : status === 'unavailable' ? '無法讀取本機設定；本次變更只保留至重新整理，未覆寫原有資料。' : '未能儲存最新設定；請保留此頁面，下次確認變更時會再嘗試。'}
        </span>
      </footer>
      {editing && <PlayerEditor key={editing} position={editing} player={players[editing]}
        onSave={(player) => { updateSettings((current) => ({ ...current, players: { ...current.players, [player.position]: player } })); setEditing(null) }}
        onRemove={() => { updateSettings((current) => { const remaining = { ...current.players }; delete remaining[editing]; return { ...current, players: remaining } }); setEditing(null) }}
        onClose={() => setEditing(null)} />}
    </main>
  )
}
export default App
