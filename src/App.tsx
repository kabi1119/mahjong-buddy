import { useState } from 'react'
import { PlayerEditor } from './features/players/PlayerEditor'
import { MahjongTable } from './features/table/MahjongTable'
import { POSITIONS, VARIANTS } from './types/mahjong'
import type { PlayerPosition } from './types/mahjong'
import { useSettings } from './storage/useSettings'
import { version } from '../package.json'
import { GameControls } from './features/game/GameControls'
import { newSetup, updateSetup } from './features/game/setup'
import type { SetupAction } from './features/game/setup'
import './App.css'

function App() {
  const { settings: { variant, players, setup: savedSetup }, status, updateSettings } = useSettings()
  const [editing, setEditing] = useState<PlayerPosition | null>(null)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [rolling, setRolling] = useState(false)
  const setup = savedSetup ?? newSetup()
  const complete = POSITIONS.every((position) => players[position])
  const pickingDealer = complete && setup.phase === 'selecting-dealer' && !editingPlayers
  const dispatch = (action: SetupAction) => updateSettings((current) => ({ ...current, setup: updateSetup(current.setup ?? newSetup(), action) }))
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main-table" aria-label="麻雀伴侶，前往牌桌"><span className="brand-tile" aria-hidden="true">發</span><span>麻雀伴侶<small>MAHJONG COMPANION</small></span></a>
        <span className="edition">v{version}</span>
      </header>
      <div className="mode-selector" role="group" aria-label="麻雀模式">
        {VARIANTS.map((mode) => <button key={mode.id} type="button" disabled={status === 'loading' || rolling} aria-pressed={variant === mode.id} className={variant === mode.id ? 'mode active' : 'mode'} onClick={() => updateSettings((current) => ({ ...current, variant: mode.id }))}><span aria-hidden="true">{mode.id === 'hong-kong' ? '發' : '中'}</span>{mode.label}</button>)}
      </div>
      <div className="mode-caption" aria-live="polite"><span className="status-dot" />{variant === 'hong-kong' ? '港式傳統・四人麻雀' : '四人立直・日本麻雀'}</div>
      <section id="main-table" aria-labelledby="table-heading">
        <div className="section-heading"><div><p className="eyebrow">LET’S PLAY</p><h1 id="table-heading">齊人，開枱。</h1></div><span className="player-count" aria-live="polite">{Object.keys(players).length}<span> / 4 位入座</span></span></div>
        <MahjongTable players={players} variant={variant} setup={setup} pickingDealer={pickingDealer} onEdit={(position) => { if (pickingDealer) dispatch({ type: 'dealer', position }); else setEditing(position) }} disabled={status === 'loading' || rolling} />
        <p className="table-hint">{pickingDealer ? '點選玩家選莊，確認前可以更改' : '點選座位，加入或編輯牌友'}{complete && setup.phase === 'selecting-dealer' && <button type="button" className="text-action" onClick={() => setEditingPlayers((value) => !value)}>{editingPlayers ? '返回選莊' : '編輯牌友'}</button>}</p>
      </section>
      <GameControls key={variant} variant={variant} players={players} setup={setup} disabled={status === 'loading'} onAction={dispatch} onBusyChange={setRolling} onSelectDealer={() => setEditingPlayers(false)} />
      <footer className="app-footer"><span aria-hidden="true">✧</span> 實體牌局的小幫手，陪你享受每一圈。
        <small role="status" className={status === 'error' || status === 'unavailable' ? 'storage-warning' : undefined}>
          {status === 'loading' ? '正在讀取本機設定…' : status === 'saving' ? '正在儲存設定…' : status === 'saved' ? '設定已於此瀏覽器自動儲存' : status === 'unavailable' ? '無法讀取本機設定；本次變更只保留至重新整理，未覆寫原有資料。' : '未能儲存最新設定；請保留此頁面，下次確認變更時會再嘗試。'}
        </small>
      </footer>
      {editing && <PlayerEditor key={editing} position={editing} player={players[editing]}
        onSave={(player) => { updateSettings((current) => ({ ...current, players: { ...current.players, [player.position]: player } })); setEditing(null) }}
        onRemove={() => { updateSettings((current) => { const remaining = { ...current.players }; delete remaining[editing]; return { ...current, players: remaining } }); setEditing(null) }}
        onClose={() => setEditing(null)} />}
    </main>
  )
}
export default App
