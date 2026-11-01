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
      <p>番數與付款設定供未來計分使用；目前不會自動計分或支付。東南西北四圈 · 固定 8 花 · 每邊 18 棟。</p>
      {rules.payment === 'custom' && <div className="payout-table"><p>每番請明確填寫出銃及自摸金額（不提供預設付款表）。</p>{Array.from({ length: Math.max(0, Math.min(14, rules.fanCap - rules.minimumFan + 1)) }, (_, index) => rules.minimumFan + index).map((fan) => <div key={fan}><b>{fan} 番</b>{(['ron', 'tsumo'] as const).map((kind) => <label key={kind}>{kind === 'ron' ? '出銃' : '自摸'}<input aria-label={fan + '番' + kind} type="number" min="0" step="any" value={rules.payouts.find((row) => row.fan === fan)?.[kind] ?? ''} onChange={(e) => {
        const row = rules.payouts.find((item) => item.fan === fan) ?? { fan, ron: NaN, tsumo: NaN }
        hk({ payouts: [...rules.payouts.filter((item) => item.fan !== fan), { ...row, [kind]: e.target.value === '' ? NaN : Number(e.target.value) }] })
      }} /></label>)}</div>)}</div>}
    </> : <>
      <label>牌局長度<select aria-label="牌局長度" value={rules.length} onChange={(e) => riichi({ length: e.target.value as 'hanchan' | 'tonpuu' })}><option value="hanchan">半莊（東南）</option><option value="tonpuu">東風戰</option></select></label>
      <label>起始點數<input aria-label="起始點數" type="number" min="1000" max="1000000" step="100" value={rules.startingPoints} onChange={(e) => riichi({ startingPoints: Number(e.target.value) })} /></label>
      {(['m', 'p', 's'] as const).map((suit) => <label key={suit}>赤五{({ m: '萬', p: '筒', s: '索' })[suit]}<input aria-label={'赤五' + suit} type="number" min="0" max="4" value={rules.redFives[suit]} onChange={(e) => riichi({ redFives: { ...rules.redFives, [suit]: Number(e.target.value) } })} /></label>)}
      <label className="check-line"><input type="checkbox" checked={rules.fourKanAbortive} onChange={(e) => riichi({ fourKanAbortive: e.target.checked })} />四槓散了（途中流局）</label>
      <p>固定 2 骰 · 每邊 17 棟 · 未聽牌總支付 3,000 點 · 最多四槓。流局增加一本場；供託延續。四槓散了屬休閒家規，並非 WRC 2025 賽制。</p>
    </>}
    </fieldset>
    {restore ? <div className="confirmation"><p>確定還原兩個模式的預設規則？儲存前仍可取消。</p><button type="button" onClick={() => setRestore(false)}>取消還原</button><button type="button" onClick={() => { setDraft(defaultPreferences()); setRestore(false) }}>確認還原預設</button></div> : !readonly && <button className="secondary-button" type="button" onClick={() => setRestore(true)}>還原預設</button>}
    {error && <p role="alert">{error}</p>}
    <div className="sheet-buttons"><button type="button" className="secondary-button" onClick={onClose}>{readonly ? '關閉' : '取消'}</button>{!readonly && <button type="button" className="primary-button" onClick={() => { const errors = [...validateRules(draft.hongKong), ...validateRules(draft.riichi)]; if (errors.length) { setError(errors.join(' ')); return } onSave((current) => ({ ...current, preferences: draft, setup: current.setup ? { ...current.setup, hkDiceCount: draft.hongKong.dice } : undefined })); onClose() }}>儲存設定</button>}</div>
  </Sheet>
}
