# Mahjong Buddy v1.0.0 — 本機待審報告

目標版本：`1.0.0`，畫面 `v1.0.0`。這是供人工審核的完整工作樹，沒有 commit、push、deploy 或建立 GitHub Release；線上版本未由本次工作更新。

## 完成功能

模式用語分開、牌組名稱本地化；簡化手牌預覽／鎖定、Dora／槓牌確認；只有一個可選例外欄；手牌與情境自動儲存、關閉續填及錯誤提示。計分與四家結算為分開畫面；查看、返回、重播都不付款，只有最後確認動作寫入帳本。牆上取牌及玩家出牌方向並列，上一局結果與下一局準備文字分開。

新港式底額預設 1，地糊／人糊使用 v1.0 定義，人糊另行啟用；新日麻真正雙倍變體預設開啟，名稱按實際和牌張區別。舊家規、已凍結開關、鎖定快照及歷史付款保留。HK 9 番每家 96、5 飜 30 符滿貫、14 飜 25 符累計等確定性例子及新舊規則均有測試。

IndexedDB `mahjong-companion`、database version 1、settings store、table key、外層 schemaVersion 1 保留；gameplay version 3 讀取並在記憶中遷移 v1／v2，保留原有 ID 及所有凍結快照；新寫入讓 RC5 拒絕誤讀新版語意。新增向後相容的可選流程／規則欄，不清除舊資料。Cloudflare Worker 名稱 app、account_id 與 wrangler.jsonc 未改。

## 教學資產

- iOS：已納入四張使用者原始 `IOS1.png`–`IOS4.png`，在 public/install 保持原始像素；CSS 聚焦實際紅圈、箭嘴與瀏覽器控制，裁走舊版本區域及鍵盤。第四階段包括開啟 Web App 與 Add，保留原圖兩個小步標註。
- Android：本機沒有現成可用的標準 SDK emulator 路徑。採用三張 repo-native SVG 介面示意，使用原有一索小鳥及真實 production domain，明示非實機截圖。沒有採用錯誤網址、多人房間或虛構登入畫面。
- 合資格手機首次實際呈現才記 seen；只有「知道了」按鈕。桌面／standalone 跳過，重要對話框延後；儲存不可用安全跳過。只保證每個瀏覽器／來源的 once-only 狀態。
- 本基線沒有 manifest／service worker，已補上。production build 預快取 shell、圖示及所有本機教學圖片，成功快取後可離線。更新不清資料、不強制重載正在輸入的牌局。

## 驗證結果

- npm run build：TypeScript／Vite production build 通過（含版本化 SW）。
- npm run lint：通過。
- npm test：344／344 通過，零失敗。
- git diff --check：通過。

本機隔離 Chrome 檢查：香港／日本 × Light／Dark，320、375、390、402、430、1280px。手牌預覽不鎖定、鎖定不付款、四家頁導航不付款、付款顯示正確持久金額，重播只一筆帳本；reduced motion 為靜態顯示。

Production preview 另檢查四套教學、320×480 短畫面、圖片成功載入、native Tab 焦點、知道了可見、refresh 不重現、離線重新載入、透過真實 UI 儲存的牌友保留，以及 Android 本機圖片。iOS 四個階段及 Android 圖均已視覺檢查。

這些是本機 Chrome 模擬，不是真機 iPhone／Android 或 Cloud Browser。沒有測試原生 OS 安裝結果或真正 Cloudflare 部署。發行前仍須人工驗收真機、原生安裝與部署後更新；不把這些未測項目標成已通過。

## 限制與發行條件

沒有已知自動測試失敗或缺少截圖資產的阻擋；最終是否發行由使用者決定。支援單一贏家及普通付款；多家同時食糊／榮和、包牌／責任支付、未列地方役、Uma／順位、罰則、飛人自動終局、小數付款等既有限制維持。程式不追蹤完整摸棄牌，不能替實體牌桌驗證未知過水／振聽或宣告時機。

