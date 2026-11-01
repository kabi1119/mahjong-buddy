import { decodePreferences } from '../features/match/rules'
import type { RulePreferences, ThemePreference } from '../features/match/rules'
import { activeRound, archiveRound } from '../features/actions/engine'
import { decodeGameplay } from '../features/actions/storage'
import type { GameplayData } from '../features/actions/models'
import { AVATARS, POSITIONS, VARIANTS } from '../types/mahjong'
import type { MahjongVariant, Player, PlayerPosition } from '../types/mahjong'
import { decodeSetup } from '../features/game/setup'
import type { GameSetup } from '../features/game/setup'

export interface Settings {
  variant: MahjongVariant
  players: Partial<Record<PlayerPosition, Player>>
  setup?: GameSetup
  gameplay?: GameplayData
  preferences?: RulePreferences
  themePreference?: ThemePreference
}

// Database version tracks object-store migrations; schemaVersion tracks record migrations.
// Legacy identifier: keep this name so the Mahjong Buddy rebrand preserves saved data.
export const DATABASE_NAME = 'mahjong-companion'
const DATABASE_VERSION = 1
const STORE = 'settings'
const KEY = 'table'

export function defaultSettings(): Settings {
  return { variant: 'hong-kong', players: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function decodeSettings(value: unknown): Settings {
  const settings = defaultSettings()
  if (!isRecord(value)) return settings
  // Never overwrite a record produced by a newer app with an older schema.
  if (value.schemaVersion !== 1) throw new Error('Unsupported settings schema')
  if (isRecord(value.setup) && value.setup.version !== 1) throw new Error('Unsupported setup schema')
  const preferences = decodePreferences(value.preferences)
  if (preferences) settings.preferences = preferences
  if (value.themePreference !== undefined) { if (!['system', 'light', 'dark'].includes(String(value.themePreference))) throw new Error('未知主題偏好。'); settings.themePreference = value.themePreference as ThemePreference }
  const gameplay = decodeGameplay(value.gameplay)
  if (gameplay) settings.gameplay = gameplay
  const variant = VARIANTS.find((item) => item.id === value.variant)
  if (variant) settings.variant = variant.id
  if (!isRecord(value.players)) return settings
  for (const position of POSITIONS) {
    const entry = value.players[position]
    if (!isRecord(entry) || typeof entry.nickname !== 'string') continue
    const nickname = entry.nickname.trim()
    const avatar = AVATARS.find((item) => item.emoji === entry.avatar)
    if (!nickname || nickname.length > 12 || !avatar) continue
    settings.players[position] = { position, nickname, avatar: avatar.emoji }
  }
  if (POSITIONS.every((position) => settings.players[position]) && variant) {
    const setup = decodeSetup(value.setup, settings.variant)
    if (setup) settings.setup = setup
  }
  const currentRound = activeRound(settings.gameplay)
  if (currentRound && (currentRound.variant !== settings.variant || (settings.setup?.phase !== 'playing' && !['between', 'preparing', 'end-decision'].includes(settings.gameplay?.match?.phase ?? '')) || currentRound.dealer !== settings.setup.dealer)) settings.gameplay = archiveRound(settings.gameplay!)
  return settings
}

function encodeSettings(settings: Settings) {
  // The map key is the seat: do not duplicate position or persist UI/draft state.
  const players: Partial<Record<PlayerPosition, { nickname: string; avatar: string }>> = {}
  for (const position of POSITIONS) {
    const player = settings.players[position]
    if (player) players[position] = { nickname: player.nickname, avatar: player.avatar }
  }
  return { schemaVersion: 1, variant: settings.variant, players,
    ...(settings.setup ? { setup: settings.setup } : {}),
    ...(settings.gameplay ? { gameplay: settings.gameplay } : {}),
    ...(settings.preferences ? { preferences: settings.preferences } : {}),
    ...(settings.themePreference ? { themePreference: settings.themePreference } : {}) }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => fail(new Error('Storage open timed out')), 3000)
    function fail(error: unknown) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }
    try {
      if (!globalThis.indexedDB) throw new Error('IndexedDB unavailable')
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onerror = () => fail(request.error)
      request.onblocked = () => fail(new Error('Storage upgrade blocked'))
      request.onsuccess = () => {
        const database = request.result
        if (settled) { database.close(); return }
        settled = true
        clearTimeout(timer)
        database.onversionchange = () => database.close()
        resolve(database)
      }
    } catch (error) { fail(error) }
  })
}

async function transaction(mode: IDBTransactionMode, value?: unknown): Promise<unknown> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, mode)
      const store = tx.objectStore(STORE)
      const request = mode === 'readonly' ? store.get(KEY) : store.put(value, KEY)
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? new Error('Storage transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'))
    })
  } finally { database.close() }
}

export async function loadSettings(): Promise<Settings> {
  return decodeSettings(await transaction('readonly'))
}

export async function saveSettings(settings: Settings): Promise<void> {
  await transaction('readwrite', encodeSettings(settings))
}
