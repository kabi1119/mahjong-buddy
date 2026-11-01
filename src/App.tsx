import { useState } from 'react'
import { PlayerEditor } from './features/players/PlayerEditor'
import { MahjongTable } from './features/table/MahjongTable'
import { VARIANTS } from './types/mahjong'
import type { PlayerPosition } from './types/mahjong'
import { useSettings } from './storage/useSettings'
import { version } from '../package.json'
import './App.css'

function App() {
  const { settings: { variant, players }, status, updateSettings } = useSettings()
  const [editing, setEditing] = useState<PlayerPosition | null>(null)
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main-table" aria-label="麻雀伴侶，前往牌桌"><span className="brand-tile" aria-hidden="true">發</span><span>麻雀伴侶<small>MAHJONG COMPANION</small></span></a>
        <span className="edition">v{version}</span>
      </header>
      <div className="mode-selector" role="group" aria-label="麻雀模式">
        {VARIANTS.map((mode) => <button key={mode.id} type="button" disabled={status === 'loading'} aria-pressed={variant === mode.id} className={variant === mode.id ? 'mode active' : 'mode'} onClick={() => updateSettings((current) => ({ ...current, variant: mode.id }))}><span aria-hidden="true">{mode.id === 'hong-kong' ? '發' : '中'}</span>{mode.label}</button>)}
      </div>
      <div className="mode-caption" aria-live="polite"><span className="status-dot" />{variant === 'hong-kong' ? '港式傳統・四人麻雀' : '四人立直・日本麻雀'}</div>
      <section id="main-table" aria-labelledby="table-heading">
        <div className="section-heading"><div><p className="eyebrow">LET’S PLAY</p><h1 id="table-heading">齊人，開枱。</h1></div><span className="player-count" aria-live="polite">{Object.keys(players).length}<span> / 4 位入座</span></span></div>
        <MahjongTable players={players} variant={variant} onEdit={setEditing} disabled={status === 'loading'} />
        <p className="table-hint"><span aria-hidden="true">＋</span> 點選座位，加入你的牌友</p>
      </section>
      <section className="preparation" aria-labelledby="preparation-heading">
        <div className="preparation-title"><h2 id="preparation-heading">開局準備</h2><span>即將推出</span></div>
        <div className="upcoming-features"><div><span className="feature-icon" aria-hidden="true">莊</span><span>選擇莊家</span></div><div><span className="feature-icon dice" aria-hidden="true">⚄</span><span>擲骰開局</span></div><div><span className="feature-icon wall-icon" aria-hidden="true">▥</span><span>開門提示</span></div></div>
        <p>先設定牌友，為下一場好牌做好準備。</p>
      </section>
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
