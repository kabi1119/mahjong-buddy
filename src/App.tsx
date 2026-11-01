import { MatchSettings } from './features/match/MatchSettings'
import { MatchFlow } from './features/match/MatchFlow'
import type { MatchView } from './features/match/MatchFlow'
import { useTheme } from './features/match/useTheme'
import { resetMatch, roundLabel } from './features/match/engine'
import { PlayerActions } from './features/actions/PlayerActions'
import { WinFlow } from './features/hands/WinFlow'
import { activeRound, projectRound } from './features/actions/engine'
import { withActiveRound } from './features/actions/reconcile'
import './features/hands/hands.css'
import { useState } from 'react'
import { PlayerEditor } from './features/players/PlayerEditor'
import { MahjongTable } from './features/table/MahjongTable'
import { POSITIONS, MODE_CATALOG } from './types/mahjong'
import type { PlayerPosition } from './types/mahjong'
import { useSettings } from './storage/useSettings'
import { version } from '../package.json'
import { GameControls } from './features/game/GameControls'
import { diceCountFor, newSetup, updateSetup } from './features/game/setup'
import type { SetupAction } from './features/game/setup'
import './App.css'
import './themes.css'

function App() {
  const { settings, status, updateSettings } = useSettings()
  const { variant, players, setup: savedSetup, gameplay } = settings
  const theme = useTheme(settings.themePreference, status !== 'loading')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [matchView, setMatchView] = useState<MatchView | null>(null)
  const [dismissedFour, setDismissedFour] = useState('')
  const match = gameplay?.match
  const pendingFour = match?.pendingFourKan
  const autoFour = pendingFour?.status === 'pending' && pendingFour.signature !== dismissedFour && !match?.winPending

  const [editing, setEditing] = useState<PlayerPosition | null>(null)
  const [actionPlayer, setActionPlayer] = useState<PlayerPosition | null>(null)
  const [winPlayer, setWinPlayer] = useState<PlayerPosition | null>(null)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [rolling, setRolling] = useState(false)
  const setup = savedSetup ?? newSetup()
  const round = activeRound(gameplay)
  const riichiSeats = round && gameplay ? projectRound(gameplay, round.id).riichi.map((item) => item.playerId) : []
  const playerCount = POSITIONS.filter((position) => players[position]).length
  const complete = playerCount === 4
  const pickingDealer = complete && setup.phase === 'selecting-dealer' && !editingPlayers
  const dispatch = (action: SetupAction) => updateSettings((current) => ({ ...current, setup: updateSetup(current.setup ?? newSetup(), action) }))
  const dealerName = setup.dealer ? players[setup.dealer]?.nickname : ''
  const context = !complete ? `點選座位加入牌友（${playerCount}/4）`
    : editingPlayers && setup.phase === 'selecting-dealer' ? '點選座位編輯牌友，再返回選莊'
    : setup.phase === 'selecting-dealer' ? setup.dealer ? `已選 ${dealerName} 為莊，可點選另一位更改` : '點選牌友選莊，再確認開局'
    : rolling ? '正在擲骰，請稍候…'
    : setup.phase === 'ready-to-roll' ? `${dealerName} 做莊 · ${diceCountFor(variant, setup)} 粒骰子，準備開門`
    : setup.phase === 'wall-guide' ? `${setup.dice?.reduce((sum, die) => sum + die, 0)} 點 · 按指引配牌，完成後確認`
    : '點牌友記錄動作 · 點局名查看摘要'

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main-table" aria-label="麻雀小夥伴，前往牌桌">
          <img className="brand-logo" src="/mahjong.svg" alt="" width="44" height="44" />
          <span>麻雀小夥伴<small>MAHJONG BUDDY</small></span>
        </a>
        <div className="header-tools">
          <button className="theme-switch" type="button" role="switch" aria-label="深色模式"
            aria-checked={theme === 'dark'} disabled={status === 'loading'}
            onClick={() => updateSettings((current) => ({ ...current, themePreference: theme === 'dark' ? 'light' : 'dark' }))}>
            <span className="theme-switch-track" aria-hidden="true">
              <span className="theme-switch-knob">
                <svg className="theme-icon theme-sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="10" cy="10" r="3" />
                  <path d="M10 2v1m0 14v1M2 10h1m14 0h1M4.3 4.3l.7.7m10 10 .7.7M4.3 15.7l.7-.7M15 5l.7-.7" />
                </svg>
                <svg className="theme-icon theme-moon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15.9 12.7A6.5 6.5 0 0 1 7.3 4.1a6.5 6.5 0 1 0 8.6 8.6Z" />
                </svg>
              </span>
            </span>
          </button>
          <span className="edition">v{version.replace('-rc.', 'rc')}</span>
        </div>
      </header>
      <div className="mode-selector" role="group" aria-label="麻雀模式">
        {Object.values(MODE_CATALOG).map((mode) => (
          <button key={mode.id} type="button" disabled={!mode.available || status === 'loading' || rolling}
            aria-pressed={variant === mode.id} className={variant === mode.id ? 'mode active' : 'mode'}
            onClick={() => { if (mode.available) updateSettings((current) => ({ ...current, variant: mode.id })) }}>
            <img className="mode-tile" src={mode.icon} alt="" aria-hidden="true" width="24" height="30" />
            <span className="mode-label">{mode.label}{!mode.available && <small>Coming soon<br />敬請期待</small>}</span>
          </button>
        ))}
      </div>
      <section id="main-table" aria-labelledby="table-heading">
        <div className="section-heading">
          <div><p className="eyebrow">LET’S PLAY</p><h1 id="table-heading">齊人，開枱。</h1></div>
          <span className="table-variant">{variant === 'hong-kong' ? '港式四人' : '四人立直'}</span>
        </div>
        <MahjongTable players={players} variant={variant} setup={setup} pickingDealer={pickingDealer} riichiSeats={riichiSeats} roundText={roundLabel(match, variant)} honba={match?.honba}
          between={!!match && match.phase !== 'playing' && match.phase !== 'preparing'}
          onSettings={() => setRulesOpen(true)} onSummary={match ? () => setMatchView('summary') : undefined}
          onDraw={() => { if (!match) updateSettings(withActiveRound); setMatchView('draw') }}
          onEdit={(position) => { if (pickingDealer) dispatch({ type: 'dealer', position }); else if (setup.phase === 'playing') { if (!round || !match) updateSettings(withActiveRound); setActionPlayer(position) } else setEditing(position) }}
          disabled={status === 'loading' || rolling} />
        <p className="table-hint" aria-live="polite">{context}</p>
      </section>
      {pendingFour && pendingFour.status !== 'win-pending' && setup.phase === 'playing' && <button className="four-kan-notice secondary-button" type="button" onClick={() => setMatchView('four-kan')}>四槓散了條件 · 核對第四槓結果</button>}
      {match && ['between', 'end-decision', 'ended'].includes(match.phase) ? <button className="secondary-button" type="button" onClick={() => setMatchView('summary')}>查看流局結果及準備下一局</button> : <GameControls key={variant} variant={variant} players={players} setup={setup}
        disabled={status === 'loading'} onAction={dispatch} onBusyChange={setRolling}
        onSelectDealer={() => setEditingPlayers(false)} editingPlayers={editingPlayers}
        onEditPlayers={() => setEditingPlayers((value) => !value)} fixedDealer={!!match}
        onReset={(clear) => { updateSettings((current) => resetMatch(current, clear)); setEditingPlayers(false) }} />}
      {match?.phase === 'ended' && <button className="secondary-button" type="button" onClick={() => updateSettings((current) => resetMatch(current, false))}>開始新牌局（保留牌友）</button>}
      <footer className="app-footer">
        <span role="status" className={status === 'error' || status === 'unavailable' ? 'storage-warning' : 'storage-status'}>
          {status === 'loading' ? '正在讀取本機設定…' : status === 'saving' ? '正在儲存設定…' : status === 'saved' ? '設定已於此瀏覽器自動儲存' : status === 'unavailable' ? '無法讀取本機設定；本次變更只保留至重新整理，未覆寫原有資料。' : '未能儲存最新設定；請保留此頁面，下次確認變更時會再嘗試。'}
        </span>
        <p>測試版 · 尚未支援和牌計分<br />資料只存於此瀏覽器／裝置，不會同步；清除瀏覽資料可能移除記錄。 <a href="https://github.com/kabi1119/mahjong-buddy/issues" target="_blank" rel="noreferrer">回報問題</a></p>
      </footer>
      {rulesOpen && <MatchSettings settings={settings} onSave={updateSettings} onClose={() => setRulesOpen(false)} />}
      {match && !rulesOpen && !actionPlayer && !winPlayer && (matchView || autoFour) && <MatchFlow key={match.roundId + (matchView ?? 'auto')} settings={settings} view={matchView ?? (autoFour ? 'four-kan' : 'summary')} onUpdate={updateSettings} onClose={() => { setMatchView(null); if (pendingFour) setDismissedFour(pendingFour.signature) }} onRules={() => { setMatchView(null); setRulesOpen(true) }} onWin={setWinPlayer} />}
      {actionPlayer && round && gameplay && setup.phase === 'playing' && <PlayerActions data={gameplay} playerId={actionPlayer}
        onChange={(data) => updateSettings((current) => ({ ...current, gameplay: data }))}
        onClose={() => setActionPlayer(null)} onEdit={() => { setEditing(actionPlayer); setActionPlayer(null) }}
        onWin={() => { setWinPlayer(actionPlayer); setActionPlayer(null) }} />}
      {winPlayer && round && gameplay && setup.phase === 'playing' && <WinFlow data={gameplay} playerId={winPlayer}
        onChange={(data) => updateSettings((current) => ({ ...current, gameplay: data }))} onClose={() => setWinPlayer(null)} />}
      {editing && <PlayerEditor key={editing} position={editing} player={players[editing]}
        onSave={(player) => { updateSettings((current) => ({ ...current, players: { ...current.players, [player.position]: player } })); setEditing(null) }}
        onRemove={() => { updateSettings((current) => { const remaining = { ...current.players }; delete remaining[editing]; return { ...current, players: remaining } }); setEditing(null) }}
        onClose={() => setEditing(null)} />}
    </main>
  )
}
export default App
