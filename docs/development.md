# 開發、儲存與部署筆記

Mahjong Buddy is a mobile-first companion for **physical** Mahjong games, built with React, TypeScript and Vite. The primary interface uses Traditional Chinese (Hong Kong). The application displays the version from `package.json`.

## Project

- Local checkout: `C:\Projects\mahjong-buddy`
- GitHub repository: [kabi1119/mahjong-buddy](https://github.com/kabi1119/mahjong-buddy)
- Cloudflare target: [app.mahjong-buddy.workers.dev](https://app.mahjong-buddy.workers.dev)
- Worker name: `app` (independent of the application and repository names).

## Run locally

```sh
npm install
npm run dev
```

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

```sh
npm run build
npm run lint
npm test
npm run preview
```

## Current features

- Hong Kong Mahjong / Japanese four-player Riichi mode selection.
- Four upright, editable player seats around a green felt table.
- Player nickname (up to 12 UTF-16 code units) and 16 labelled emoji avatars.
- Save, cancel, edit, and remove individual players via a native modal dialog, with keyboard focus containment, Escape dismissal, and focus restoration.
- Automatic IndexedDB persistence of confirmed players and the selected mode across refreshes and application restarts.
- Mobile layout with a 430px maximum width, safe-area padding, and reduced-motion support. From 900px viewport width, the same centered single-column app has a 590px maximum width with larger table contents. Desktop height follows its content rather than filling the viewport, and all controls remain reachable by scrolling.
- Manual/random dealer selection, counter-clockwise seat winds, two/three HK dice or two Riichi dice, and a rotated wall-opening guide.
- Initial Riichi dead-wall/dora locations and HK replacement-tail guidance.
- A 2×2 mode selector (two enabled), system/light/dark themes, Smart Chi, frozen rule preferences, exhaustive draws, dealer progression, Noten payments, Honba, deposits, history and undo. Four-Kan confirmation uses a separate abortive outcome.

Switching modes preserves player seats and resets setup. Physical seat labels describe screen positions; Mahjong winds are assigned relative to the selected dealer. Cancelled editor drafts are never saved.

Win-triggered hand reconstruction and manual call recording are implemented. RC4 adds automatic supported HK/Riichi scoring, explicit single-winner settlement, immutable locked snapshots and win-driven dealer progression. It does not simulate physical tiles, detect discards/claims, verify Furiten from an unrecorded discard history, provide accounts/backend storage, or implement PWA caching. See [rules and chosen variations](rules.md) for verified references, coordinate conventions and limitations.

## Local storage

- Database: `mahjong-companion`, database version 1. This legacy persistence identifier is intentionally retained after the Mahjong Buddy rename so existing local data remains available on the same browser and origin.
- Object store: `settings`; single record key: `table`.
- Record: `{ schemaVersion: 1, variant, players: { [seat]: { nickname, avatar } }, setup?, gameplay?, preferences?, themePreference? }`. Position is stored only as the map key; the React model reconstructs it when loading. The optional versioned `setup` is additive and retains compatibility with older player records.
- Database and record versions are separate migration boundaries for future changes. Unsupported record versions are not overwritten.
- Startup performs a read without saving defaults; editing controls stay disabled until it settles. Confirmed player changes, removals, mode changes and game setup actions enqueue writes. Writes are serialized to preserve the order of rapid changes.
- A missing record uses defaults. Stored variants, seats, nicknames and avatars are validated; invalid entries are ignored. Nothing is automatically written back during restoration.
- A read failure leaves the app usable in memory and disables writes for that session to protect unread data. A write failure retains current edits, shows a warning, and retries the complete current settings after the next confirmed change. A blocked/unresponsive database open falls back after at most three seconds.

Storage belongs to this browser and origin. Clearing site data can remove it, and private browsing may limit retention. There is no cloud backup, export/import, or live synchronization between tabs; competing tabs use the last successful write. Keep the same localhost hostname and port when testing persistence. Browser data APIs cannot make an unfinished save survive an immediate tab close; wait for the saved status before closing.

## Source layout

- `src/App.tsx`: application shell, mode and player state.
- `src/features/table/MahjongTable.tsx`: table, seats, dealer highlights and round actions and game information.
- `src/features/players/PlayerEditor.tsx`: draft player editing and accessible dialog.
- `src/types/mahjong.ts`: variant, seat, avatar and player types and options.
- `src/storage/settings.ts`: versioned IndexedDB access and stored-data validation.
- `src/storage/useSettings.ts`: hydration, serialized confirmed writes and storage status.
- `src/features/game/`: pure setup/rule calculations, dice controls, legacy setup compatibility and wall-opening diagram.
- `src/App.css` / `src/index.css` / `src/themes.css`: application and global styles.
- `tests/`: Vitest tests using jsdom, React Testing Library, and fake-indexeddb. These are development-only dependencies; persistence has no runtime dependency.

## Deploy to Cloudflare Workers

From the project root, run these commands when ready to publish:

```sh
npm install
npm run build
npx wrangler login
npx wrangler deploy
```

Wrangler is a development dependency. On PowerShell with script execution disabled, use `npm.cmd` and `npx.cmd`. Login opens Cloudflare's authentication flow; deploy uploads the built frontend in `dist/` to the `app` Worker. Rebuild before each deployment so the uploaded files contain the latest changes. GitHub push alone does **not** deploy; CI/CD must be configured separately.

The root `wrangler.jsonc` sets compatibility date `2026-11-01`, assets directory `./dist`, and `single-page-application` fallback. There is no Worker API entrypoint, database binding, Cloudflare Vite plugin or backend. See [Cloudflare's SPA routing documentation](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

The application is already publicly deployed at https://app.mahjong-buddy.workers.dev/. A local `npx wrangler deploy --dry-run` checks packaging without publishing. Publishing a new build requires an explicit deployment; updating this checkout alone does not update the live app.

Player names, avatars, mode, dealer, dice and setup state continue to use the same local IndexedDB implementation. The app does not upload that data to Cloudflare and contains no account system, analytics or tracking integration. Cloudflare serves the frontend files; ordinary hosting requests still reach Cloudflare. IndexedDB is isolated per browser **and website origin**, so localhost, the deployed domain, another custom domain and another phone have separate data. Existing localhost data does not automatically migrate to the deployed site. Offline PWA installation and caching are not implemented or verified.

## Validation and mobile QA

Production build, ESLint and automated tests pass. Tests cover the previous player-persistence behavior plus all dealer positions, dice rejection sampling, selected walls, right-end orientations, corner wrapping, dead-wall/dora locations, roll overlap prevention, reduced motion, game-state invalidation/restoration, match progression, four-Kan pending/finalized outcomes, ledger reconciliation, and both safe resets.

A prior deployment dry run passed against `dist/` assets with no bindings. This is a local packaging check, distinct from the already deployed public app.

Tests emulate IndexedDB and dialog opening in jsdom. They do not verify native dialog focus, browser rendering, or physical device storage. Browser QA could not be completed because the browser access host was unavailable. The following checks remain manual; they are not recorded as passing:

1. At 320, 375, 390, 402 and 430px widths, check the table and dialogs for horizontal overflow and overlapping content. At desktop, check 1280×720, 1440×900 and 1920×1080, prioritizing 100% browser zoom and checking 110% as well. The 900px breakpoint caps the app and dialogs at 590px; content remains scrollable without height filler, body zoom or transforms.
2. Switch both modes and confirm the selected mode, caption and center panel update, retaining players.
3. Add a player at each seat. Choose an avatar, enter a nickname, save, and confirm only that seat updates immediately.
4. Reopen a player, change both fields, then cancel. Confirm the saved player remains unchanged. Repeat and save.
5. Check blank and whitespace-only nicknames cannot be saved; long nicknames wrap within their seats.
6. With keyboard navigation, check focus stays within the dialog, radio buttons support arrow keys, Escape cancels, and focus returns to the opening seat.
7. On iOS and Android, check safe areas, scrolling with the software keyboard open, and access to save/cancel on short screens.
8. Refresh or reopen the same origin and confirm players and mode restore. Remove one player, refresh again, and confirm only that seat stays empty.
9. Simulate blocked storage and quota errors in a browser. Confirm warnings are readable, settings remain editable, and no saved state is overwritten following a failed read.
10. Complete dealer selection and rolling in both variants; compare the diagram against a physical wall, including a Riichi total of 2 and an HK total of 18. Check the wall-guide dialog's focus and scrolling. Confirm dealing, record actions and a draw, refresh, and verify round/ledger restoration.

## v0.2.0b interface notes

The current RC4 display version is v1.0.0rc4 and the valid npm SemVer is 1.0.0-rc.4. The compact mobile and centered desktop layout from v0.2.0b/c is preserved. Database/store/key and record schemaVersion remain unchanged. New gameplay data is an additive, independently versioned field; see the [gameplay model](hand-recording.md). Current wind artwork is 東 for HK and 南 for four-player Riichi. 西 and 北 appear as disabled Coming soon cards; they remain outside the playable variant union.

The mobile table uses content-sized grid rows and a dynamic-viewport minimum size, capped for larger phones. Safari safe areas are included in spacing and size calculations. Long names, expanded settings, accessibility text and short screens can increase page height; ordinary scrolling is intentional. Preparation actions stay outside secondary details. During play there is no More panel or manual turn tracker. Player and wall dialogs use their own dynamic-height scroll areas.

Real iPhone Safari, browser chrome, standalone mode, zoom and native dialog focus remain manual verification tasks. The Apple touch icon is branding only: it does not supply offline caching or installation guarantees. Original SVG files are authoritative; PNG icons are raster exports of the same artwork.

## Gameplay module map

- `src/features/actions/`: versioned data models, pure event projection, same-ID Pon upgrades, undo/correction, round reconciliation, conservative decoder and player sheet.
- `src/features/hands/`: complete typed tile catalog, original SVG tile artwork, structural/physical validation and the win-only reconstruction flow.
- `src/components/Sheet.tsx`: native modal opening, scroll lock and focus restoration.
- `tests/actions.test.ts`, `tests/hands.test.ts`, `tests/gameplayStorage.test.ts`, `tests/playerActions.test.tsx`: deterministic engine, persistence and component coverage.

The same `useSettings` write queue handles all data. Round reset/variant changes archive actions and drafts instead of deleting them. No alternate persistence system or runtime dependency was added.

## RC1 persistence and themes

`src/features/match/` owns independent rule preferences, frozen snapshots, the pure match cursor/ledger, validation and sheets. One authoritative `GameplayData.activeRoundId` binds actions and drafts. Each confirmed draw archives the old hand and creates a new ID atomically within the same record. Match and preferences version 1 are optional additive fields; no stores or database identifiers change. Unknown future versions fail closed without overwriting the record. Resets archive recoverable match data in `pastMatches`. Legacy Riichi declarations require a manual current-balance baseline and are never silently debited.

Theme preference is system/light/dark, independent of gameplay. IndexedDB is authoritative; localStorage key `mahjong-buddy:theme` is only a pre-paint cache for the HTML bootstrap. System media changes are subscribed while in system mode. Global CSS tokens cover dialogs, fields, palettes, errors and the shell; original tile SVG pigments remain unchanged.

RC4 remains a prerelease; the RC1 review report below is historical. No commit, push, deployment or new network dependency is part of implementation. See [RC1 review report](release-rc1.md) for release limits, test results and proposed commit text.

## RC4 scoring implementation and migration

- `src/features/scoring/shape.ts`: exhaustive standard/special decompositions and eligible winning-tile groups.
- `riichi.ts` / `hongKong.ts`: pure variant-specific patterns, exclusions, Fu and limit values.
- `evaluate.ts`: authoritative-meld/context validation, untracked legality confirmations, known responsibility blockers and conserved four-player payments.
- `indicators.ts` / `IndicatorEditor.tsx`: shared round positions, reveal timing, first-indicator preparation gate and explicit corrections.
- `settlement.ts`: immutable lock, independent final payment, stale-state checks, atomic archive/progression and reasoned reversal.
- `storage.ts`: conservative snapshot/ledger/history/reference checks, including unknown-version rejection.
- `ResultPanel.tsx` / `scoring.css`: presentation-only 1.7-second eased amounts, 1.25-second entrance delay, tiered SVG glyph displacement/glow/particles and reduced-motion cleanup. No new dependencies or audio.
- `src/features/hands/builder.ts` / `MeldReview.tsx` / `WinFlow.tsx`: three stages, stable selected tile IDs, manual winning-tile designation, automatic meld import, explicit source-action corrections, complete preview and lock.

The database remains `mahjong-companion`, version 1, store `settings`, key `table`, outer record schemaVersion 1. No object store or database rename. RC4 introduces gameplay version **2**, while reading valid legacy version 1. Migration clones and validates in memory, preserves player/action/meld/draft/round IDs and writes only after an explicit change through the existing serialized queue. Older binaries that support gameplay version 1 reject new version-2 scoring records instead of treating a locked hand as an ordinary editable draft. Versions beyond 2 fail closed. Match/rule/hand/indicator/score/audit records retain their own version boundaries.

Round-level Dora, lock records, score snapshots and reversal reasons are additive fields. Legacy private indicators are retained in the draft's `legacyIndicators` for explicit review; they are not silently promoted to shared revealed tiles. Legacy Riichi declarations still require an actual-balance/pool baseline. Legacy decimal payout preferences remain readable but actual fractional payments are blocked. There is no automatic historical rescore or fabricated opening balance.

A lock persists a confirmed snapshot plus an input fingerprint, not a financial transaction. Final settlement recomputes and compares it, then writes one outcome, one ledger row, balances/pool, archive and new physical ID together within the existing settings record transaction. Repeated finalization is rejected by status and round identity. Every saved win is cross-checked against its ledger/history references. A locked win also blocks exhaustive/abortive-draw replacement even if a UI marker is wrong. Resets archive recoverable records; archived locks can be inspected but cannot be paid in a new round. Audited reversals keep the original score/input snapshot and record a reason.

Win/scoring screens expose storage state. Lock/final payment wait for a saved state; failed persistence retains memory and shows an in-dialog warning plus retry. An unavailable/failed initial read continues to forbid writes. As before, simultaneous independent tabs have no merge protocol; use one active table tab, and do not leave an old release running while upgrading.

## RC4 validation and manual checks

Deterministic tests use literal independent expected patterns/Fu/payments, not expected values generated by the function under test. Coverage includes the supported Yaku/Yakuman catalog, ambiguous hands, open reductions, Ron-completed triplets, red/indicator copies, unknown reveal states, all selected HK payouts, min/caps/exclusions, instant flowers, lock/preview separation, stale/tampered snapshots, first-Dora gating, version-1 migration, unknown versions, explicit reversals and duplicate-payment prevention.

Isolated local headless Chrome checks the builder/results at 320/375/390/402/430px and 1280px desktop with the 590px shell, in Light and Dark. It checks no horizontal dialog/document overflow, reachable scrollable buttons, 44px tile targets, no payments on lock, exact saved final numbers, replay ledger stability and reduced-motion removal of SVG animation/particles. Synthetic data and an isolated temporary browser profile are used. Screenshots were inspected; this is not a physical iPhone or Safari result.

Pending manual/device QA:

1. iPhone Safari and standalone: safe areas, keyboard, nested final-confirmation focus, scrolling to save/lock/payment buttons, large text and pinch/browser zoom.
2. Reconstruct a physical mixed-meld hand in both modes, correct the final tile without deleting the hand, and compare the app's full breakdown to the agreed table rules.
3. Verify first and Kan-Dora positions/timing on a real wall, including Rinshan wins before a delayed open-Kan reveal and a robbed Added Kan. Confirm no stale/unknown indicator is guessed.
4. Inspect every result tier from Mangan through four-or-more genuine Yakuman on mobile. Check typography, irregular glyph-edge effects, readable contrast and sustained Safari performance. Effects must reduce to a static presentation with reduced motion.
5. Confirm final review cancel leaves editing available, refresh after lock reopens the immutable result, payment confirmation changes the ledger once, and an audited reversal restores the full previous balance/pool/dealer state.
6. Induce actual quota/read failures and verify warnings, retries and write protection. Different devices/origins still do not synchronize.

See [RC4 review report](release-rc4.md) for final check results and the exact proposed commit text. No commit, push or deployment is performed by this task.

## v1.0.0 實作、儲存及 PWA 驗證

- Gameplay version 3 保護新版流程與首巡語意，避免舊 RC5 client 忽略新增欄位後依舊規則寫回。decode 可讀 v1／v2／v3，僅在記憶中變更 gameplay 版本，舊規則／條件／結果／ID 不重寫；透過原有 queue 在明確操作時寫入 v3。未來 v4+ 拒絕覆寫；IndexedDB 名稱、版本、store、key 和外層 schema 保留。
- `hands/workflow.ts` 提供新普通流程狀態與條件式首巡選項。舊 WinConditions version 1、舊 reviewed 欄位仍可讀；新草稿加可選 workflow 2 與 exceptional。未知 workflow 拒絕。新增凍結規則欄只用於新牌局，舊快照不填入新預設，保留舊計分及名稱。
- `WinFlow` 針對每次有意義的選牌、情境、花牌、和牌方式等變更，經 `onUpdate(current => ...)` 合併到最新玩法資料，再走原有 `useSettings` 序列化 IndexedDB 寫入。副露更正與共用指示牌亦即時持久化，重開時同步最新有效副露。不使用延遲計時器或卸載時才儲存，因此沒有因關閉對話框而遺失尚未觸發的防抖寫入。
- 「已自動儲存」只在交易成功後顯示；排隊中顯示「儲存中…」。失敗保留記憶狀態與原持久記錄，可重試最新草稿；未儲存／錯誤狀態註冊 beforeunload 保護。系統強制終止、忽略離開警告或裝置突然斷電時，只能保證最後已提交的原子交易，不承諾寫入尚未完成的內容。多分頁仍沒有衝突合併。
- `ResultPanel` 重用 RC4／RC5 特效及原有付款函式，新增計分／四家預覽頁內切換。預覽數字動畫與實際 ledger mutation 分離；降低動態效果直接顯示正確值。
- 本基線實際沒有 manifest／service worker，正式版新增 `manifest.webmanifest`、原有 192／512 圖示引用與無額外套件的 Vite build plugin `scripts/offlineShell.ts`。它按輸出內容與 public 資產產生版本化 shell cache，預先快取本機圖片、圖示與產物。導航先取網絡，離線回退 index；hash 資產用快取。更新等待舊視窗關閉，不強制重新整理正在輸入的手牌；只清理本專案 shell caches，不清除 IndexedDB、localStorage 或其他來源快取。`_headers` 保持 HTML／SW 重新驗證及 hash 資產長快取。Cloudflare Worker 設定未改。
- 安裝偵測：iPhone／iPad Safari（包括 Macintosh UA 的觸控 iPadOS）及 Android Chrome；桌面、已安裝 standalone、辨識到的內嵌 WebView 跳過。localStorage key 為 `mahjong-buddy:a2hs-onboarding-seen:v1`，教學實際呈現即寫入，與「知道了」無關。無法讀寫 seen 狀態則跳過，避免阻擋循環；跨瀏覽器／來源無法辨識同一實體裝置。
- iOS 四張原始截圖直接複製至 `public/install/ios1.png` 至 `ios4.png`，未修改像素；以 CSS 聚焦原有紅圈／箭嘴及實際控制，裁走上方 RC5 版本、無關區域與最後鍵盤。第四階段包含原圖的 Open as Web App 與 Add 兩個動作。Android 三張 SVG 為準確品牌的介面示意，清楚標明非實機截圖，不採用含錯誤網址／多人房間的參考圖。
- 教學只有一個可見按鈕，保留原生 modal focus、Escape、焦點回復、內部捲動、安全區及固定可見的知道了。圖片均在本來源，成功快取後不需外部圖片請求。

PWA 實作依據：[Service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)（快取版本、等待更新）及 [Chromium Web Apps](https://chromium.googlesource.com/chromium/src.git/+/main/docs/webapps/README.md)（安裝入口可隨平台／版本不同）。不會自動啟動原生安裝提示。

本機隔離 Chrome profile 使用合成資料檢查兩個模式與主題、320／375／390／402／430px 及 1280px 桌面。另以 production preview 驗證教學單一按鈕、native focus／Tab、重載不重現、短畫面 320×480、離線 shell 及 Android 圖片載入。這是本機 Chrome 模擬，並非真機 Safari／Android 或 Cloud Browser；仍須發行人驗收真機、OS 安裝結果與 Cloudflare 部署。完整命令結果見 [正式版待審報告](release-v1.0.0.md)。
