import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from '../src/App'
import * as storage from '../src/storage/settings'
import { useSettings } from '../src/storage/useSettings'
import type { Settings } from '../src/storage/settings'

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function ready() {
  await screen.findByText('設定已於此瀏覽器自動儲存')
}

function setNickname(value: string) {
  fireEvent.change(screen.getByLabelText(/牌友暱稱/), { target: { value } })
}

describe('confirmed player configuration', () => {
  it('adds, edits, cancels and removes players and restores the mode after remount', async () => {
    const app = render(<StrictMode><App /></StrictMode>)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '加入左方玩家' }))
    setNickname('雀后')
    fireEvent.click(screen.getByRole('radio', { name: '布甸' }))
    fireEvent.click(screen.getByRole('button', { name: '儲存牌友' }))
    await ready()
    expect((await storage.loadSettings()).players.left).toEqual({ position: 'left', nickname: '雀后', avatar: '🍮' })

    fireEvent.click(screen.getByRole('button', { name: '編輯左方玩家：雀后' }))
    setNickname('未確認')
    fireEvent.click(screen.getByRole('radio', { name: '貓咪' }))
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
    expect((await storage.loadSettings()).players.left?.nickname).toBe('雀后')
    expect((await storage.loadSettings()).players.left?.avatar).toBe('🍮')

    fireEvent.click(screen.getByRole('button', { name: '編輯左方玩家：雀后' }))
    setNickname('阿明')
    fireEvent.click(screen.getByRole('radio', { name: '貓咪' }))
    fireEvent.click(screen.getByRole('button', { name: '儲存牌友' }))
    await ready()
    fireEvent.click(within(screen.getByRole('group', { name: '麻雀模式' })).getByRole('button', { name: /日本麻雀/ }))
    await ready()
    expect(await storage.loadSettings()).toEqual({ variant: 'riichi', players: { left: { position: 'left', nickname: '阿明', avatar: '🐱' } } })
    app.unmount()

    render(<App />)
    await ready()
    expect(screen.getByRole('button', { name: /日本麻雀/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '編輯左方玩家：阿明' }))
    expect((screen.getByLabelText(/牌友暱稱/) as HTMLInputElement).value).toBe('阿明')
    fireEvent.click(screen.getByRole('button', { name: '移除此牌友' }))
    await ready()
    expect(screen.getByRole('button', { name: '加入左方玩家' })).toBeTruthy()
    expect(await storage.loadSettings()).toEqual({ variant: 'riichi', players: {} })
  })

  it('keeps a cancelled new seat out of persistent storage', async () => {
    render(<App />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '加入上方玩家' }))
    setNickname('取消測試')
    fireEvent.click(screen.getByRole('button', { name: '取消並關閉' }))
    expect((await storage.loadSettings()).players).toEqual({})
  })

  it('remains usable when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    render(<App />)
    await screen.findByText(/無法讀取本機設定/)
    fireEvent.click(screen.getByRole('button', { name: '加入上方玩家' }))
    setNickname('本次牌友')
    fireEvent.click(screen.getByRole('button', { name: '儲存牌友' }))
    expect(screen.getByRole('button', { name: '編輯上方玩家：本次牌友' })).toBeTruthy()
    expect(screen.getByText(/本次變更只保留至重新整理/)).toBeTruthy()
  })
})

describe('hydration and storage failures', () => {
  it('does not save defaults or allow edits before restoration completes, including StrictMode', async () => {
    let restore!: (settings: Settings) => void
    vi.spyOn(storage, 'loadSettings').mockReturnValue(new Promise((resolve) => { restore = resolve }))
    const save = vi.spyOn(storage, 'saveSettings')
    const hook = renderHook(useSettings, { wrapper: StrictMode })
    act(() => hook.result.current.updateSettings(() => ({ variant: 'hong-kong', players: {} })))
    expect(hook.result.current.status).toBe('loading')
    expect(save).not.toHaveBeenCalled()
    await act(async () => restore({ variant: 'riichi', players: { right: { position: 'right', nickname: '牌友', avatar: '🐼' } } }))
    expect(hook.result.current.settings.variant).toBe('riichi')
    expect(hook.result.current.settings.players.right?.nickname).toBe('牌友')
    expect(save).not.toHaveBeenCalled()
  })

  it('disables table and mode controls during hydration', async () => {
    let restore!: (settings: Settings) => void
    vi.spyOn(storage, 'loadSettings').mockReturnValue(new Promise((resolve) => { restore = resolve }))
    render(<App />)
    expect((screen.getByRole('button', { name: '加入上方玩家' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /日本麻雀/ }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => restore(storage.defaultSettings()))
    expect((screen.getByRole('button', { name: '加入上方玩家' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('never writes after a failed read or unsupported record schema', async () => {
    vi.spyOn(storage, 'loadSettings').mockRejectedValue(new Error('Unsupported settings schema'))
    const save = vi.spyOn(storage, 'saveSettings')
    const hook = renderHook(useSettings)
    await waitFor(() => expect(hook.result.current.status).toBe('unavailable'))
    act(() => hook.result.current.updateSettings((current) => ({ ...current, variant: 'riichi' })))
    expect(hook.result.current.settings.variant).toBe('riichi')
    expect(save).not.toHaveBeenCalled()
  })

  it('retains in-memory changes after a failed write and retries on the next confirmed change', async () => {
    const save = vi.spyOn(storage, 'saveSettings').mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'))
    const hook = renderHook(useSettings)
    await waitFor(() => expect(hook.result.current.status).toBe('saved'))
    act(() => hook.result.current.updateSettings((current) => ({ ...current, variant: 'riichi' })))
    await waitFor(() => expect(hook.result.current.status).toBe('error'))
    expect(hook.result.current.settings.variant).toBe('riichi')
    act(() => hook.result.current.updateSettings((current) => ({ ...current, players: { top: { position: 'top', nickname: '牌友', avatar: '🐱' } } })))
    await waitFor(() => expect(hook.result.current.status).toBe('saved'))
    expect(save).toHaveBeenCalledTimes(2)
    expect((await storage.loadSettings()).variant).toBe('riichi')
    expect((await storage.loadSettings()).players.top?.nickname).toBe('牌友')
  })

  it('serializes rapid saves and keeps the latest mode and players together', async () => {
    let finish!: () => void
    const save = vi.spyOn(storage, 'saveSettings').mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const hook = renderHook(useSettings)
    await waitFor(() => expect(hook.result.current.status).toBe('saved'))
    act(() => {
      hook.result.current.updateSettings((current) => ({ ...current, variant: 'riichi' }))
      hook.result.current.updateSettings((current) => ({ ...current, players: { top: { position: 'top', nickname: '牌友', avatar: '🐱' } } }))
    })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await act(async () => finish())
    await waitFor(() => expect(hook.result.current.status).toBe('saved'))
    expect(save).toHaveBeenCalledTimes(2)
    expect(await storage.loadSettings()).toEqual(hook.result.current.settings)
  })
})
