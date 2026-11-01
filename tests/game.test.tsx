import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from '../src/App'
import { decodeSettings, loadSettings, saveSettings } from '../src/storage/settings'
import type { Settings } from '../src/storage/settings'
import { newSetup, updateSetup } from '../src/features/game/setup'
import * as rules from '../src/features/game/rules'

const players: Settings['players'] = {
  bottom: { position: 'bottom', nickname: '阿東', avatar: '🐱' },
  right: { position: 'right', nickname: '阿南', avatar: '🐼' },
  top: { position: 'top', nickname: '阿西', avatar: '🐰' },
  left: { position: 'left', nickname: '阿北', avatar: '🍮' },
}
const selected = updateSetup(newSetup(), { type: 'dealer', position: 'bottom' })
const ready = updateSetup(selected, { type: 'confirm-dealer' })
const rolled = updateSetup(ready, { type: 'rolled', dice: [1, 2, 3] })
const playing = updateSetup(rolled, { type: 'dealt' })
const saved = () => screen.findByText('設定已於此瀏覽器自動儲存')
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('game workflow', () => {
  it('selects random or manual dealers without changing physical players and clears old dice when changing', async () => {
    await saveSettings({ variant: 'hong-kong', players })
    vi.spyOn(rules, 'randomIndex').mockReturnValue(3)
    render(<App />)
    await saved()
    fireEvent.click(screen.getByRole('button', { name: '隨機選莊' }))
    await saved()
    expect((await loadSettings()).setup?.dealer).toBe('left')
    fireEvent.click(screen.getByRole('button', { name: '選為莊家下方玩家：阿東' }))
    fireEvent.click(screen.getByRole('button', { name: '確認莊家' }))
    await saved()
    expect((await loadSettings()).setup).toEqual(ready)
    expect((await loadSettings()).players).toEqual(players)
  })

  it('finalizes one roll at a time, replaces wall guidance on reroll, then tracks manual turns', async () => {
    await saveSettings({ variant: 'hong-kong', players, setup: ready })
    const dice = vi.spyOn(rules, 'generateDiceResults').mockReturnValueOnce([1, 2, 3]).mockReturnValueOnce([6, 6, 6])
    const app = render(<App />)
    await saved()
    const roll = screen.getByRole('button', { name: '擲骰開門' })
    fireEvent.click(roll)
    fireEvent.click(roll)
    expect(screen.queryByLabelText(/骰子 1、2、3/)).toBeNull()
    expect(screen.getByText('正在擲骰…')).toBeTruthy()
    expect((screen.getByRole('button', { name: /日本麻雀/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(dice).not.toHaveBeenCalled()
    await screen.findByRole('dialog', { name: '開門指引' })
    await saved()
    expect(dice).toHaveBeenCalledTimes(1)
    expect((await loadSettings()).setup?.dice).toEqual([1, 2, 3])
    fireEvent.click(screen.getByRole('button', { name: '返回牌桌' }))
    fireEvent.click(screen.getByRole('button', { name: '重新擲骰並重設配牌' }))
    expect(screen.queryByLabelText(/骰子 1、2、3/)).toBeNull()
    await screen.findByRole('dialog', { name: '開門指引' })
    await saved()
    expect((await loadSettings()).setup?.dice).toEqual([6, 6, 6])
    fireEvent.click(screen.getByRole('button', { name: '已完成配牌' }))
    await saved()
    expect((await loadSettings()).setup?.turn).toBe('bottom')
    fireEvent.click(screen.getByRole('button', { name: '下一家' }))
    await saved()
    expect((await loadSettings()).setup?.turn).toBe('right')
    fireEvent.change(screen.getByLabelText('手動指定玩家'), { target: { value: 'top' } })
    await saved()
    expect((await loadSettings()).setup?.turn).toBe('top')
    app.unmount()
    render(<App />)
    await saved()
    expect(screen.getByRole('button', { name: '編輯上方玩家：阿西' }).getAttribute('aria-current')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '重設至東家' }))
    await saved()
    expect((await loadSettings()).setup?.turn).toBe('bottom')
  })

  it('honors reduced motion and uses two dice for Riichi', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    await saveSettings({ variant: 'riichi', players, setup: ready })
    const dice = vi.spyOn(rules, 'generateDiceResults').mockReturnValue([1, 1])
    render(<App />)
    await saved()
    fireEvent.click(screen.getByRole('button', { name: '擲骰開門' }))
    expect(dice).toHaveBeenCalledWith(2)
    expect(screen.queryByText('正在擲骰…')).toBeNull()
    await screen.findByRole('dialog', { name: '開門指引' })
    expect(screen.getByText(/王牌不可作普通摸牌/)).toBeTruthy()
  })

  it('invalidates dice and turns on dealer, house-rule or variant change, preserving players', async () => {
    await saveSettings({ variant: 'hong-kong', players, setup: playing })
    render(<App />)
    await saved()
    fireEvent.change(screen.getByLabelText('港式骰子數'), { target: { value: '2' } })
    await saved()
    expect((await loadSettings()).setup).toMatchObject({ hkDiceCount: 2, dice: null, turn: null, phase: 'ready-to-roll' })
    expect(screen.queryByRole('button', { name: '查看開門指引' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '更改莊家' }))
    fireEvent.click(screen.getByRole('button', { name: '選為莊家上方玩家：阿西' }))
    await saved()
    expect((await loadSettings()).setup).toMatchObject({ dealer: 'top', dice: null })
    fireEvent.click(screen.getByRole('button', { name: /日本麻雀/ }))
    await saved()
    expect((await loadSettings()).setup).toEqual(newSetup(2))
    expect((await loadSettings()).players).toEqual(players)
  })

  it('resets setup without deleting players and invalidates setup after a player is removed', async () => {
    await saveSettings({ variant: 'hong-kong', players, setup: playing })
    render(<App />)
    await saved()
    fireEvent.click(screen.getByRole('button', { name: '重設開局（保留牌友）' }))
    await saved()
    expect((await loadSettings()).players).toEqual(players)
    expect((await loadSettings()).setup).toEqual(newSetup())
    fireEvent.click(screen.getByRole('button', { name: '編輯牌友', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '編輯右方玩家：阿南' }))
    fireEvent.click(screen.getByRole('button', { name: '移除此牌友' }))
    await saved()
    expect((await loadSettings()).players.right).toBeUndefined()
    expect((await loadSettings()).setup).toBeUndefined()
    expect(screen.queryByRole('button', { name: '擲骰開門' })).toBeNull()
  })

  it('clears stale guidance immediately if random generation fails', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.spyOn(rules, 'generateDiceResults').mockImplementation(() => { throw new Error('Unavailable') })
    await saveSettings({ variant: 'hong-kong', players, setup: rolled })
    render(<App />)
    await saved()
    fireEvent.click(screen.getByRole('button', { name: '重新擲骰並重設配牌' }))
    await screen.findByRole('alert')
    await saved()
    expect((await loadSettings()).setup?.dice).toBeNull()
    expect(screen.queryByRole('button', { name: '查看開門指引' })).toBeNull()
  })
})

describe('backwards compatible game persistence', () => {
  it('restores valid setup, preserving existing player data in the same version-1 record', async () => {
    await saveSettings({ variant: 'hong-kong', players, setup: playing })
    expect(await loadSettings()).toEqual({ variant: 'hong-kong', players, setup: playing })
    const oldRecord = { schemaVersion: 1, variant: 'hong-kong', players }
    expect(decodeSettings(oldRecord)).toEqual({ variant: 'hong-kong', players })
    expect(decodeSettings({ ...oldRecord, setup: { ...playing, dice: [0, 8, 2] } }).setup).toEqual(ready)
    expect(decodeSettings({ ...oldRecord, setup: { ...playing, version: 99 } }).setup).toBeUndefined()
    expect(decodeSettings({ ...oldRecord, players: { bottom: players.bottom }, setup: playing }).setup).toBeUndefined()
  })
  it('keeps game controls unavailable until restoration finishes', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('請先設定四位牌友，再選莊、擲骰及開門。')).toBeTruthy())
    expect(screen.queryByRole('button', { name: '確認莊家' })).toBeNull()
  })
})
