import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBVersionChangeEvent } from 'fake-indexeddb'
import { DATABASE_NAME, decodeSettings, defaultSettings, loadSettings, saveSettings } from '../src/storage/settings'
import type { Player } from '../src/types/mahjong'

const player: Player = { position: 'left', nickname: '雀后', avatar: '🐱' }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('IndexedDB settings', () => {
  it('returns defaults on a fresh database', async () => {
    expect(await loadSettings()).toEqual(defaultSettings())
  })

  it('saves and restores players and mode through new database connections', async () => {
    const settings = { variant: 'riichi' as const, players: { left: player } }
    await saveSettings(settings)
    expect(await loadSettings()).toEqual(settings)
  })

  it('replaces edits and removes a single player without affecting other seats', async () => {
    const second: Player = { ...player, position: 'top', nickname: '阿明' }
    await saveSettings({ variant: 'hong-kong', players: { left: player, top: second } })
    const settings = await loadSettings()
    settings.players.left = { ...player, nickname: '新名', avatar: '🍮' }
    await saveSettings(settings)
    expect((await loadSettings()).players.left).toEqual(settings.players.left)
    delete settings.players.left
    await saveSettings(settings)
    expect((await loadSettings()).players).toEqual({ top: second })
  })

  it('validates malformed data and ignores unknown seats and fields', () => {
    for (const value of [undefined, null, [], 'bad']) expect(decodeSettings(value)).toEqual(defaultSettings())
    expect(decodeSettings({ schemaVersion: 1, variant: 'sanma', players: {
      top: { nickname: '  阿明  ', avatar: '🐱', extra: 'ignored' },
      left: { nickname: ' ', avatar: '🐱' },
      right: { nickname: '名字', avatar: 'unknown' },
      bottom: { nickname: '超過十二個字的測試名稱不能接受', avatar: '🐱' },
      extra: player,
    } })).toEqual({ variant: 'hong-kong', players: { top: { position: 'top', nickname: '阿明', avatar: '🐱' } } })
    expect(() => decodeSettings({ schemaVersion: 2 })).toThrow('Unsupported')
    expect(decodeSettings({ schemaVersion: 1, variant: 'riichi', players: null })).toEqual({ variant: 'riichi', players: {} })
  })

  it('stores one versioned record without duplicate seat positions', async () => {
    await saveSettings({ variant: 'riichi', players: { left: player } })
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open(DATABASE_NAME)
      request.onsuccess = () => resolve(request.result)
    })
    const records = await new Promise<unknown[]>((resolve) => {
      const tx = db.transaction('settings')
      const request = tx.objectStore('settings').getAll()
      tx.oncomplete = () => resolve(request.result)
    })
    db.close()
    expect(records).toEqual([{ schemaVersion: 1, variant: 'riichi', players: { left: { nickname: player.nickname, avatar: player.avatar } } }])
  })

  it('rejects unavailable or denied IndexedDB instead of throwing synchronously', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(loadSettings()).rejects.toThrow('unavailable')
    await expect(saveSettings(defaultSettings())).rejects.toThrow('unavailable')
    vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('Denied', 'SecurityError') } })
    await expect(loadSettings()).rejects.toThrow('Denied')
  })

  it('times out an unresponsive open and closes any connection returned later', async () => {
    vi.useFakeTimers()
    const close = vi.fn()
    const request = { result: { close } } as unknown as IDBOpenDBRequest
    vi.stubGlobal('indexedDB', { open: () => request })
    const result = expect(loadSettings()).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(3000)
    await result
    request.onsuccess?.call(request, new Event('success'))
    expect(close).toHaveBeenCalledOnce()
  })

  it('reports a blocked database open without waiting indefinitely', async () => {
    const request = {} as IDBOpenDBRequest
    vi.stubGlobal('indexedDB', { open: () => request })
    const result = expect(loadSettings()).rejects.toThrow('blocked')
    request.onblocked?.call(request, new IDBVersionChangeEvent('blocked'))
    await result
  })
})
