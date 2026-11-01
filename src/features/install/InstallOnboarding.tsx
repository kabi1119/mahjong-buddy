import { useEffect, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { eligiblePlatform, ONBOARDING_KEY } from './platform'
import './install.css'
const ios = [
  { title: '點擊頁面選單', detail: '在 Safari 底部網址列，點三條橫線的頁面選單。', crop: [70, 1380, 840, 292] },
  { title: '點選 Share（分享）', detail: '在頁面選單選擇 Share。', crop: [230, 580, 690, 390] },
  { title: '選擇加入主畫面', detail: '在分享面板選擇 Add to Home Screen。', crop: [20, 1110, 910, 260] },
  { title: '開啟 Web App 並加入', detail: '先確認「Open as Web App」已開啟，再點右上角 Add 完成。', crop: [0, 110, 941, 790] },
]
const android = [
  { title: '點擊右上角選單', detail: '在 Android Chrome 點右上角 ⋮。' },
  { title: '選擇安裝應用程式', detail: '部分 Chrome 版本會顯示「新增至主畫面」，名稱及位置可能不同。' },
  { title: '點擊安裝完成', detail: '在確認面板選擇「安裝」或對應的新增按鈕。' },
]
export function InstallOnboarding({ blocked, ready }: { blocked: boolean; ready: boolean }) {
  const [platform] = useState(eligiblePlatform)
  const [dismissed, setDismissed] = useState(false)
  const visible = !!platform && ready && !blocked && !dismissed
  useEffect(() => { if (visible) { try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* Remain dismissible in this document. */ } } }, [visible])
  if (!visible) return null
  return <Sheet title="將麻雀小夥伴加入主畫面" hideClose className="install-guide" onClose={() => setDismissed(true)}>
    <div className="install-intro"><img src="/mahjong.svg" alt="Mahjong Buddy 一索小鳥" width="48" height="48" /><p>加入主畫面後，可以像 App 一樣快速開啟 Mahjong Buddy。</p></div>
    <p className="action-note">{platform === 'ios' ? '以下為 Safari 操作截圖；最後一階段包含開啟 Web App 及 Add 兩個動作。' : '以下為 Android Chrome 安裝示意圖，並非實機截圖；選單依版本可能不同。'}</p>
    <ol className="install-steps">{(platform === 'ios' ? ios : android).map((step, index) => <li key={step.title}><h3><span>STEP {index + 1}</span> {step.title}</h3><p>{step.detail}</p>{'crop' in step ? <div className="install-crop" style={{ aspectRatio: step.crop[2] / step.crop[3] }}><img src={'/install/ios' + (index + 1) + '.png'} alt={'Safari 實際截圖：' + step.title} width="941" height="1672" style={{ width: 941 / step.crop[2] * 100 + '%', left: -step.crop[0] / step.crop[2] * 100 + '%', top: -step.crop[1] / step.crop[3] * 100 + '%' }} /></div> : <img className="install-illustration" src={'/install/android' + (index + 1) + '.svg'} alt={'Android 安裝示意：' + step.title} width="400" height="470" />}</li>)}</ol>
    <div className="install-ack"><button className="primary-button action-wide" type="button" onClick={() => setDismissed(true)}>知道了</button></div>
  </Sheet>
}
