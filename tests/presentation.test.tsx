import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from '../src/App'
import { MODE_CATALOG, POSITIONS, VARIANTS } from '../src/types/mahjong'
import type { PlayerPosition } from '../src/types/mahjong'
import { DATABASE_NAME, loadSettings, saveSettings } from '../src/storage/settings'
import type { Settings } from '../src/storage/settings'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { calculateWallBreak } from '../src/features/game/rules'
import { WallGuide } from '../src/features/game/WallGuide'

const players = Object.fromEntries(POSITIONS.map((position) => [position, { position, nickname: position, avatar: '🐱' }])) as Settings['players']
const chosen = updateSetup(newSetup(), { type: 'dealer', position: 'bottom' })
const ready = updateSetup(chosen, { type: 'confirm-dealer' })
const rolled = updateSetup(ready, { type: 'rolled', dice: [1, 2, 3] })
const playing = updateSetup(rolled, { type: 'dealt' })
const saved = () => screen.findByText('設定已於此瀏覽器自動儲存')
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('brand and mode artwork', () => {
  it('renders the new Chinese brand, original bird, valid patch label and four mode cards, two playable variants', async () => {
    render(<App />)
    await saved()
    expect(screen.getByRole('link', { name: '麻雀小夥伴，前往牌桌' }).querySelector('img')?.getAttribute('src')).toBe('/mahjong.svg')
    const badge = screen.getByText('v1.0.0')
    const themeSwitch = screen.getByRole('switch', { name: '深色模式' })
    expect(themeSwitch.getAttribute('aria-checked')).toBe('false')
    expect(themeSwitch.querySelector('.theme-switch-track .theme-switch-knob')).toBeTruthy()
    expect(themeSwitch.querySelectorAll('svg[viewBox="0 0 20 20"]')).toHaveLength(2)
    expect(themeSwitch.querySelector('.theme-switch-track')?.getAttribute('aria-hidden')).toBe('true')
    expect(themeSwitch.nextElementSibling).toBe(badge)
    const selector = within(screen.getByRole('group', { name: '麻雀模式' }))
    const cards = selector.getAllByRole('button')
    expect(cards).toHaveLength(4)
    expect(cards.every((card) => card.classList.contains('mode') && card.querySelector('.mode-tile') && card.querySelector('.mode-label'))).toBe(true)
    expect(cards.slice(0, 2).every((card) => card.querySelector('small') === null)).toBe(true)
    expect(cards.slice(2).every((card) => (card as HTMLButtonElement).disabled && card.querySelector('small')?.textContent === 'Coming soon敬請期待')).toBe(true)
    expect(selector.getByRole('button', { name: '香港麻雀' }).querySelector('img')?.getAttribute('src')).toBe('/icons/wind-east.svg')
    expect(selector.getByRole('button', { name: '日本四麻' }).querySelector('img')?.getAttribute('src')).toBe('/icons/wind-south.svg')
    expect(MODE_CATALOG.sanma.wind).toBe('西')
    expect(MODE_CATALOG.taiwanese.wind).toBe('北')
    expect(MODE_CATALOG.sanma.available).toBe(false)
    expect(MODE_CATALOG.taiwanese.available).toBe(false)
    expect(VARIANTS.map((mode) => mode.id)).toEqual(['hong-kong', 'riichi'])
    fireEvent.click(selector.getByRole('button', { name: '日本四麻' }))
    await saved()
    expect((await loadSettings()).variant).toBe('riichi')
    expect(selector.getByRole('button', { name: '日本四麻' }).getAttribute('aria-pressed')).toBe('true')
    expect(DATABASE_NAME).toBe('mahjong-companion')
  })

  it('keeps all local README links, image paths, icons and HTML branding valid', () => {
    const readme = readFileSync('README.md', 'utf8')
    const links = [...readme.matchAll(/(?:src|href)="([^"]+)"|\]\(([^)]+)\)/g)].map((match) => match[1] ?? match[2])
    for (const link of links.filter((link) => !/^(https?:|#)/.test(link))) expect(existsSync(path.resolve(link))).toBe(true)
    expect(readme.indexOf('https://app.mahjong-buddy.workers.dev/')).toBeLessThan(readme.indexOf('## 好牌'))
    expect(readme).toContain('並非應用程式截圖')
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('<title>麻雀小夥伴 · Mahjong Buddy</title>')
    expect(html).toContain('apple-touch-icon')
    expect(html).not.toContain('麻雀伴侶')
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
    const icon = readFileSync('public/icons/apple-touch-icon.png')
    expect(icon.readUInt32BE(16)).toBe(180)
    expect(icon.readUInt32BE(20)).toBe(180)
    for (const mode of Object.values(MODE_CATALOG)) {
      expect(readFileSync(`public${mode.icon}`, 'utf8')).toContain(`>${mode.wind}</text>`)
    }
  })
})

describe('one instruction and contextual primary controls', () => {
  it('consolidates the add-player instruction with the saved count', async () => {
    await saveSettings({ variant: 'hong-kong', players: { top: players.top, bottom: players.bottom } })
    render(<App />)
    await saved()
    expect(screen.getAllByText('點選座位加入牌友（2/4）')).toHaveLength(1)
    expect(screen.queryByText(/請先設定四位牌友/)).toBeNull()
    expect(screen.queryByRole('region', { name: '開局準備' })).toBeNull()
    expect(screen.getByRole('button', { name: '加入左方玩家' })).toBeTruthy()
  })

  it.each([
    [chosen, '確認莊家'], [ready, '擲骰開門'], [rolled, '已完成配牌'], [playing, '重設開局（保留牌友）'],
  ] as const)('keeps the current primary action outside collapsed secondary controls: %s', async (setup, action) => {
    await saveSettings({ variant: 'hong-kong', players, setup })
    render(<App />)
    await saved()
    expect(screen.getByRole('button', { name: action }).closest('details')).toBeNull()
    if (setup.phase === 'playing') { expect(document.querySelector('details.secondary-actions')).toBeNull(); expect(screen.queryByRole('button', { name: '下一家' })).toBeNull(); return }
    const details = document.querySelector('details.secondary-actions') as HTMLDetailsElement
    expect(details.open).toBe(false)
    fireEvent.click(details.querySelector('summary')!)
    expect(details.open).toBe(true)
    expect(screen.getByRole('button', { name: '清除牌友並重設' })).toBeTruthy()
  })
})

describe('two-step wall guide', () => {
  it.each(POSITIONS)('keeps correct Riichi landmarks and two steps for dealer %s', (dealer: PlayerPosition) => {
    const result = calculateWallBreak('riichi', 2, dealer)
    const onClose = vi.fn()
    const onDealt = vi.fn()
    render(<WallGuide result={result} dice={[1, 1]} dealer={dealer} players={players} onClose={onClose} onDealt={onDealt} />)
    const dialog = screen.getByRole('dialog', { name: '開門指引' })
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['骰子結果', '揀選牌牆'])
    expect(dialog.querySelectorAll('.guide-steps > section')).toHaveLength(2)
    expect(dialog.querySelector('.counted-strip')).toBeNull()
    expect(dialog.querySelectorAll('svg rect[fill="#dbb96f"]')).toHaveLength(7)
    expect(dialog.querySelectorAll('svg rect[fill="#9fe5c1"]')).toHaveLength(1)
    expect(dialog.querySelector('svg circle')?.getAttribute('cx')).not.toBeNull()
    expect(within(dialog).getByText(/由王牌的嶺上牌補一張/)).toBeTruthy()
    expect(dialog.querySelector('ol.guide-steps')).toBeNull()
    expect(dialog.querySelectorAll('.wall-owners li')).toHaveLength(4)
    fireEvent.click(within(dialog).getByRole('button', { name: '返回牌桌' }))
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(within(dialog).getByRole('button', { name: '已完成配牌' }))
    expect(onDealt).toHaveBeenCalledOnce()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('preserves HK corner-crossing and replacement-tail annotations', () => {
    const result = calculateWallBreak('hong-kong', 18, 'bottom')
    render(<WallGuide result={result} dice={[6, 6, 6]} dealer="bottom" players={players} onClose={vi.fn()} />)
    expect(screen.getByText(/「尾」：補花/).textContent).toContain('逆普通取牌方向')
    expect(screen.getByText(/綠色「始」為第一棟/)).toBeTruthy()
    expect(document.querySelectorAll('.guide-steps > section')).toHaveLength(2)
  })
})
