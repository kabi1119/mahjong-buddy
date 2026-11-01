import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { POSITIONS } from '../../types/mahjong'
import type { PlayerPosition } from '../../types/mahjong'
import type { Settings } from '../../storage/settings'
import { activeRound, projectRound, recordAction } from '../actions/engine'
import type { GameplayData, HandDraft } from '../actions/models'
import { createDraft, hasConfirmedRiichi, logicalTileCount, physicalTileCount, saveDraft, setMeldRedCount, validateDraft } from './drafts'
import { FLOWERS, HONORS, TILE_CATALOG, newId, tileInstance, tileLabel } from './tiles'
import type { FlowerType, TileType } from './tiles'
import { TileFace, TileRow } from './TilePicker'
import { addSelectedTile, correctRecordedRedCount, designateWinningTile, removeSelectedTile } from './builder'
import { MeldReview } from './MeldReview'
import { evaluateWin, isOrdinaryTileAvailable } from '../scoring/evaluate'
import { emptyConditions } from '../scoring/models'
import type { ScoreResult, WinConditions } from '../scoring/models'
import { lockWinningHand } from '../scoring/settlement'
import { importRoundIndicators, effectiveIndicators } from '../scoring/indicators'
import { IndicatorEditor } from '../scoring/IndicatorEditor'
import { ResultPanel } from '../scoring/ResultPanel'
import { syncMatch } from '../match/engine'
interface Props {
  data: GameplayData; settings: Settings; playerId: PlayerPosition; winId?: string | null; storageStatus: string
  onUpdate: (update: (s: Settings) => Settings) => void; onChange: (data: GameplayData) => void; onClose: () => void
}
function WinCatalog({ data, draft, flowers, disabled, onPick, onFlower }: { data: GameplayData; draft: HandDraft; flowers: boolean; disabled: boolean; onPick: (tile: TileType, red: boolean) => void; onFlower: (flower: FlowerType) => void }) {
  const [group, setGroup] = useState('m')
  const options = [['m', '萬子'], ['p', '筒子'], ['s', '索子'], ['z', '番子'], ...(flowers ? [['flowers', '花牌']] : [])]
  const tiles = TILE_CATALOG.filter((type) => group === 'z' ? HONORS.includes(type as typeof HONORS[number]) : type.endsWith(group))
  return <section aria-label="手牌選牌區" className="win-catalog"><div className="tile-tabs" role="group" aria-label="手牌分類">{options.map(([id, name]) => <button type="button" key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{name}</button>)}</div>
    {group === 'flowers' ? <div className="flower-palette">{Object.entries(FLOWERS).map(([id, name]) => <button type="button" key={id} aria-label={`花牌 ${name}`} disabled={draft.flowers.includes(id as FlowerType)} onClick={() => onFlower(id as FlowerType)}>{name}</button>)}</div> : <div className="tile-palette">{tiles.flatMap((type) => [false, ...(draft.variant === 'riichi' && /^5[mps]$/.test(type) ? [true] : [])].map((red) => <button type="button" key={`${type}:${red}`} aria-label={tileLabel(type, red)} disabled={disabled || !isOrdinaryTileAvailable(data, draft, type, red)} onClick={() => onPick(type, red)}><TileFace type={type} red={red} /><span>{tileLabel(type, red)}</span></button>))}</div>}
  </section>
}
const situationLabels: [keyof WinConditions, string][] = [
  ['doubleRiichi', '雙立直：首巡、未有鳴牌前已實體宣告'], ['ippatsu', '一發：立直後一巡內，無人鳴牌或開槓'],
  ['rinshan', '嶺上／槓上自摸：和牌張確為完成槓後的補牌'], ['chankan', '搶槓：食取未完成加槓的那張牌'],
  ['haitei', '海底自摸：普通牌山最後一張（不是嶺上牌）'], ['houtei', '河底榮和：最後一張棄牌'],
  ['tenhou', '天和：莊家起手，無鳴牌／槓'], ['chiihou', '地和：閒家第一摸，無鳴牌／槓'],
  ['hkHeaven', '天糊：莊家起手自摸'], ['hkEarth', '地糊：食莊家第一張棄牌'], ['hkHuman', '人糊：閒家首巡自摸，無鳴牌／槓'], ['consecutiveKan', '連槓開花：連續補槓後自摸，中途沒有補花'],
]
export function WinFlow({ data, settings, playerId, winId, storageStatus, onUpdate, onChange, onClose }: Props) {
  const currentRound = activeRound(data)
  const existingWin = data.wins?.find((win) => win.id === winId || (!winId && win.roundId === data.activeRoundId && win.status !== 'reversed'))
  const [draft, setDraft] = useState(() => existingWin?.draft ?? createDraft(data, currentRound!.id, playerId))
  const [lockedId, setLockedId] = useState<string | null>(existingWin?.id ?? null)
  const [stage, setStage] = useState<'context' | 'builder'>('context')
  const [conditions, setConditions] = useState<WinConditions>(() => draft.conditions ?? emptyConditions())
  const [dirty, setDirty] = useState(false); const [closing, setClosing] = useState(false); const [preview, setPreview] = useState(false)
  const [meldEditor, setMeldEditor] = useState(false); const [chooseWinning, setChooseWinning] = useState(false)
  const [target, setTarget] = useState<'hand' | 'ura'>('hand'); const [error, setError] = useState(''); const [riichiConfirm, setRiichiConfirm] = useState(false)
  const locked = data.wins?.find((win) => win.id === lockedId)
  const finalDraft = importRoundIndicators(data, draft)
  const round = data.rounds.find((item) => item.id === draft.roundId)!
  const riichi = hasConfirmedRiichi(data, finalDraft)
  const unknownOtherFives = draft.variant === 'riichi' ? projectRound(data, draft.roundId).melds.filter((meld) => meld.playerId !== draft.winner && meld.redCount === null && meld.tiles.some((tile) => /^5[mps]$/.test(tile.type))) : []
  const savedDrafts = data.drafts.filter((item) => item.winner === playerId && item.variant === round.variant && !data.wins?.some((win) => win.draft.id === item.id && win.status !== 'reversed'))
  const hand = [...draft.concealed, ...(draft.winningTile ? [draft.winningTile] : [])].sort((a, b) => TILE_CATALOG.indexOf(a.type) - TILE_CATALOG.indexOf(b.type) || Number(a.red) - Number(b.red))
  let score: ScoreResult | undefined; let problem = ''
  if (!locked && stage === 'builder' && (logicalTileCount(finalDraft) === 14 || finalDraft.win.specialFlower)) {
    try { score = evaluateWin(data, finalDraft, conditions) } catch (err) { problem = err instanceof Error ? err.message : '無法可靠計分。' }
  }
  function change(next: HandDraft, validate = true) {
    const problems = validate ? validateDraft(next, data) : []
    if (problems.length) { setError(problems.join(' ')); return }
    setDraft({ ...next, status: 'draft' }); setDirty(true); setError('')
  }
  function pick(type: TileType, red: boolean) {
    try {
      if (target === 'ura') change({ ...finalDraft, indicators: [...finalDraft.indicators, { id: newId(), kind: 'ura', tile: tileInstance(type, red) }] })
      else change(addSelectedTile(finalDraft, type, red))
    } catch (err) { setError(err instanceof Error ? err.message : '未能加入牌張。') }
  }
  function conditionChange(next: WinConditions) { setConditions(next); setDirty(true); setError('') }
  function save() { try { onChange(saveDraft(data, { ...finalDraft, conditions }, false)); setDirty(false); onClose() } catch (err) { setError(err instanceof Error ? err.message : '未能儲存草稿。') } }
  const title = locked ? '計分與四人結算' : stage === 'context' ? draft.variant === 'riichi' ? '和牌記錄' : '食糊記錄' : '贏牌 Hand Builder'
  const close = () => !locked && dirty ? setClosing(true) : onClose()
  const showHand = <><div className="selected-hand" aria-label="已選手牌">{hand.map((tile) => <button type="button" key={tile.id} className={tile.id === draft.winningTile?.id ? 'winning-tile' : ''} aria-label={`${chooseWinning ? '指定和牌張：' : '移除'}${tileLabel(tile.type, tile.red)}`} onClick={() => {
    if (chooseWinning) { if (tile.id !== draft.winningTile?.id) change(designateWinningTile(finalDraft, tile.id)); setChooseWinning(false) }
    else change(removeSelectedTile(finalDraft, tile.id))
  }}><TileFace type={tile.type} red={tile.red} />{tile.id === draft.winningTile?.id && <small>和牌張</small>}</button>)}</div>
    {draft.flowers.length > 0 && <div className="selected-flowers">{draft.flowers.map((flower) => <button key={flower} type="button" aria-label={`移除花牌 ${FLOWERS[flower]}`} onClick={() => change({ ...finalDraft, flowers: draft.flowers.filter((item) => item !== flower) })}>{FLOWERS[flower]}</button>)}</div>}
    {draft.melds.length > 0 && <section className="recorded-melds"><h3>已記錄牌組</h3>{draft.melds.map((meld) => <article className="meld-card" key={meld.id}><strong>{meld.kind === 'chi' ? '上／吃' : meld.kind === 'pon' ? '碰' : meld.kind === 'ankan' ? '暗槓' : meld.kind === 'shouminkan' ? '加槓' : '大明槓'} · {meld.open ? '明' : '暗'}</strong><TileRow tiles={meld.tiles} /><small>來源：{meld.sourcePlayer ? round.players[meld.sourcePlayer].nickname : '未記錄／暗槓'}</small>{draft.variant === 'riichi' && meld.tiles.some((tile) => /^5[mps]$/.test(tile.type)) && <label className="action-field">核對實體赤五<select aria-label={`牌組 ${meld.id} 赤五數量`} value={meld.redCount ?? ''} onChange={(event) => { try { const count = Number(event.target.value); const next = correctRecordedRedCount(data, meld.id, count); const updated = setMeldRedCount(meld, count); onChange(next); change({ ...finalDraft, melds: draft.melds.map((item) => item.id === meld.id ? updated : item) }) } catch (err) { setError(err instanceof Error ? err.message : '未能核對赤五。') } }}><option value="" disabled>請核對</option>{Array.from({ length: meld.tiles.filter((tile) => /^5[mps]$/.test(tile.type)).length + 1 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></label>}</article>)}</section>}
  </>
  const otherFiveReview = unknownOtherFives.length > 0 && <details className="action-history"><summary>其他牌友副露赤五待核對（{unknownOtherFives.length}）</summary><p>同種五牌會共用四張實體供應量；只核對已公開副露，不需輸入其他手牌。</p>{unknownOtherFives.map((meld) => <label className="action-field" key={meld.id}>{round.players[meld.playerId].nickname}<TileRow tiles={meld.tiles} /><select aria-label={'其他副露 ' + meld.id + ' 赤五數量'} value="" onChange={(event) => { try { onChange(correctRecordedRedCount(data, meld.id, Number(event.target.value))) } catch (err) { setError(err instanceof Error ? err.message : '未能核對赤五。') } }}><option value="" disabled>核對實體赤五</option>{Array.from({ length: meld.tiles.filter((tile) => /^5[mps]$/.test(tile.type)).length + 1 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></label>)}</details>
  return <Sheet title={title} className="hand-builder" onClose={close}>
    {locked ? <ResultPanel settings={settings} win={locked} onUpdate={onUpdate} onClose={onClose} storageStatus={storageStatus} /> : closing ? <div className="discard-confirm"><h3>放棄未儲存修改？</h3><p>已儲存草稿及明確補錄的動作會保留。</p><button className="primary-button action-wide" type="button" onClick={() => setClosing(false)}>繼續編輯</button><button className="secondary-button action-wide" type="button" onClick={onClose}>放棄未儲存修改</button></div> : <>
      <p className="action-player">{round.players[draft.winner].avatar} {round.players[draft.winner].nickname} · {draft.variant === 'riichi' ? '日本四麻' : '香港麻雀'}</p>
      {stage === 'context' ? <>
        <label className="action-field">贏牌方式<select aria-label="贏牌方式" value={draft.win.method} onChange={(event) => change({ ...finalDraft, win: { ...draft.win, method: event.target.value as 'tsumo' | 'ron', sourcePlayer: null } })}><option value="tsumo">自摸</option><option value="ron">{draft.variant === 'riichi' ? '榮和' : '出銃'}</option></select></label>
        {draft.win.method === 'ron' && <label className="action-field">棄牌玩家<select aria-label="棄牌玩家" value={draft.win.sourcePlayer ?? ''} onChange={(event) => change({ ...finalDraft, win: { ...draft.win, sourcePlayer: (event.target.value || null) as PlayerPosition | null } })}><option value="">請選擇</option>{POSITIONS.filter((seat) => seat !== draft.winner).map((seat) => <option key={seat} value={seat}>{round.players[seat].nickname}</option>)}</select></label>}
        {draft.variant === 'hong-kong' && <label className="check-line"><input type="checkbox" checked={draft.win.specialFlower} onChange={(event) => change({ ...finalDraft, win: { ...draft.win, specialFlower: event.target.checked } })} />七／八花即食（不需普通 14 張牌）</label>}
        {savedDrafts.length > 0 && <details className="saved-drafts"><summary>繼續已儲存草稿／記錄（{savedDrafts.length}）</summary>{savedDrafts.map((item) => <button className="secondary-button action-wide" type="button" key={item.id} onClick={() => { setDraft(structuredClone(item)); setConditions(item.conditions ?? emptyConditions()); setStage('builder'); setDirty(false) }}>繼續草稿 · {new Date(item.updatedAt).toLocaleDateString('zh-HK')}{item.roundId !== data.activeRoundId && '（舊局，只可存草稿）'}</button>)}</details>}
        <button className="primary-button action-wide" type="button" disabled={draft.win.method === 'ron' && !draft.win.sourcePlayer} onClick={() => setStage('builder')}>繼續重建贏牌</button>
      </> : <>
        <p className="winning-instruction">請將最後和牌嗰張留到最後選擇。</p>
        <p className="hand-count" role="status">邏輯牌 {logicalTileCount(finalDraft)}/14 · 尚餘 {Math.max(0, 14 - logicalTileCount(finalDraft))} · 實體普通牌 {physicalTileCount(finalDraft)}（花牌另計）</p>
        <h3>已選手牌 <small>點牌移除；排序不會改變和牌張</small></h3>{showHand}{otherFiveReview}
        {hand.length > 1 && <button className="secondary-button action-wide" type="button" aria-pressed={chooseWinning} onClick={() => setChooseWinning((value) => !value)}>{chooseWinning ? '請點選上方手牌，指定和牌張' : '改選和牌張'}</button>}
        <WinCatalog data={data} draft={finalDraft} flowers={draft.variant === 'hong-kong' && target === 'hand'} disabled={target === 'hand' ? logicalTileCount(finalDraft) >= 14 : finalDraft.indicators.filter((item) => item.kind === 'ura').length >= effectiveIndicators(data, draft.roundId).length} onPick={pick} onFlower={(flower) => change({ ...finalDraft, flowers: [...finalDraft.flowers, flower] })} />
        <p className="action-note">{target === 'ura' ? '現在選擇實際裏寶牌指示牌。' : '現在選擇未副露的手牌，最後一張會標作和牌張。'}</p>
        {target === 'ura' && <button className="secondary-button action-wide" type="button" onClick={() => setTarget('hand')}>返回手牌選牌</button>}
        <section className="builder-section"><h3>有冇漏咗記錄嘅上／吃、碰、槓？</h3><button className="secondary-button action-wide" type="button" onClick={() => setMeldEditor((value) => !value)}>補充遺漏副露</button>
          {meldEditor && <MeldReview data={data} draft={finalDraft} onClose={() => setMeldEditor(false)} onChange={(next, updated) => { onChange(next); change(updated, false) }} />}
          <label className="check-line"><input type="checkbox" checked={draft.reviewedMelds ?? false} onChange={(event) => change({ ...finalDraft, reviewedMelds: event.target.checked }, false)} />已核對所有副露、槓、明暗及赤牌組成，沒有遺漏</label>
        </section>
        {draft.variant === 'riichi' && <section className="builder-section">{finalDraft.legacyIndicators?.length ? <details><summary>保留的舊草稿指示牌（只供核對）</summary><p>舊版每位玩家的私人指示牌已保留。請明確核對本局共用記錄；不會把舊牌值自動當作已翻開。</p>{finalDraft.legacyIndicators.map((entry, index) => <TileFace key={index} type={entry.tile.type} red={entry.tile.red} />)}</details> : null}<details><summary>本局寶牌與槓寶牌（所有玩家共用）</summary><IndicatorEditor data={data} onChange={onChange} /></details>
          {!riichi && draft.melds.every((meld) => !meld.open) && <details><summary>實體已立直但忘記錄？</summary><label className="check-line"><input type="checkbox" checked={riichiConfirm} onChange={(event) => setRiichiConfirm(event.target.checked)} />確認本局確有立直、門前清及聽牌；補錄會扣 1,000 至供託</label><button className="secondary-button action-wide" type="button" disabled={!riichiConfirm} onClick={() => { try { onChange(syncMatch(recordAction(data, draft.winner, { kind: 'riichi', confirmed: true }))); setRiichiConfirm(false) } catch (err) { setError(err instanceof Error ? err.message : '未能補錄。') } }}>確認補錄立直</button></details>}
          {riichi && <><h3>裏寶牌指示牌</h3><p>需要 {effectiveIndicators(data, draft.roundId).length} 個實際指示牌，請依首張、再各槓的有效位置次序輸入。</p>{finalDraft.indicators.filter((item) => item.kind === 'ura').map((entry) => <button className="ura-tile" type="button" key={entry.id} aria-label={`移除裏寶牌 ${tileLabel(entry.tile.type)}`} onClick={() => change({ ...finalDraft, indicators: finalDraft.indicators.filter((item) => item.id !== entry.id) })}><TileFace type={entry.tile.type} red={entry.tile.red} /></button>)}<button className="secondary-button action-wide" type="button" onClick={() => setTarget('ura')}>輸入實際裏寶牌／槓裏指示牌</button></>}
        </section>}
        <details className="builder-section"><summary>核對特殊和牌情境</summary><p className="action-note">只勾選實際發生的情境；未勾選不會獲得額外番／役。程式不追蹤每次摸打。</p>{situationLabels.filter(([key]) => draft.variant === 'riichi' ? !['hkHeaven', 'hkEarth', 'hkHuman', 'consecutiveKan'].includes(key) : !['doubleRiichi', 'ippatsu', 'tenhou', 'chiihou'].includes(key)).map(([key, label]) => <label className="check-line" key={key}><input type="checkbox" checked={!!conditions[key]} onChange={(event) => { setConditions({ ...conditions, [key]: event.target.checked }); setDirty(true) }} />{label}</label>)}</details>
        {draft.variant === 'hong-kong' && data.match?.rules.variant === 'hong-kong' && data.match.rules.payment !== 'custom' && data.match.rules.scoring?.baseUnit === undefined && <label className="action-field">本局未設定零番一份基本金額（整數）<input type="number" min="1" step="1" aria-label="本次港式付款基本單位" value={conditions.hkBaseUnit ?? ''} onChange={(event) => { setConditions({ ...conditions, hkBaseUnit: event.target.value === '' ? undefined : Number(event.target.value) }); setDirty(true) }} /><small>按本局半辣上／辣辣上倍率換算；出銃一家付 {data.match.rules.scoring?.ronMultiplier ?? 2} 份，自摸每家付 {data.match.rules.scoring?.tsumoMultiplier ?? 1} 份。此明確補充會寫入鎖定快照。</small></label>}
        <label className="check-line"><input type="checkbox" checked={conditions.reviewed} onChange={(event) => conditionChange({ ...conditions, reviewed: event.target.checked })} />已核對和牌方式、和牌張、花牌及所有特殊情境</label>
        <label className="check-line"><input type="checkbox" checked={conditions.legalWinConfirmed} onChange={(event) => conditionChange({ ...conditions, legalWinConfirmed: event.target.checked })} />{draft.variant === 'riichi' ? '已自行核對振聽、立直及和牌宣告合法性' : '已自行核對過水及食糊宣告合法性'}</label>
        <label className="check-line"><input type="checkbox" checked={conditions.singleWinner} onChange={(event) => conditionChange({ ...conditions, singleWinner: event.target.checked })} />只有這位贏家，並非多家同時和牌</label>
        <label className="check-line"><input type="checkbox" checked={conditions.noResponsibility} onChange={(event) => conditionChange({ ...conditions, noResponsibility: event.target.checked })} />沒有包牌／責任支付或其他例外付款</label>
        {draft.variant === 'riichi' && data.match?.rules.variant === 'riichi' && (['m', 'p', 's'] as const).some((suit) => draft.redFives.perSuit[suit] !== (data.match!.rules as import('../match/rules').JapaneseRiichiRules).redFives[suit]) && <button className="secondary-button action-wide" type="button" onClick={() => change({ ...finalDraft, redFives: { enabled: true, perSuit: structuredClone((data.match!.rules as import('../match/rules').JapaneseRiichiRules).redFives) } }, false)}>套用本局凍結赤五設定，再核對實體牌</button>}
        {problem && <p className="game-error" role="status">{problem}</p>}
        <button className="primary-button action-wide" type="button" disabled={!score || storageStatus !== 'saved'} onClick={() => setPreview(true)}>確認手牌</button>
      </>}
      {error && <p className="game-error" role="alert">{error}</p>}
      {storageStatus !== 'saved' && <p className="storage-warning">{storageStatus === 'saving' ? '正在儲存；請稍候再鎖定。' : '本機儲存未就緒；可繼續輸入，但暫不能鎖定或結算。'}</p>}
      <button className="secondary-button action-wide" type="button" onClick={save}>儲存未完成草稿</button>
      {preview && <Sheet title="確認最後手牌" onClose={() => setPreview(false)}><p>{round.players[draft.winner].nickname} · {draft.win.method === 'tsumo' ? '自摸' : draft.variant === 'riichi' ? '榮和' : '出銃'}{draft.win.sourcePlayer && ` · 來源 ${round.players[draft.win.sourcePlayer].nickname}`}</p><TileRow tiles={draft.concealed} />{draft.winningTile && <div className="winning-tile"><TileFace type={draft.winningTile.type} red={draft.winningTile.red} /><small>和牌張</small></div>}{draft.melds.map((meld) => <article className="meld-card" key={meld.id}><strong>{meld.kind} · {meld.open ? '明' : '暗'}</strong><TileRow tiles={meld.tiles} /></article>)}{draft.flowers.length > 0 && <p>花牌：{draft.flowers.map((flower) => FLOWERS[flower]).join('、')}</p>}{finalDraft.indicators.map((entry) => <div className="indicator-card" key={entry.id}><span>{entry.kind === 'ura' ? '裏寶牌指示牌' : '寶牌指示牌'}</span><TileFace type={entry.tile.type} red={entry.tile.red} /></div>)}<p className="lock-warning">確認後無法返回修改手牌。</p><p>鎖定不會套用付款；下一步仍須核對並確認結算。</p><div className="sheet-buttons"><button className="secondary-button" type="button" onClick={() => setPreview(false)}>返回檢查</button><button className="primary-button" type="button" disabled={!score || storageStatus !== 'saved'} onClick={() => { try { const next = lockWinningHand(data, finalDraft, conditions, true); setLockedId(next.wins!.at(-1)!.id); onChange(next); setPreview(false); setDirty(false) } catch (err) { setPreview(false); setError(err instanceof Error ? err.message : '未能鎖定。') } }}>確認並鎖定</button></div></Sheet>}
    </>}
  </Sheet>
}
