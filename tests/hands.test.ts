import { describe, expect, it } from 'vitest'
import { createDraft, completedKanCount, hasConfirmedRiichi, logicalTileCount, physicalTileCount, saveDraft, setMeldRedCount, upgradeDraftPon, validateDraft } from '../src/features/hands/drafts'
import { FLOWERS, getDoraFromIndicator, TILE_CATALOG, tileInstance } from '../src/features/hands/tiles'
import { makeMeld, projectRound, recordAction, undoAction } from '../src/features/actions/engine'
import { added, call, newGame, ponGame } from './handFixtures'

describe('catalog and dora conversion', () => {
  it('has 34 unique base types and eight unique HK flowers', () => {
    expect(TILE_CATALOG).toHaveLength(34)
    expect(new Set(TILE_CATALOG).size).toBe(34)
    expect(Object.keys(FLOWERS)).toHaveLength(8)
  })
  it.each([['3m', '4m'], ['1s', '2s'], ['9p', '1p'], ['north', 'east'], ['red', 'white'], ['white', 'green'], ['green', 'red']] as const)('%s indicator maps to %s', (indicator, dora) => expect(getDoraFromIndicator(indicator)).toBe(dora))
  it('converts all suited and honor wraparounds', () => {
    expect(getDoraFromIndicator('9m')).toBe('1m')
    expect(getDoraFromIndicator('9s')).toBe('1s')
    expect(getDoraFromIndicator('east')).toBe('south')
  })
})

describe('Hand Builder physical input validation', () => {
  it('permits incomplete drafts but not falsely confirmed 14-tile wins', () => {
    const data = newGame()
    const draft = createDraft(data, 'round-a', 'bottom')
    expect(saveDraft(data, draft, false).drafts[0].status).toBe('draft')
    expect(() => saveDraft(data, draft, true)).toThrow(/14/)
    draft.concealed = TILE_CATALOG.slice(0, 13).map((tile) => tileInstance(tile))
    draft.winningTile = tileInstance('east')
    expect(logicalTileCount(draft)).toBe(14)
    // Structural completeness only: this deliberately is not a winning-hand evaluator.
    expect(saveDraft(data, draft, true).drafts[0].status).toBe('confirmed')
    expect(physicalTileCount(draft)).toBe(14)
    draft.concealed.push(draft.winningTile)
    expect(validateDraft(draft, data).join(' ')).toContain('重複')
  })
  it('counts an upgraded Kan as one logical group and four physical tiles', () => {
    const data = recordAction(ponGame(), 'bottom', added())
    const draft = createDraft(data, 'round-a', 'bottom')
    expect(draft.melds).toHaveLength(1)
    expect(draft.melds[0].id).toBe('meld-a')
    expect(logicalTileCount(draft)).toBe(3)
    expect(physicalTileCount(draft)).toBe(4)
    expect(completedKanCount(data, draft)).toBe(1)
  })
  it('guards draft Added Kan through the same Pon eligibility and retains its ID', () => {
    const data = ponGame()
    const draft = createDraft(data, 'round-a', 'bottom')
    expect(() => upgradeDraftPon(draft, 'unknown', true)).toThrow()
    expect(() => upgradeDraftPon(draft, 'meld-a', false)).toThrow()
    const upgraded = upgradeDraftPon(draft, 'meld-a', true)
    expect(upgraded.melds[0].id).toBe('meld-a')
    expect(upgraded.melds[0].originalPon?.kind).toBe('pon')
    expect(validateDraft(upgraded, data)).toEqual([])
    const fake = structuredClone(upgraded)
    delete fake.melds[0].originalPon
    expect(validateDraft(fake, data).join(' ')).toContain('加槓缺少')
  })
  it('limits all base tile families to four, including red/ordinary fives and actual indicators', () => {
    const data = newGame('riichi')
    const draft = createDraft(data, 'round-a', 'bottom')
    draft.concealed = [0, 1, 2].map(() => tileInstance('5p'))
    draft.winningTile = tileInstance('5p', true)
    expect(validateDraft(draft, data)).toEqual([])
    draft.concealed.push(tileInstance('5p'))
    expect(validateDraft(draft, data).join(' ')).toContain('超過四張')
    draft.concealed = [tileInstance('5p', true), tileInstance('5p', true)]
    draft.winningTile = null
    expect(validateDraft(draft, data).join(' ')).toContain('赤五超過')
    draft.concealed = [0, 1, 2, 3].map(() => tileInstance('5p'))
    expect(validateDraft(draft, data).join(' ')).toContain('普通五牌超過')
    draft.redFives.enabled = false
    expect(validateDraft(draft, data)).toEqual([])
    draft.indicators.push({ id: 'indicator', kind: 'dora', tile: tileInstance('5p') })
    expect(validateDraft(draft, data).join(' ')).toContain('超過四張')
  })
  it('keeps flowers unique and separate, allowing special flower drafts without 14 ordinary tiles', () => {
    const data = newGame()
    const draft = createDraft(data, 'round-a', 'bottom')
    draft.win.specialFlower = true
    draft.flowers = ['spring', 'summer', 'autumn', 'winter', 'plum', 'orchid', 'chrysanthemum', 'bamboo']
    expect(logicalTileCount(draft)).toBe(0)
    expect(validateDraft(draft, data, true)).toEqual([])
    draft.flowers.push('spring')
    expect(validateDraft(draft, data).join(' ')).toContain('只可一張')
    const riichi = createDraft(newGame('riichi'), 'round-a', 'bottom')
    riichi.flowers = ['spring']
    expect(validateDraft(riichi, newGame('riichi')).join(' ')).toContain('不使用花牌')
  })
  it('requires explicit red composition review on recorded five melds', () => {
    const data = ponGame('riichi')
    const draft = createDraft(data, 'round-a', 'bottom')
    expect(draft.melds[0].redCount).toBeNull()
    expect(validateDraft(draft, data, true).join(' ')).toContain('赤牌數量')
    draft.melds[0] = setMeldRedCount(draft.melds[0], 1)
    expect(draft.melds[0].tiles.filter((tile) => tile.red)).toHaveLength(1)
  })
  it('requires a distinct Ron source and does not double count a separately selected winning tile', () => {
    const data = newGame()
    const draft = createDraft(data, 'round-a', 'bottom')
    draft.win.method = 'ron'
    expect(validateDraft(draft, data, true).join(' ')).toContain('出銃玩家')
    draft.win.sourcePlayer = 'bottom'
    expect(validateDraft(draft, data).join(' ')).toContain('不能是贏家')
    draft.win.sourcePlayer = 'right'
    draft.concealed = TILE_CATALOG.slice(0, 13).map((tile) => tileInstance(tile))
    draft.winningTile = tileInstance('east')
    expect(validateDraft(draft, data, true)).toEqual([])
    expect(physicalTileCount(draft)).toBe(14)
  })
})

