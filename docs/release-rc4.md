# Mahjong Buddy v1.0.0rc4 — 待審報告

本機整合版本：`1.0.0-rc.4`；網站顯示 `v1.0.0rc4`。未 commit、push 或部署；線上版本未由本次工作更新。

## 已實作

- 食糊／和牌後三階段流程：贏家及方式 → 手牌重建 → 計分及結算。最後選牌自動標金框，亦可重新指定；點選已選牌移除，牌張 ID 不隨排序改變。
- 匯入本局有效副露，補錄／更正／移除遺漏牌組；加槓保留原碰並只算一組。槓四張實體牌佔三個邏輯位，花牌另計。共用四張上限及凍結赤五供應量；舊副露的未知赤五組成須明確核對。
- 香港正統番型及排除規則、最低番數／封頂、七花即食、半辣／辣辣／自訂整數付款。
- 日本標準役、役滿、全分解及和牌張解釋、符明細、寶牌／槓寶牌／裏／槓裏／赤寶牌，選取最高付款結果。
- 每局共用首張寶牌、依家規確認槓寶牌翻開狀態；僅立直贏家輸入相應裏寶牌。未知資料不會產生假計分。
- 完整手牌預覽後第二次確認才鎖定；鎖定與付款分開。儲存不可普通編輯的快照，另行確認四人轉帳、供託、本場與下一局；防止重複結算，支援最新結算的理由及審計撤銷。
- 結果數字動畫、四人差額及餘額、滿貫至多倍役滿效果、SVG 燃燒字體與降低動態效果。動畫重播不寫入帳本。
- 保留既有主頁、主題、玩家資料、流局及四槓散了流程；更新說明文件。

## 規則假設與限制

坎坎糊採用使用者確認的 **8 番＋相容番牌／清一色／混一色**，不另加門前清或對對糊；正統限制下有槓不算坎坎糊。港式付款須輸入明確整數底額及份數，或自訂付款表，不猜貨幣。預設份數為出銃者兩份、自摸各家一份，無莊家倍數；無起始餘額時記累計淨額。

日本休閒預設：切上滿貫關閉、13 飜累計役滿、雙倍役滿變體關閉、真正役滿複合開啟、食斷開啟、雙風雀頭 4 符；可在新對局設定調整。預設暗槓即翻，明槓／加槓待棄牌後翻，由使用者核對實況。這不是完整 WRC 賽制。

多家榮和、包牌／責任支付、分攤出銃、未列地方役／Renhou、罰則、終局順位／Uma、飛人自動終局及小數付款未支援。已知可能涉及責任支付的組合保守阻止普通結算。程式不逐張追蹤摸棄牌，振聽／過水、實體和牌資格及特殊情境需明確確認。[完整規則、來源及付款定義](rules.md)。

## 本機資料相容

IndexedDB 名稱 `mahjong-companion`、資料庫版本 1、`settings` store、`table` key、外層 schemaVersion 1 均保留。舊 gameplay v1 可讀並保留 ID；RC4 記錄為 gameplay v2，避免舊 RC3 將鎖定手牌當可編輯資料處理。未知未來版本拒絕寫入；不清除舊資料、不虛構歷史餘額。舊手牌私有寶牌保留供核對，不自動當成所有玩家共用的已翻指示牌。

## 變更檔案

- 發行及公開說明：`package.json`、`package-lock.json`、`README.md`。
- 文件：`docs/development.md`、`docs/hand-recording.md`、`docs/rules.md`、本報告。
- 整合：`src/App.tsx`。
- 動作：`src/features/actions/PlayerActions.tsx`、`engine.ts`、`models.ts`、`reconcile.ts`、`storage.ts`、新增 `redComposition.ts`。
- 手牌：`src/features/hands/WinFlow.tsx`、`drafts.ts`、新增 `builder.ts`、`MeldReview.tsx`。
- 對局：`src/features/match/MatchFlow.tsx`、`MatchSettings.tsx`、`engine.ts`、`models.ts`、`rules.ts`、`storage.ts`。
- 新增計分模組 `src/features/scoring/`：`models.ts`、`shape.ts`、`hongKong.ts`、`riichi.ts`、`evaluate.ts`、`indicators.ts`、`IndicatorEditor.tsx`、`settlement.ts`、`storage.ts`、`ResultPanel.tsx`、`scoring.css`。
- 測試更新：`tests/gameplayStorage.test.ts`、`playerActions.test.tsx`、`presentation.test.tsx`、`rc1.test.tsx`；新增 `scoringFixtures.ts`、`scoring.test.ts`、`yaku.test.ts`、`scoringSafety.test.ts`、`settlement.test.ts`、`winFlow.test.tsx`。

`wrangler.jsonc`、Worker 名稱 `app`、Cloudflare 帳戶及部署設定未改。沒有新增套件。

## 驗證

2026-11-01 完成：

- `npm run build`：通過 TypeScript 及 Vite production build。
- `npm run lint`：通過。
- `npm test`：**277／277 通過**，沒有失敗。
- 隔離 Chrome headless 使用合成資料，逐一檢查 Light／Dark × 香港／日本模式；320、375、390、402、430、1280px 無水平溢出，牌張及確認按鈕可用，桌面維持 590px。
- 完整手牌→預覽→鎖定→付款：預覽不鎖定，鎖定不付款；確認後畫面金額等於儲存餘額，帳本只一筆；重播不重複付款。港式封頂及日本 5 倍役滿畫面已檢視。
- 降低動態效果：停用 SVG 動畫及粒子。
- 實體 iPhone Safari／獨立顯示模式未測，仍須人工裝置驗證。
- 未改 Cloudflare 配置；Git HEAD 保持原有 RC3 commit。自動化 QA 暫存位於忽略的 node_modules/.cache，不包含真實使用者資料。

## 建議 commit（尚未建立）

```text
v1.0.0rc4 - Implement Automatic Mahjong Scoring and Settlement

- Redesign the win-triggered Hand Builder with simplified tile selection
- Automatically reconstruct winning hands from recorded melds
- Add missing-meld corrections and winning-tile highlighting
- Introduce final hand verification and irreversible confirmation
- Record Japanese Dora indicators before gameplay and after Kans
- Support conditional Ura-Dora input for Riichi winners
- Implement automatic Hong Kong Fan calculation and configurable payouts
- Implement Japanese Yaku, Fu, Dora and limit-hand scoring
- Support Mangan through multiple Yakuman under configured rules
- Calculate actual four-player settlement and score changes
- Add animated score transitions and premium limit-hand effects
- Introduce cinematic burning typography for Yakuman-level wins
- Integrate finalized wins with match progression and dealer rotation
- Preserve backward-compatible IndexedDB storage and round history
- Expand deterministic scoring tests and update project documentation
```
