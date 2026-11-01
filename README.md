# 麻雀伴侶 · Mahjong Companion

Mahjong Companion is a mobile-first companion for **physical** Mahjong games, built with React, TypeScript and Vite. The primary interface uses Traditional Chinese (Hong Kong). The application displays the version from `package.json`.

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
- Explicitly manual turn tracking after confirming dealing, including claim overrides and reset to East.

Switching modes preserves player seats and resets setup. Physical seat labels describe screen positions; Mahjong winds are assigned relative to the selected dealer. Cancelled editor drafts are never saved.

No scoring, tile simulation, automatic physical-action detection, dealer rotation, settlement, authentication, backend, or PWA caching is included. See [rules and chosen variations](docs/rules.md) for verified references, coordinate conventions and limitations.

## Local storage

- Database: `mahjong-companion`, database version 1.
- Object store: `settings`; single record key: `table`.
- Record: `{ schemaVersion: 1, variant, players: { [seat]: { nickname, avatar } }, setup? }`. Position is stored only as the map key; the React model reconstructs it when loading. The optional versioned `setup` is additive and retains compatibility with older player records.
- Database and record versions are separate migration boundaries for future changes. Unsupported record versions are not overwritten.
- Startup performs a read without saving defaults; editing controls stay disabled until it settles. Only confirmed player changes, removals, and mode changes enqueue writes. Writes are serialized to preserve the order of rapid changes.
- A missing record uses defaults. Stored variants, seats, nicknames and avatars are validated; invalid entries are ignored. Nothing is automatically written back during restoration.
- A read failure leaves the app usable in memory and disables writes for that session to protect unread data. A write failure retains current edits, shows a warning, and retries the complete current settings after the next confirmed change. A blocked/unresponsive database open falls back after at most three seconds.

Storage belongs to this browser and origin. Clearing site data can remove it, and private browsing may limit retention. There is no cloud backup, export/import, or live synchronization between tabs; competing tabs use the last successful write. Keep the same localhost hostname and port when testing persistence. Browser data APIs cannot make an unfinished save survive an immediate tab close; wait for the saved status before closing.

## Source layout

- `src/App.tsx`: application shell, mode and player state.
- `src/features/table/MahjongTable.tsx`: table, seats, dealer/turn highlights and game information.
- `src/features/players/PlayerEditor.tsx`: draft player editing and accessible dialog.
- `src/types/mahjong.ts`: variant, seat, avatar and player types and options.
- `src/storage/settings.ts`: versioned IndexedDB access and stored-data validation.
- `src/storage/useSettings.ts`: hydration, serialized confirmed writes and storage status.
- `src/features/game/`: pure setup/rule calculations, dice controls, manual turns and wall-opening diagram.
- `src/App.css` / `src/index.css`: application and global styles.
- `tests/`: Vitest tests using jsdom, React Testing Library, and fake-indexeddb. These are development-only dependencies; persistence has no runtime dependency.

## Deploy to Cloudflare Workers

From the project root, run these commands when ready to publish:

```sh
npm install
npm run build
npx wrangler login
npx wrangler deploy
```

Wrangler is a development dependency. On PowerShell with script execution disabled, use `npm.cmd` and `npx.cmd`. Login opens Cloudflare's authentication flow; deploy uploads the built frontend in `dist/` to the `mahjong-companion` Worker. Rebuild before each deployment so the uploaded files contain the latest changes. GitHub push alone does **not** deploy; CI/CD must be configured separately.

The root `wrangler.jsonc` sets compatibility date `2026-11-01`, assets directory `./dist`, and `single-page-application` fallback. There is no Worker API entrypoint, database binding, Cloudflare Vite plugin or backend. See [Cloudflare's SPA routing documentation](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

For a local configuration/package check after building, run `npx wrangler deploy --dry-run`. This does not publish a live deployment. For mobile preview after an actual deployment, open the HTTPS URL printed by Wrangler on your phone; no live deployment has been performed as part of this preparation.

Player names, avatars, mode, dealer, dice and setup state continue to use the same local IndexedDB implementation. The app does not upload that data to Cloudflare and contains no account system, analytics or tracking integration. Cloudflare serves the frontend files; ordinary hosting requests still reach Cloudflare. IndexedDB is isolated per browser **and website origin**, so localhost, the deployed domain, another custom domain and another phone have separate data. Existing localhost data does not automatically migrate to the deployed site. Offline PWA installation and caching are not implemented or verified.

## Validation

Production build, ESLint and automated tests pass. Tests cover the previous player-persistence behavior plus all dealer positions, dice rejection sampling, selected walls, right-end orientations, corner wrapping, dead-wall/dora locations, roll overlap prevention, reduced motion, game-state invalidation/restoration, manual turns, and reset without losing players.

Wrangler's deployment dry run also passes against the built `dist/` assets with no bindings. This validates local deployment preparation; no Cloudflare login, upload or live deployment has been performed.

Tests emulate IndexedDB and dialog opening in jsdom. They do not verify native dialog focus, browser rendering, or physical device storage. Browser QA could not be completed because the browser access host was unavailable. The following checks remain manual; they are not recorded as passing:

1. At 320, 375, 390 and 430px widths, check the table and dialogs for horizontal overflow and overlapping content. At desktop, check 1280×720, 1440×900 and 1920×1080, prioritizing 100% browser zoom and checking 110% as well. The 900px breakpoint caps the app and dialogs at 590px; content remains scrollable without height filler, body zoom or transforms.
2. Switch both modes and confirm the selected mode, caption and center panel update, retaining players.
3. Add a player at each seat. Choose an avatar, enter a nickname, save, and confirm only that seat updates immediately.
4. Reopen a player, change both fields, then cancel. Confirm the saved player remains unchanged. Repeat and save.
5. Check blank and whitespace-only nicknames cannot be saved; long nicknames wrap within their seats.
6. With keyboard navigation, check focus stays within the dialog, radio buttons support arrow keys, Escape cancels, and focus returns to the opening seat.
7. On iOS and Android, check safe areas, scrolling with the software keyboard open, and access to save/cancel on short screens.
8. Refresh or reopen the same origin and confirm players and mode restore. Remove one player, refresh again, and confirm only that seat stays empty.
9. Simulate blocked storage and quota errors in a browser. Confirm warnings are readable, settings remain editable, and no saved state is overwritten following a failed read.
10. Complete dealer selection and rolling in both variants; compare the diagram against a physical wall, including a Riichi total of 2 and an HK total of 18. Check the wall-guide dialog's focus and scrolling. Confirm dealing, advance/override turns, refresh, and verify restoration.