describe('actual dora and ura input', () => {
  it('does not resurrect an undone recorded Kan from a saved draft snapshot', () => {
    const data = recordAction(ponGame('riichi'), 'bottom', added(), 'upgrade')
    const draft = createDraft(data, 'round-a', 'bottom')
    expect(completedKanCount(data, draft)).toBe(1)
    const undone = undoAction(data, 'upgrade')
    expect(completedKanCount(undone, draft)).toBe(0)
    expect(validateDraft(draft, undone, true).join(' ')).toContain('副露記錄已更正')
  })
  it('only permits ura for a confirmed recorded closed Riichi winner', () => {
    let data = newGame('riichi')
    const draft = createDraft(data, 'round-a', 'bottom')
    expect(hasConfirmedRiichi(data, draft)).toBe(false)
    data = recordAction(data, 'bottom', { kind: 'riichi', confirmed: true })
    expect(hasConfirmedRiichi(data, draft)).toBe(true)
    draft.indicators = [{ id: 'd', kind: 'dora', tile: tileInstance('1m') }, { id: 'u', kind: 'ura', tile: tileInstance('2m') }]
    expect(validateDraft(draft, data)).toEqual([])
    draft.melds.push(makeMeld('pon', 'white', 'bottom', 'round-a', 'riichi'))
    expect(hasConfirmedRiichi(data, draft)).toBe(false)
    expect(validateDraft(draft, data).join(' ')).toContain('裏寶牌只適用')
  })
  it('supports repeated indicators while counting only completed Kans', () => {
    let data = newGame('riichi')
    data = recordAction(data, 'top', call('ankan', 'white', 'kan-one'))
    const draft = createDraft(data, 'round-a', 'bottom')
    draft.indicators = [{ id: 'd1', kind: 'dora', tile: tileInstance('1m') }, { id: 'd2', kind: 'dora', tile: tileInstance('1m') }]
    expect(draft.indicators.map((item) => getDoraFromIndicator(item.tile.type))).toEqual(['2m', '2m'])
    expect(validateDraft(draft, data)).toEqual([])
    const robbed = recordAction(ponGame('riichi'), 'bottom', { ...added(), kanStatus: 'robbed' })
    const robbedDraft = createDraft(robbed, 'round-a', 'bottom')
    expect(completedKanCount(robbed, robbedDraft)).toBe(0)
    expect(projectRound(robbed, 'round-a').melds[0].kind).toBe('pon')
    robbedDraft.indicators = draft.indicators
    expect(validateDraft(robbedDraft, robbed).join(' ')).toContain('未完成')
  })
})
