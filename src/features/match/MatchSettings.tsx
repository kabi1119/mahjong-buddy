import { defaultHKScoreRules, defaultRiichiScoreRules } from '../scoring/models'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import type { Settings } from '../../storage/settings'
import { preferencesFor } from './engine'
import { defaultPreferences, validateRules } from './rules'
import type { HongKongRules, JapaneseRiichiRules, ThemePreference } from './rules'
interface Props { settings: Settings; onSave: (update: (current: Settings) => Settings) => void; onClose: () => void }
export function MatchSettings({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(preferencesFor(settings)))
  const [restore, setRestore] = useState(false)
  const [error, setError] = useState('')
  const frozen = settings.gameplay?.match
  const readonly = !!frozen && frozen.phase !== 'ended'
  const rules = readonly ? frozen.rules : settings.variant === 'hong-kong' ? draft.hongKong : draft.riichi
  const hk = (patch: Partial<HongKongRules>) => setDraft({ ...draft, hongKong: { ...draft.hongKong, ...patch } })
  const riichi = (patch: Partial<JapaneseRiichiRules>) => setDraft({ ...draft, riichi: { ...draft.riichi, ...patch } })
  return <Sheet title="牌局設定" onClose={onClose}>
    <label className="action-field">外觀<select aria-label="外觀" value={settings.themePreference ?? 'system'} onChange={(e) => onSave((current) => ({ ...current, themePreference: e.target.value as ThemePreference }))}><option value="system">跟隨系統</option><option value="light">淺色</option><option value="dark">深色</option></select></label>
    {readonly && <p role="status">此牌局使用已凍結規則；重設開局後才可更改。外觀可隨時調整。</p>}
    <fieldset disabled={readonly} className="rules-fields"><legend>{rules.variant === 'hong-kong' ? '香港麻雀' : '日本四麻 · 休閒家規'}</legend>
    {rules.variant === 'hong-kong' ? <>
      <label>骰子<select aria-label="港式骰子數" value={rules.dice} onChange={(e) => hk({ dice: Number(e.target.value) as 2 | 3 })}><option value="3">3 粒</option><option value="2">2 粒</option></select></label>
      <label>流局莊家<select aria-label="流局莊家" value={rules.drawDealer} onChange={(e) => hk({ drawDealer: e.target.value as 'repeat' | 'rotate' })}><option value="repeat">冧莊（連莊）</option><option value="rotate">過莊</option></select></label>
      <label>最低番數<input aria-label="最低番數" type="number" min="0" max={rules.fanCap} value={rules.minimumFan} onChange={(e) => hk({ minimumFan: Number(e.target.value), payouts: [] })} /></label>
      <label>封頂<select aria-label="封頂番數" value={rules.fanCap} onChange={(e) => hk({ fanCap: Number(e.target.value) as 10 | 13, payouts: [] })}><option value="13">13 番</option><option value="10">10 番</option></select></label>
      <label>付款方式<select aria-label="付款方式" value={rules.payment} onChange={(e) => hk({ payment: e.target.value as HongKongRules['payment'] })}><option value="half-la">半辣上</option><option value="full-la">辣辣上</option><option value="custom">自訂番數付款表</option></select></label>
      <p>東南西北四圈 · 固定 8 花 · 每邊 18 棟。港式以零起算累計淨額，莊家不加倍。</p>
      <label>坎坎糊番數<select aria-label="坎坎糊番數" value={rules.scoring?.kankan ?? 8} onChange={(event) => hk({ scoring: { ...(rules.scoring ?? defaultHKScoreRules()), kankan: event.target.value === 'cap' ? 'cap' : Number(event.target.value) as 8 | 10 } })}><option value="8">8 番，另計相容番牌／一色</option><option value="10">10 番，另計相容番牌／一色</option><option value="cap">按本局封頂番數</option></select></label>
      <label className="check-line"><input type="checkbox" checked={rules.scoring?.sevenPairs ?? false} onChange={(event) => hk({ scoring: { ...(rules.scoring ?? defaultHKScoreRules()), sevenPairs: event.target.checked } })} />啟用七對子（三番自訂牌型，非正統預設）</label>
      {rules.payment !== 'custom' && <><label>零番一份基本金額<input type="number" min="1" step="1" aria-label="港式基本付款單位" value={rules.scoring?.baseUnit ?? ''} onChange={(event) => hk({ scoring: { ...(rules.scoring ?? defaultHKScoreRules()), baseUnit: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label><label>出銃一家支付份數<input type="number" min="1" step="1" aria-label="出銃付款份數" value={rules.scoring?.ronMultiplier ?? 2} onChange={(event) => hk({ scoring: { ...(rules.scoring ?? defaultHKScoreRules()), ronMultiplier: Number(event.target.value) } })} /></label><label>自摸每家支付份數<input type="number" min="1" step="1" aria-label="自摸每家付款份數" value={rules.scoring?.tsumoMultiplier ?? 1} onChange={(event) => hk({ scoring: { ...(rules.scoring ?? defaultHKScoreRules()), tsumoMultiplier: Number(event.target.value) } })} /></label><p>基本單位必須由牌友明確輸入。半辣上 3/4/5/6 番倍率為 8/16/24/32；辣辣上每番翻倍。尚未設定金額時會阻止付款。此版只支援出銃一家付款，包牌／責任支付另行阻止。</p></>}
      {rules.payment === 'custom' && <div className="payout-table"><p>每番請明確填寫出銃及自摸金額（不提供預設付款表）。</p>{Array.from({ length: Math.max(0, Math.min(14, rules.fanCap - rules.minimumFan + 1)) }, (_, index) => rules.minimumFan + index).map((fan) => <div key={fan}><b>{fan} 番</b>{(['ron', 'tsumo'] as const).map((kind) => <label key={kind}>{kind === 'ron' ? '出銃' : '自摸'}<input aria-label={fan + '番' + kind} type="number" min="0" step="1" value={rules.payouts.find((row) => row.fan === fan)?.[kind] ?? ''} onChange={(e) => {
        const row = rules.payouts.find((item) => item.fan === fan) ?? { fan, ron: NaN, tsumo: NaN }
        hk({ payouts: [...rules.payouts.filter((item) => item.fan !== fan), { ...row, [kind]: e.target.value === '' ? NaN : Number(e.target.value) }] })
      }} /></label>)}</div>)}</div>}
    </> : <>
      <label>牌局長度<select aria-label="牌局長度" value={rules.length} onChange={(e) => riichi({ length: e.target.value as 'hanchan' | 'tonpuu' })}><option value="hanchan">半莊（東南）</option><option value="tonpuu">東風戰</option></select></label>
      <label>起始點數<input aria-label="起始點數" type="number" min="1000" max="1000000" step="100" value={rules.startingPoints} onChange={(e) => riichi({ startingPoints: Number(e.target.value) })} /></label>
      {(['m', 'p', 's'] as const).map((suit) => <label key={suit}>赤五{({ m: '萬', p: '筒', s: '索' })[suit]}<input aria-label={'赤五' + suit} type="number" min="0" max="4" value={rules.redFives[suit]} onChange={(e) => riichi({ redFives: { ...rules.redFives, [suit]: Number(e.target.value) } })} /></label>)}
      <label className="check-line"><input type="checkbox" checked={rules.fourKanAbortive} onChange={(e) => riichi({ fourKanAbortive: e.target.checked })} />四槓散了（途中流局）</label>
      <label className="check-line"><input type="checkbox" checked={rules.scoring?.kiriage ?? false} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), kiriage: event.target.checked } })} />切上滿貫（4 飜 30 符／3 飜 60 符）</label>
      <label>13+ 飜累計上限<select aria-label="累計役滿政策" value={rules.scoring?.kazoe ?? 'yakuman'} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), kazoe: event.target.value as 'yakuman' | 'sanbaiman' } })}><option value="yakuman">累計役滿（不視作真正役滿組合）</option><option value="sanbaiman">三倍滿封頂</option></select></label>
      <label className="check-line"><input type="checkbox" checked={rules.scoring?.doubleYakuman ?? false} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), doubleYakuman: event.target.checked } })} />雙倍變體（國士十三面、四暗刻單騎、大四喜、純正九蓮）</label>
      <label className="check-line"><input type="checkbox" checked={rules.scoring?.stackYakuman ?? true} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), stackYakuman: event.target.checked } })} />複合真正役滿累加</label>
      <label className="check-line"><input type="checkbox" checked={rules.scoring?.openTanyao ?? true} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), openTanyao: event.target.checked } })} />食斷（副露斷幺九）</label>
      <label>連風雀頭符<select aria-label="連風雀頭符" value={rules.scoring?.doubleWindPair ?? 4} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), doubleWindPair: Number(event.target.value) as 2 | 4 } })}><option value="4">4 符</option><option value="2">2 符</option></select></label>
      <label>槓寶牌翻開時機<select aria-label="槓寶牌翻開時機" value={rules.scoring?.kanReveal ?? 'ankan-immediate-open-after-discard'} onChange={(event) => riichi({ scoring: { ...(rules.scoring ?? defaultRiichiScoreRules()), kanReveal: event.target.value as 'immediate' | 'ankan-immediate-open-after-discard' } })}><option value="ankan-immediate-open-after-discard">暗槓即時；明／加槓出牌後</option><option value="immediate">所有完成槓均即時</option></select></label>
      <p>固定 2 骰 · 每邊 17 棟 · 未聽牌總支付 3,000 點 · 最多四槓。流局增加一本場；供託延續。四槓散了屬休閒家規，並非 WRC 2025 賽制。</p>
    </>}
    </fieldset>
    {restore ? <div className="confirmation"><p>確定還原兩個模式的預設規則？儲存前仍可取消。</p><button type="button" onClick={() => setRestore(false)}>取消還原</button><button type="button" onClick={() => { setDraft(defaultPreferences()); setRestore(false) }}>確認還原預設</button></div> : !readonly && <button className="secondary-button" type="button" onClick={() => setRestore(true)}>還原預設</button>}
    {error && <p role="alert">{error}</p>}
    <div className="sheet-buttons"><button type="button" className="secondary-button" onClick={onClose}>{readonly ? '關閉' : '取消'}</button>{!readonly && <button type="button" className="primary-button" onClick={() => { const errors = [...validateRules(draft.hongKong), ...validateRules(draft.riichi)]; if (errors.length) { setError(errors.join(' ')); return } onSave((current) => ({ ...current, preferences: draft, setup: current.setup ? { ...current.setup, hkDiceCount: draft.hongKong.dice } : undefined })); onClose() }}>儲存設定</button>}</div>
  </Sheet>
}
