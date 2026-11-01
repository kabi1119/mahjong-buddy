import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from '../src/App'
import * as storage from '../src/storage/settings'
import { createMatch } from '../src/features/match/engine'
import { defaultHK } from '../src/features/match/rules'
import { fourPlayers, newGame } from './handFixtures'
const saved = () => screen.findByText('設定已於此瀏覽器自動儲存')
async function launch() {
  const data = newGame(); data.match = createMatch(data, defaultHK(), false)
  await storage.saveSettings({ variant: 'hong-kong', players: fourPlayers, setup: { version: 1, hkDiceCount: 3, phase: 'playing', dealer: 'bottom', turn: 'bottom', dice: [1, 1, 1] }, gameplay: data })
  const app = render(<App />); await saved(); return app
}
function open(winner = 'bottom', position = '下方') {
  fireEvent.click(screen.getByRole('button', { name: '開啟動作選單：' + position + '玩家：' + winner }))
  fireEvent.click(screen.getByRole('button', { name: '食糊' }))
}
function builder() { fireEvent.click(screen.getByRole('button', { name: '繼續重建贏牌' })) }
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('stable simplified workflow and automatic draft persistence', () => {
  it('has one optional exception checkbox, no save button and no Japanese-only HK explanations', async () => {
    await launch(); open(); expect(screen.getByRole('combobox', { name: '是否天糊？' })).toHaveProperty('value', 'no'); builder()
    fireEvent.click(screen.getByRole('button', { name: '補充遺漏副露' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: '有特殊情況（例如過水、包牌、多家同時食糊）' })).toHaveProperty('checked', false)
    expect(screen.queryByRole('button', { name: /儲存未完成草稿/ })).toBeNull()
    const text = screen.getByRole('dialog', { name: '贏牌 Hand Builder' }).textContent!
    expect(text).not.toMatch(/立直|寶牌|赤五|嶺上|榮和/)
    expect(text).not.toMatch(/shouminkan|daiminkan|ankan|\bchi\b|\bpon\b/)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('特殊合法性或付款情況須另行處理，不能使用普通自動結算。')).toBeTruthy()
    await saved()
  })
  it('saves rapid selection and winning-tile changes once per draft and recovers after refresh', async () => {
    const app = await launch(); open(); builder()
    for (const tile of ['一萬', '二萬', '三萬', '四萬', '五萬', '六萬']) fireEvent.click(screen.getByRole('button', { name: tile }))
    fireEvent.click(screen.getByRole('button', { name: '改選和牌張' })); fireEvent.click(screen.getByRole('button', { name: '指定和牌張：二萬' })); await saved()
    const first = (await storage.loadSettings()).gameplay!; const id = first.drafts[0].id; const winningId = first.drafts[0].winningTile!.id
    expect(first.drafts).toHaveLength(1); expect(first.drafts[0].concealed).toHaveLength(5)
    app.unmount(); render(<App />); await saved(); open(); builder()
    expect(screen.getByRole('button', { name: '移除二萬' }).textContent).toContain('和牌張')
    fireEvent.click(screen.getByRole('button', { name: '七萬' })); await saved()
    const restored = (await storage.loadSettings()).gameplay!
    expect(restored.drafts).toHaveLength(1); expect(restored.drafts[0].id).toBe(id)
    expect(restored.drafts[0].concealed.some((tile) => tile.id === winningId)).toBe(true)
    expect(restored.wins).toBeUndefined(); expect(restored.match!.history).toHaveLength(0)
    expect(restored.match!.points).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
  it('shows storage failure, protects refresh and retries the current draft without settlement', async () => {
    await launch(); open(); builder()
    const save = vi.spyOn(storage, 'saveSettings').mockRejectedValue(new Error('quota'))
    fireEvent.click(screen.getByRole('button', { name: '一萬' }))
    await screen.findByText(/未能自動儲存，請保留此頁面/)
    expect(screen.queryByText('已自動儲存')).toBeNull()
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true)
    save.mockRestore(); fireEvent.click(screen.getByRole('button', { name: '重試儲存' })); await saved()
    const data = (await storage.loadSettings()).gameplay!
    expect(data.drafts[0].winningTile!.type).toBe('1m'); expect(data.wins).toBeUndefined()
  })
  it('resets incompatible first-turn choices and hides a disabled Human-win option', async () => {
    await launch(); open('right', '右方')
    const earth = screen.getByRole('combobox', { name: '是否地糊？' })
    fireEvent.change(earth, { target: { value: 'yes' } })
    fireEvent.change(screen.getByRole('combobox', { name: '贏牌方式' }), { target: { value: 'ron' } })
    fireEvent.change(screen.getByRole('combobox', { name: '棄牌玩家' }), { target: { value: 'bottom' } })
    expect(screen.queryByRole('combobox', { name: '是否人糊？' })).toBeNull()
    await saved()
    expect((await storage.loadSettings()).gameplay!.drafts[0].conditions).toMatchObject({ hkEarth: false, hkHuman: false })
    fireEvent.change(screen.getByRole('combobox', { name: '贏牌方式' }), { target: { value: 'tsumo' } })
    await waitFor(() => expect(screen.getByRole('combobox', { name: '是否地糊？' })).toHaveProperty('value', 'no'))
    await saved()
  })
})