自動儲存只在交易完成後聲稱成功；忽略離開警告、強制終止或突然斷電可能失去尚未提交的變更，保留最後成功交易。沒有多分頁衝突合併、雲端同步或備份。快取可能被 OS 清理，首次載入需要網絡。

## 建議 commit（尚未建立）

```text
v1.0.0 - Release Mahjong Buddy 1.0

- Promote Mahjong Buddy from RC5 to the first official stable release
- Separate Hong Kong and Riichi interface terminology
- Simplify winning-hand verification and locking
- Implement reliable automatic draft saving
- Separate winning-hand scoring from animated four-player settlement
- Correct Heaven, Earth and optional Human win handling
- Enable genuine Double Yakuman variants by default for new Riichi matches
- Preserve configurable Kazoe and multiple Yakuman rules
- Default Hong Kong payment base unit to one
- Simplify Dora indicator and Kan confirmation
- Clarify wall drawing and anticlockwise player turns
- Localize meld names and improve completed-round navigation
- Add screenshot-based iPhone Home Screen installation tutorial
- Add illustrated Android Home Screen installation tutorial
- Display PWA onboarding only once per eligible browser
- Use a single onboarding acknowledgment button
- Preserve historical data and exactly-once settlement behavior
- Expand scoring, persistence, UI and PWA regression tests
- Update documentation and prepare the v1.0.0 stable release
```

## 人工操作

1. 檢查 `git diff`、新增檔案與真機操作，確認所有變更均屬本次發行。
2. 人工 stage 審核過的檔案，用上方完整 title/body commit。
3. 確認分支及遠端後自行 `git push origin main`。
4. 決定部署時自行執行 `npx wrangler deploy`，沿用現有 app Worker。再驗證 HTTPS、v1.0.0、舊記錄、PWA 安裝及離線更新。

## 變更檔案

- README.md
- docs/development.md
- docs/hand-recording.md
- docs/release-v1.0.0.md
- docs/rules.md
- index.html
- package-lock.json
- package.json
- public/_headers
- public/install/android1.svg
- public/install/android2.svg
- public/install/android3.svg
- public/install/ios1.png
- public/install/ios2.png
- public/install/ios3.png
- public/install/ios4.png
- public/manifest.webmanifest
- scripts/offlineShell.ts
- src/App.tsx
- src/components/Sheet.tsx
- src/features/actions/PlayerActions.tsx
- src/features/actions/engine.ts
- src/features/actions/models.ts
- src/features/actions/storage.ts
- src/features/game/WallGuide.tsx
- src/features/hands/MeldReview.tsx
- src/features/hands/WinFlow.tsx
- src/features/hands/builder.ts
- src/features/hands/workflow.ts
- src/features/install/InstallOnboarding.tsx
- src/features/install/install.css
- src/features/install/platform.ts
- src/features/match/MatchFlow.tsx
- src/features/match/MatchSettings.tsx
- src/features/match/engine.ts
- src/features/match/rules.ts
- src/features/scoring/IndicatorEditor.tsx
- src/features/scoring/ResultPanel.tsx
- src/features/scoring/evaluate.ts
- src/features/scoring/indicators.ts
- src/features/scoring/models.ts
- src/features/scoring/riichi.ts
- src/features/scoring/settlement.ts
- src/features/scoring/storage.ts
- src/main.tsx
- src/storage/useSettings.ts
- tests/gameplayStorage.test.ts
- tests/install.test.tsx
- tests/kazoe.test.tsx
- tests/playerActions.test.tsx
- tests/presentation.test.tsx
- tests/rc1.test.tsx
- tests/scoring.test.ts
- tests/scoringFixtures.ts
- tests/settlement.test.ts
- tests/stableScoring.test.ts
- tests/stableWorkflow.test.tsx
- tests/winFlow.test.tsx
- tests/yaku.test.ts
- vite.config.ts
