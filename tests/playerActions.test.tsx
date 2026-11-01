import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from '../src/App'
import { PlayerActions } from '../src/features/actions/PlayerActions'
import { scoringGame } from './scoringFixtures'
import { loadSettings, saveSettings } from '../src/storage/settings'
import { projectRound, recordAction } from '../src/features/actions/engine'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { call, fourPlayers, newGame, ponGame } from './handFixtures'
import type { GameplayData } from '../src/features/actions/models'

const ready = updateSetup(updateSetup(newSetup(), { type: 'dealer', position: 'bottom' }), { type: 'confirm-dealer' })
const playing = updateSetup(updateSetup(ready, { type: 'rolled', dice: [1, 2, 3] }), { type: 'dealt' })
const saved = () => screen.findByText('設定已於此瀏覽器自動儲存')
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function launch(variant: 'hong-kong' | 'riichi' = 'hong-kong', data: GameplayData = newGame(variant)) {
  const setup = variant === 'riichi' ? { ...playing, dice: [1, 1] as (1 | 2 | 3)[] } : playing
  await saveSettings({ variant, players: fourPlayers, setup, gameplay: data })
  const app = render(<App />)
  await saved()
  return app
}
const seat = (position = '下方', name = 'bottom') => screen.getByRole('button', { name: `開啟動作選單：${position}玩家：${name}` })

describe('phase-aware player actions', () => {
  it('opens the editor before gameplay and only opens actions after dealing', async () => {
    await saveSettings({ variant: 'hong-kong', players: fourPlayers, setup: ready })
    const app = render(<App />)
    await saved()
    fireEvent.click(screen.getByRole('button', { name: '編輯下方玩家：bottom' }))
    expect(screen.getByRole('dialog', { name: '編輯牌友' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '食糊' })).toBeNull()
    await saved()
    app.unmount()
    await launch()
    fireEvent.click(seat())
    expect(screen.getByRole('dialog', { name: 'bottom・玩家動作' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '食糊' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '上牌' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '立直' })).toBeNull()
    expect(screen.queryByRole('button', { name: /輸入手牌/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '編輯玩家資料' }))
    expect(screen.getByRole('dialog', { name: '編輯牌友' })).toBeTruthy()
  })
  it('shows Riichi actions for the selected player and keeps Sanma unavailable', async () => {
    await launch('riichi')
    fireEvent.click(seat('右方', 'right'))
    expect(screen.getByRole('dialog', { name: 'right・玩家動作' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '吃' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '和牌' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '立直' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /拔北/ })).toBeNull()
  })
  it('does not create a Pon when selection is cancelled and requires only one selected tile', async () => {
    await launch()
    fireEvent.click(seat())
    fireEvent.click(screen.getByRole('button', { name: '碰' }))
    expect(screen.getByRole('heading', { name: '碰咗邊隻牌？' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回動作選單' }))
    expect((await loadSettings()).gameplay?.actions).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '碰' }))
    fireEvent.click(screen.getByRole('button', { name: '筒' }))
    fireEvent.click(screen.getByRole('button', { name: '五筒' }))
    fireEvent.click(screen.getByRole('button', { name: '確認記錄' }))
    await saved()
    const data = (await loadSettings()).gameplay!
    expect(data.actions).toHaveLength(1)
    expect(projectRound(data, 'round-a').melds[0]).toMatchObject({ tile: '5p', playerId: 'bottom', roundId: 'round-a' })
    expect(projectRound(data, 'round-a').melds[0].tiles).toHaveLength(3)
  })
  it('clears obsolete red-five composition when correcting a recorded meld to another tile', () => {
    const data = recordAction(scoringGame(), 'bottom', { ...call('pon', '5m', 'five-call'), redCount: 1 })
    const changed = vi.fn()
    render(<PlayerActions data={data} playerId="bottom" onChange={changed} onClose={() => {}} onEdit={() => {}} onWin={() => {}} />)
    fireEvent.click(screen.getByText('動作記錄與更正'))
    fireEvent.click(screen.getByRole('button', { name: '更正' }))
    expect(screen.getByRole('combobox', { name: '動作赤五數量' })).toHaveProperty('value', '1')
    fireEvent.click(screen.getByRole('button', { name: '六萬' }))
    fireEvent.click(screen.getByRole('button', { name: '儲存更正' }))
    expect(changed).toHaveBeenCalledOnce()
    expect(projectRound(changed.mock.calls[0][0], 'round-a').melds[0]).toMatchObject({ tile: '6m', redCount: 0 })
  })
  it('has only two Kan choices with no Pon and requires a choice among multiple Pons', async () => {
    const app = await launch()
    fireEvent.click(seat())
    fireEvent.click(screen.getByRole('button', { name: '槓' }))
    expect(screen.getByRole('button', { name: '暗槓' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '明槓' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^加槓/ })).toBeNull()
    await saved()
    app.unmount()
    const data = recordAction(ponGame(), 'bottom', call('pon', 'white', 'meld-b'))
    await launch('hong-kong', data)
    fireEvent.click(seat())
    fireEvent.click(screen.getByRole('button', { name: '槓' }))
    fireEvent.click(screen.getByRole('button', { name: '加槓' }))
    expect(screen.getByRole('heading', { name: '你想將邊組碰牌加槓？' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '確認記錄' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /五筒 · 記錄/ }))
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '確認槓牌' }))
    await saved()
    expect(projectRound((await loadSettings()).gameplay!, 'round-a').melds.find((meld) => meld.id === 'meld-a')?.kind).toBe('shouminkan')
  })
  it('persists Riichi with a badge, and history undo removes the badge and refunds its single deposit', async () => {
    await launch('riichi')
    fireEvent.click(seat())
    fireEvent.click(screen.getByRole('button', { name: '立直' }))
    expect((screen.getByRole('button', { name: '確認立直記錄' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /門前清、聽牌/ }))
    fireEvent.click(screen.getByRole('button', { name: '確認立直記錄' }))
    await saved()
    expect(within(seat()).getByText('立直')).toBeTruthy()
    fireEvent.click(seat())
    fireEvent.click(screen.getByText('動作記錄與更正'))
    fireEvent.click(screen.getByRole('button', { name: '撤回' }))
    await saved()
    fireEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(within(seat()).queryByText('立直')).toBeNull()
    expect((await loadSettings()).gameplay?.match).toMatchObject({ pool: 0, points: { bottom: 25000 } })
  })
})
