import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from '../src/App'
import { loadSettings, saveSettings } from '../src/storage/settings'
import { newSetup, updateSetup } from '../src/features/game/setup'
import { recordAction } from '../src/features/actions/engine'
import { syncRoundIndicators, updateIndicator } from '../src/features/scoring/indicators'
import { call, fourPlayers, newGame } from './handFixtures'
import type { GameplayData } from '../src/features/actions/models'
const ready = updateSetup(updateSetup(newSetup(), { type: 'dealer', position: 'bottom' }), { type: 'confirm-dealer' })
const playing = updateSetup(updateSetup(ready, { type: 'rolled', dice: [1, 1] }), { type: 'dealt' })
const saved = () => screen.findByText('設定已於此瀏覽器自動儲存')
const seat = () => screen.getByRole('button', { name: '開啟動作選單：下方玩家：bottom' })
async function launch(variant: 'hong-kong' | 'riichi' = 'hong-kong', input = newGame(variant)) {
  let data = input
  if (variant === 'riichi') { data = syncRoundIndicators(data); data = updateIndicator(data, 'initial:round-a', 'effective', 'west') }
  await saveSettings({ variant, players: fourPlayers, setup: { ...playing, dice: variant === 'hong-kong' ? [1, 1, 1] : [1, 1] }, gameplay: data })
  const app = render(<App />); await saved(); return app
}
async function openBuilder(variant: 'hong-kong' | 'riichi' = 'hong-kong') {
  fireEvent.click(seat()); fireEvent.click(screen.getByRole('button', { name: variant === 'hong-kong' ? '食糊' : '和牌' }))
  expect(screen.queryByRole('button', { name: '一萬' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '繼續重建贏牌' })); await saved()
}
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('RC4 verified win-only Hand Builder', () => {
  it('separates final preview, immutable lock and explicit settlement; replay never pays twice', async () => {
    await launch(); await openBuilder()
    for (const [name, count] of [['一萬', 3], ['二萬', 3], ['三萬', 3], ['四萬', 3], ['五萬', 2]] as const) for (let index = 0; index < count; index++) fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('button', { name: '確認手牌' })).toHaveProperty('disabled', true)
    await saved()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '確認手牌' }))
    expect(screen.getByRole('dialog', { name: '確認最後手牌' })).toBeTruthy()
    expect((await loadSettings()).gameplay?.wins).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: '返回修改' }))
    expect(screen.queryByRole('dialog', { name: '確認最後手牌' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '確認手牌' })); fireEvent.click(screen.getByRole('button', { name: '確認並鎖定' })); await saved()
    let stored = await loadSettings()
    expect(stored.gameplay!.wins![0]).toMatchObject({ status: 'locked', draft: { winner: 'bottom', status: 'confirmed' }, score: { fan: 13 } })
    expect(stored.gameplay!.match!.points).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(stored.setup!.phase).toBe('playing')
    expect(screen.queryByRole('button', { name: '一萬' })).toBeNull()
    expect(screen.queryByRole('button', { name: '確認結算並結束本局' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '下一步：查看四家結算' }))
    expect((await loadSettings()).gameplay!.match!.points.bottom).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: '返回手牌及計分' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步：查看四家結算' }))
    fireEvent.click(screen.getByRole('button', { name: '確認結算並結束本局' })); await saved()
    stored = await loadSettings(); expect(stored.setup!.phase).toBe('ready-to-roll'); expect(stored.gameplay!.match!.points.bottom).toBe(1152)
    fireEvent.click(screen.getByRole('button', { name: '重播結果動畫' }))
    expect((await loadSettings()).gameplay!.match!.points).toEqual(stored.gameplay!.match!.points)
    expect(stored.gameplay!.match!.ledger.filter((entry) => entry.kind === 'win')).toHaveLength(1)
  })
  it('keeps red fives and flowers separated, and Ura unavailable without Riichi', async () => {
    const app = await launch('riichi'); await openBuilder('riichi')
    expect(screen.queryByRole('button', { name: /輸入實際裏寶牌/ })).toBeNull()
    expect(screen.getByRole('button', { name: '赤五萬' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '花牌' })).toBeNull()
    await saved(); app.unmount()
    await launch(); await openBuilder(); fireEvent.click(screen.getByRole('button', { name: '花牌' }))
    expect(screen.getByRole('button', { name: '花牌 春' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '花牌 春' }))
    expect(screen.getByRole('button', { name: '花牌 春' })).toHaveProperty('disabled', true)
    expect(screen.queryByRole('button', { name: '赤五萬' })).toBeNull()
  })
  it('saves and resumes incomplete drafts with a stable winning tile after remount', async () => {
    const app = await launch(); await openBuilder(); fireEvent.click(screen.getByRole('button', { name: '一萬' }))
    await saved()
    const stored = (await loadSettings()).gameplay!; const id = stored.drafts[0].winningTile!.id
    expect(stored.drafts[0]).toMatchObject({ status: 'draft', winningTile: { type: '1m' } }); expect(stored.drafts[0].concealed).toHaveLength(0)
    app.unmount(); await launch('hong-kong', stored)
    fireEvent.click(seat()); fireEvent.click(screen.getByRole('button', { name: '食糊' })); fireEvent.click(screen.getByText(/繼續已儲存草稿/)); fireEvent.click(screen.getByRole('button', { name: /繼續草稿 ·/ }))
    expect(screen.getByRole('button', { name: '移除一萬' })).toBeTruthy()
    await saved()
    expect((await loadSettings()).gameplay!.drafts[0].winningTile!.id).toBe(id)
  })
  it('closes safely while auto-saving without inventing a lock or result', async () => {
    await launch(); await openBuilder(); fireEvent.click(screen.getByRole('button', { name: '一萬' }))
    fireEvent.click(screen.getByRole('button', { name: '關閉' })); await saved()
    const data = (await loadSettings()).gameplay!; expect(data.drafts).toHaveLength(1); expect(data.wins).toBeUndefined()
    fireEvent.click(seat()); fireEvent.click(screen.getByRole('button', { name: '食糊' })); fireEvent.click(screen.getByRole('button', { name: '繼續重建贏牌' }))
    expect(screen.getByRole('button', { name: '移除一萬' })).toBeTruthy()
  })
  it('uses shared visible indicators and only allows Ura for confirmed Riichi', async () => {
    const data = recordAction(newGame('riichi'), 'bottom', { kind: 'riichi', confirmed: true })
    await launch('riichi', data); await openBuilder('riichi')
    expect(screen.getByRole('button', { name: /輸入實際裏寶牌/ })).toBeTruthy()
    fireEvent.click(screen.getByText('本局寶牌與槓寶牌（所有玩家共用）'))
    expect(screen.getByText(/實際寶牌（自動計算）：北/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /輸入實際裏寶牌/ })); fireEvent.click(screen.getByRole('button', { name: '三萬' }))
    await saved()
    const stored = (await loadSettings()).gameplay!
    expect(stored.drafts[0].indicators).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'dora', tile: expect.objectContaining({ type: 'west' }) }), expect.objectContaining({ kind: 'ura', tile: expect.objectContaining({ type: '3m' }) })]))
  })
  it('imports one Pon and one Kan once, prevents fifth copies and allows winning-tile correction', async () => {
    let data: GameplayData = newGame(); data = recordAction(data, 'bottom', call('pon', '1m', 'pon-a')); data = recordAction(data, 'bottom', call('ankan', '2m', 'kan-a'))
    await launch('hong-kong', data); await openBuilder()
    expect(screen.getByText(/邏輯牌 6\/14 · 尚餘 8 · 實體普通牌 7/)).toBeTruthy()
    expect(document.querySelectorAll('.recorded-melds .meld-card')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '二萬' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: '三萬' })); fireEvent.click(screen.getByRole('button', { name: '四萬' }))
    fireEvent.click(screen.getByRole('button', { name: '改選和牌張' })); fireEvent.click(screen.getByRole('button', { name: '指定和牌張：三萬' }))
    expect(within(screen.getByRole('button', { name: '移除三萬' })).getByText('和牌張')).toBeTruthy()
    await saved()
  })
  it('requires the first actual Dora before new Riichi gameplay', async () => {
    await saveSettings({ variant: 'riichi', players: fourPlayers, setup: { ...playing, dice: [1, 1], phase: 'wall-guide', turn: null } })
    render(<App />); await saved(); fireEvent.click(screen.getByRole('button', { name: '已完成配牌' })); await saved()
    expect(screen.getByRole('dialog', { name: '記錄首張寶牌指示牌' })).toBeTruthy()
    expect((await loadSettings()).setup!.phase).toBe('wall-guide')
    expect(screen.getByRole('button', { name: '確認指示牌並開始行牌' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: '已翻開，輸入指示牌' })); fireEvent.click(screen.getByRole('button', { name: '三萬' }))
    fireEvent.click(screen.getByRole('button', { name: '確認指示牌' })); await saved()
    expect(screen.getByText(/實際寶牌（自動計算）：四萬/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '確認指示牌並開始行牌' })); await saved()
    const stored = await loadSettings(); expect(stored.setup!.phase).toBe('playing'); expect(stored.gameplay!.rounds.at(-1)!.dora!.entries).toHaveLength(1)
  })
})
