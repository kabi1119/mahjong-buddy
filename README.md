# 麻雀伴侶 · Mahjong Companion

v0.1.0 is a mobile-first companion for **physical** Mahjong games, built with React, TypeScript and Vite. The primary interface uses Traditional Chinese (Hong Kong).

## Run locally

```sh
npm install
npm run dev
```

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

```sh
npm run build
npm run lint
npm run preview
```

## Current features

- Hong Kong Mahjong / Japanese four-player Riichi mode selection.
- Four upright, editable player seats around a green felt table.
- Player nickname (up to 12 UTF-16 code units) and 16 labelled emoji avatars.
- Save, cancel, and edit via a native modal dialog, with keyboard focus containment, Escape dismissal, and focus restoration.
- Mobile layout with a 430px maximum width, desktop centering, safe-area padding, and reduced-motion support.
- Clearly labelled future areas for rounds, dealer selection, dice, and wall-breaking instructions.

All player and mode state lives in React memory. Refreshing resets it. Switching modes preserves player seats. Seat labels describe screen positions; they do not assign winds or a dealer.

No scoring, dice algorithm, settlement, authentication, backend, persistence, or PWA caching is included.

## Source layout

- `src/App.tsx`: application shell, mode and player state.
- `src/features/table/MahjongTable.tsx`: table, seats and game information placeholders.
- `src/features/players/PlayerEditor.tsx`: draft player editing and accessible dialog.
- `src/types/mahjong.ts`: variant, seat, avatar and player types and options.
- `src/App.css` / `src/index.css`: application and global styles.

## Validation

Production build and ESLint pass. Browser QA was attempted but could not be completed: the browser access host was unavailable and native app access timed out waiting for approval. The following checks remain manual; they are not recorded as passing:

1. At 320, 375, 390 and 430px widths, check the table and editor for horizontal overflow and overlapping content. At desktop widths, confirm the interface stays centered and at most 430px wide.
2. Switch both modes and confirm the selected mode, caption and center panel update, retaining players.
3. Add a player at each seat. Choose an avatar, enter a nickname, save, and confirm only that seat updates immediately.
4. Reopen a player, change both fields, then cancel. Confirm the saved player remains unchanged. Repeat and save.
5. Check blank and whitespace-only nicknames cannot be saved; long nicknames wrap within their seats.
6. With keyboard navigation, check focus stays within the dialog, radio buttons support arrow keys, Escape cancels, and focus returns to the opening seat.
7. On iOS and Android, check safe areas, scrolling with the software keyboard open, and access to save/cancel on short screens.
8. Refresh and confirm session state resets as described in the UI.
