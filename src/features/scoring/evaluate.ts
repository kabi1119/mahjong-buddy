import { validateRules } from '../match/rules'
import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition } from '../../types/mahjong'
import type { GameplayData, HandDraft } from '../actions/models'
import { projectRound } from '../actions/engine'
import { validateDraft } from '../hands/drafts'
import { countsOf, tileIndex } from './shape'
import { scoreRiichi } from './riichi'
import { scoreHongKong, hkMultiplier } from './hongKong'
import { defaultHKScoreRules } from './models'
import type { Payment, ScoreResult, WinConditions } from './models'
import { effectiveIndicators, importRoundIndicators } from './indicators'
import { getNextPlayer } from '../game/rules'
export function seatWindIndex(dealer: PlayerPosition, player: PlayerPosition): number {
  let seat = dealer
  for (let index = 0; index < 4; index++) { if (seat === player) return 27 + index; seat = getNextPlayer(seat) }
  throw new Error('未知玩家。')
}
export function scoringFingerprint(data: GameplayData): string {
  const round = data.rounds.find((item) => item.id === data.activeRoundId)
  const match = data.match
  return JSON.stringify([data.activeRoundId, round, data.actions.filter((action) => action.roundId === data.activeRoundId), match && { roundId: match.roundId, rules: match.rules, phase: match.phase, dealer: match.dealer, wind: match.roundWind, kyoku: match.kyoku, honba: match.honba, points: match.points, pool: match.pool, legacy: match.legacyUnreconciled }])
}
export function validateWinContext(data: GameplayData, draft: HandDraft, conditions: WinConditions): void {
  const match = data.match; const round = data.rounds.find((item) => item.id === data.activeRoundId)
  if (!match || !round || match.phase !== 'playing' || round.id !== draft.roundId || match.roundId !== draft.roundId || round.variant !== draft.variant || match.variant !== draft.variant) throw new Error('這份手牌不屬於目前行牌中的牌局。')
  const ruleErrors = validateRules(match.rules)
  if (ruleErrors.length) throw new Error(ruleErrors.join(' '))
  if (match.legacyUnreconciled) throw new Error('舊局須先由牌局摘要核對實際點數及供託。')
  const ordinary = conditions.workflow === 2
  if (ordinary && conditions.exceptional !== false) throw new Error('特殊合法性／包牌／多家食糊情況須另行處理，不能自動結算。')
  if (!ordinary && !draft.reviewedMelds) throw new Error('請完成遺漏副露檢查；程式不會假設門前清。')
  if (conditions.version !== 1 || (!ordinary && !conditions.reviewed)) throw new Error('請核對情境條件；不會自動假設特殊役成立。')
  if (!ordinary && !conditions.legalWinConfirmed) throw new Error(draft.variant === 'hong-kong' ? '請自行核對過水、宣告時機及實體食糊資格。' : '請自行核對振聽、宣告時機及實體和牌資格。')
  if (!ordinary && !conditions.singleWinner) throw new Error('多家同時和牌尚未支援，不能當單一和牌結算。')
  if (!ordinary && !conditions.noResponsibility) throw new Error('包牌／責任支付尚未支援，請先在實體牌桌處理，不會套用普通結算。')
  if (match.roundWind > 3) throw new Error('延長圈的圈風未明確設定，不能可靠計分。')
  const problems = validateDraft(draft, data, true)
  if (problems.length) throw new Error(problems.join(' '))
  const menzen = draft.melds.every((meld) => !meld.open)
  const view = projectRound(data, round.id)
  if (Object.keys(view.issues).length) throw new Error("本局有未能套用的動作記錄，請先更正；不可忽略副露後假設門前清。 " + Object.values(view.issues)[0])
  const recorded = view.melds.filter((meld) => meld.playerId === draft.winner)
  if (recorded.length !== draft.melds.length || draft.melds.some((meld) => !recorded.some((item) => item.id === meld.id && item.kind === meld.kind && item.tile === meld.tile && item.open === meld.open && item.sourcePlayer === meld.sourcePlayer && item.tiles.length === meld.tiles.length && item.tiles.every((tile, index) => tile.id === meld.tiles[index].id && tile.type === meld.tiles[index].type && (item.redCount === null || tile.red === meld.tiles[index].red))))) throw new Error('最後副露與本局動作不符；請透過補充遺漏副露作明確更正。')
  const openTriplets = draft.melds.filter((meld) => meld.open && meld.kind !== 'chi')
  const openDragons = openTriplets.filter((meld) => ['white', 'green', 'red'].includes(meld.tile)).length
  const openWinds = openTriplets.filter((meld) => ['east', 'south', 'west', 'north'].includes(meld.tile)).length
  const kans = draft.melds.filter((meld) => meld.tiles.length === 4)
  const lastKan = [...kans].sort((a, b) => (data.actions.find((action) => action.id === b.upgradeActionId || action.id === b.actionId)?.order ?? b.order) - (data.actions.find((action) => action.id === a.upgradeActionId || action.id === a.actionId)?.order ?? a.order))[0]
  if (openDragons === 3 || (draft.variant === 'riichi' && (openWinds === 4 || (kans.length === 4 && lastKan?.kind === 'daiminkan'))) || (draft.variant === 'hong-kong' && draft.win.method === 'tsumo' && draft.melds.filter((meld) => meld.open).length === 4)) throw new Error('此公開副露組合可能涉及包牌／責任支付，此版不套用普通付款，請在實體牌桌核對例外規則。')
  const riichi = view.riichi.some((item) => item.playerId === draft.winner)
  if (riichi && !menzen) throw new Error('立直與最後明副露資料矛盾，請更正記錄。')
  if ((conditions.doubleRiichi || conditions.ippatsu) && (!riichi || !menzen)) throw new Error('雙立直／一發需要有效的門前立直記錄。')
  if (conditions.ippatsu && riichi) {
    const declaration = data.actions.find((action) => action.id === view.riichi.find((item) => item.playerId === draft.winner)!.actionId)!
    if (view.melds.some((meld) => data.actions.some((action) => (action.id === meld.actionId || action.id === meld.upgradeActionId) && action.order > declaration.order))) throw new Error('立直後已有已確認鳴牌／完成槓，不能計一發。')
  }
  if (draft.variant === 'hong-kong' && (conditions.doubleRiichi || conditions.ippatsu || conditions.tenhou || conditions.chiihou)) throw new Error('港式不可套用日本限定役。')
  if (draft.variant === 'riichi' && (conditions.hkHeaven || conditions.hkEarth || conditions.hkHuman || conditions.consecutiveKan || draft.win.specialFlower)) throw new Error('日本模式不可套用港式花糊／特殊番種。')
  if (draft.win.specialFlower && [conditions.hkHeaven, conditions.hkEarth, conditions.hkHuman, conditions.rinshan, conditions.consecutiveKan, conditions.haitei, conditions.houtei, conditions.chankan].some(Boolean)) throw new Error('花糊與首巡／槓／牌尾情境複合的家規未設定；不會產生未核實的普通結算。')
  if (conditions.consecutiveKan && (conditions.haitei || conditions.houtei || conditions.chankan)) throw new Error('連槓補牌自摸不可同時計普通牌山海底或棄牌和牌。')
  const tsumo = draft.win.method === 'tsumo'
  if (conditions.rinshan && (!tsumo || !draft.melds.some((meld) => meld.tiles.length === 4))) throw new Error('嶺上／槓上自摸需要完成的槓及自摸。')
  if (conditions.consecutiveKan && (!tsumo || draft.melds.filter((meld) => meld.tiles.length === 4).length < 2)) throw new Error('連槓開花需要至少兩組完成的槓及自摸。')
  const hkV1 = match.rules.variant === 'hong-kong' && match.rules.scoring?.firstTurn === 'v1'
  const earthRon = hkV1 ? conditions.hkHuman : conditions.hkEarth
  const earthTsumo = hkV1 ? conditions.hkEarth : conditions.hkHuman
  if (hkV1 && conditions.hkHuman && match.rules.variant === 'hong-kong' && !match.rules.scoring?.humanWin) throw new Error('本局未啟用人糊家規。')
  if ((conditions.chankan || conditions.houtei || earthRon) && tsumo) throw new Error(draft.variant === 'hong-kong' ? '搶槓／海底出銃／首巡出銃情境需要食取棄牌。' : '搶槓／河底榮和需要棄牌和牌。')
  if ((conditions.haitei || conditions.tenhou || conditions.chiihou || conditions.hkHeaven || earthTsumo) && !tsumo) throw new Error('所選情境需要自摸。')
  if (Number(conditions.rinshan) + Number(conditions.chankan) + Number(conditions.haitei) + Number(conditions.houtei) > 1) throw new Error('嶺上、搶槓、海底及河底不能同時成立。')
  if (Number(conditions.tenhou) + Number(conditions.chiihou) + Number(conditions.hkHeaven) + Number(conditions.hkEarth) + Number(conditions.hkHuman) > 1) throw new Error('首巡特殊和牌情境互相矛盾。')
  if (conditions.tenhou || conditions.chiihou || conditions.hkHeaven || conditions.hkEarth || conditions.hkHuman) {
    if (view.melds.length || draft.melds.length) throw new Error('首巡特殊和牌不可與任何已記錄副露／槓並存。')
    if ((conditions.tenhou || conditions.hkHeaven) !== (draft.winner === match.dealer)) throw new Error(draft.variant === 'hong-kong' ? '天糊屬莊家；地糊／人糊屬閒家。' : '天和屬莊家；地和屬閒家。')
    if (riichi || conditions.haitei || conditions.houtei || conditions.rinshan || conditions.chankan) throw new Error('首巡和牌與立直或牌尾／槓情境矛盾。')
    if (earthRon && draft.win.sourcePlayer !== match.dealer) throw new Error(hkV1 ? '人糊須食莊家第一張棄牌。' : '舊家規地糊須食莊家第一張棄牌。')
  }
  const allPhysical = [...draft.concealed, ...draft.melds.flatMap((meld) => meld.tiles), ...(draft.winningTile ? [draft.winningTile] : []), ...draft.indicators.map((item) => item.tile), ...view.melds.filter((meld) => meld.playerId !== draft.winner).flatMap((meld) => meld.tiles)]
  const unique = new Map(allPhysical.map((tile) => [tile.id, tile]))
  if (countsOf([...unique.values()].map((tile) => tile.type)).some((count) => count > 4)) throw new Error('手牌、已知其他副露及指示牌合共超過四張相同實體牌。')
  if (draft.variant === 'riichi') {
    const frozenRules = match.rules
    if (frozenRules.variant !== 'riichi' || !(['m', 'p', 's'] as const).every((suit) => (draft.redFives.enabled ? draft.redFives.perSuit[suit] : 0) === frozenRules.redFives[suit])) throw new Error('草稿赤五供應量與本局凍結規則不同，請明確套用本局設定再核對實體牌。')
    const others = view.melds.filter((meld) => meld.playerId !== draft.winner)
    const winnerAndIndicators = [...draft.concealed, ...draft.melds.flatMap((meld) => meld.tiles), ...(draft.winningTile ? [draft.winningTile] : []), ...draft.indicators.map((entry) => entry.tile)]
    if (others.some((meld) => meld.redCount === null && meld.tiles.some((tile) => /^5[mps]$/.test(tile.type) && winnerAndIndicators.some((known) => known.type === tile.type)))) throw new Error('同種五牌有其他牌友副露的赤五組成未知，請先核對其實體赤五數量。')
    for (const suit of ['m', 'p', 's'] as const) {
      const unknownIds = new Set(others.filter((meld) => meld.redCount === null).flatMap((meld) => meld.tiles).map((tile) => tile.id))
      const known = [...unique.values()].filter((tile) => tile.type === '5' + suit && !unknownIds.has(tile.id))
      if (known.filter((tile) => tile.red).length > frozenRules.redFives[suit] || known.filter((tile) => !tile.red).length > 4 - frozenRules.redFives[suit]) throw new Error('手牌、副露及指示牌的赤五／普通五超過本局實體供應量。')
    }
    const entries = round.dora?.entries
    if (!entries?.some((entry) => entry.kind === 'initial' && entry.status === 'effective' && entry.tile)) throw new Error('本局尚未記錄第一張實際寶牌指示牌。')
    if (entries.some((entry) => ['pending', 'deferred'].includes(entry.status))) throw new Error('請先確認新槓寶牌指示牌已翻開或尚未翻開；不可用未知狀態計分。')
    if (entries.some((entry) => entry.kind === 'kan' && entry.timing === 'immediate' && entry.status !== 'effective')) throw new Error('本局家規要求暗槓／即時槓寶牌已翻開，請先核對指示牌。')
    const effective = effectiveIndicators(data, round.id)
    const ura = draft.indicators.filter((entry) => entry.kind === 'ura')
    if (riichi && ura.length !== effective.length) throw new Error('立直和牌需輸入與有效寶牌位置數量相同的裏寶牌／槓裏指示牌。')
    if (!riichi && ura.length) throw new Error('非立直贏家不可計裏寶牌。')
  }
}
export function evaluateWin(data: GameplayData, input: HandDraft, conditions: WinConditions): ScoreResult {
  const draft = importRoundIndicators(data, input)
  validateWinContext(data, draft, conditions)
  const match = data.match!; const seatWind = seatWindIndex(match.dealer, draft.winner); const roundWind = 27 + match.roundWind
  const payments: Payment[] = []; const pay = (from: PlayerPosition, amount: number, reason: string) => {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('付款必須是安全範圍內的非負整數；請修正單位／付款表。')
    if (from === draft.winner) throw new Error('付款者不能是贏家。')
    if (amount) payments.push({ from, to: draft.winner, amount, reason })
  }
  let summary: Omit<ScoreResult, 'version' | 'payments' | 'deltas' | 'poolDelta' | 'winnerTotal'>
  if (match.rules.variant === 'riichi') {
    const riichi = projectRound(data, draft.roundId).riichi.some((item) => item.playerId === draft.winner)
    const score = scoreRiichi(draft, match.rules, conditions, riichi, seatWind, roundWind)
    const dealerWin = draft.winner === match.dealer
    if (draft.win.method === 'ron') pay(draft.win.sourcePlayer!, Math.ceil(score.basePoints * (dealerWin ? 6 : 4) / 100) * 100 + 300 * match.honba, '榮和＋本場')
    else for (const seat of POSITIONS.filter((position) => position !== draft.winner)) pay(seat, Math.ceil(score.basePoints * (dealerWin || seat === match.dealer ? 2 : 1) / 100) * 100 + 100 * match.honba, '自摸＋本場')
    summary = { variant: 'riichi', ...score, rawFan: 0, fan: 0 }
  } else {
    const score = scoreHongKong(draft, match.rules, conditions, seatWind, roundWind)
    const profile = match.rules.scoring ?? { ...defaultHKScoreRules(), baseUnit: undefined }
    let ron: number; let tsumo: number
    if (match.rules.payment === 'custom') {
      const row = match.rules.payouts.find((item) => item.fan === score.fan)
      if (!row) throw new Error('缺少本番數的明確出銃／自摸付款表。')
      ron = row.ron; tsumo = row.tsumo
    } else {
      const baseUnit = profile.baseUnit ?? conditions.hkBaseUnit
      if (!Number.isSafeInteger(baseUnit) || baseUnit! <= 0) throw new Error('港式未設定付款基本單位。請明確填寫零番一份金額，再確認本次付款設定。')
      const amount = hkMultiplier(score.fan, match.rules.payment) * baseUnit!
      ron = amount * profile.ronMultiplier; tsumo = amount * profile.tsumoMultiplier
    }
    if (draft.win.method === 'ron') pay(draft.win.sourcePlayer!, ron, '出銃一家支付')
    else for (const seat of POSITIONS.filter((position) => position !== draft.winner)) pay(seat, tsumo, '自摸每家支付')
    summary = { variant: 'hong-kong', ...score, han: 0, fu: 0, fuBreakdown: [], yakuman: 0, basePoints: 0, tier: 0 }
  }
  const deltas = { top: 0, right: 0, bottom: 0, left: 0 }
  for (const payment of payments) { deltas[payment.from] -= payment.amount; deltas[payment.to] += payment.amount }
  const poolDelta = match.variant === 'riichi' ? -match.pool : 0; deltas[draft.winner] -= poolDelta
  if (Object.values(deltas).reduce((a, b) => a + b, 0) + poolDelta !== 0 || POSITIONS.some((seat) => !Number.isSafeInteger(deltas[seat]) || !Number.isSafeInteger(match.points[seat] + deltas[seat]))) throw new Error('結算不守恆或超出整數範圍。')
  return { version: 1, ...summary, payments, deltas, poolDelta, winnerTotal: deltas[draft.winner] }
}
export function isOrdinaryTileAvailable(data: GameplayData, draft: HandDraft, type: import('../hands/tiles').TileType, red = false): boolean {
  const physical = [...draft.concealed, ...draft.melds.flatMap((meld) => meld.tiles), ...(draft.winningTile ? [draft.winningTile] : []), ...importRoundIndicators(data, draft).indicators.map((entry) => entry.tile), ...projectRound(data, draft.roundId).melds.filter((meld) => meld.playerId !== draft.winner).flatMap((meld) => meld.tiles)]
  if (physical.filter((tile) => tile.type === type).length >= 4) return false
  if (/^5[mps]$/.test(type) && draft.variant === 'riichi') {
    const configured = draft.redFives.enabled ? draft.redFives.perSuit[type[1] as 'm' | 'p' | 's'] : 0
    const unknownIds = new Set([...draft.melds, ...projectRound(data, draft.roundId).melds.filter((meld) => meld.playerId !== draft.winner)].filter((meld) => meld.redCount === null).flatMap((meld) => meld.tiles).map((tile) => tile.id))
    if (physical.filter((tile) => tile.type === type && tile.red === red && !unknownIds.has(tile.id)).length >= (red ? configured : 4 - configured)) return false
  } else if (red) return false
  return tileIndex(type) >= 0
}
