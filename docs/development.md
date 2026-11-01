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
