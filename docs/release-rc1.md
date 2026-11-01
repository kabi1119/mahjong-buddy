# Mahjong Buddy v1.0.0rc1 — manual review report

Friends-testing prerelease prepared locally on 1 November 2026. npm SemVer: **1.0.0-rc.1**; header display: **v1.0.0rc1**. No commit, push or deployment was performed. The live site does not contain these local changes yet.

## 1. Files changed

- `README.md`
- `docs/development.md`
- `docs/hand-recording.md`
- `docs/rules.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `src/App.css`
- `src/App.tsx`
- `src/features/actions/PlayerActions.tsx`
- `src/features/actions/engine.ts`
- `src/features/actions/models.ts`
- `src/features/actions/reconcile.ts`
- `src/features/actions/storage.ts`
- `src/features/game/GameControls.tsx`
- `src/features/game/WallGuide.tsx`
- `src/features/hands/TilePicker.tsx`
- `src/features/hands/WinFlow.tsx`
- `src/features/hands/drafts.ts`
- `src/features/hands/hands.css`
- `src/features/table/MahjongTable.tsx`
- `src/index.css`
- `src/storage/settings.ts`
- `src/types/mahjong.ts`
- `tests/app.test.tsx`
- `tests/game.test.tsx`
- `tests/playerActions.test.tsx`
- `tests/presentation.test.tsx`
- `src/features/actions/SmartChi.tsx`
- `src/features/actions/chi.ts`
- `src/features/match/MatchFlow.tsx`
- `src/features/match/MatchSettings.tsx`
- `src/features/match/engine.ts`
- `src/features/match/models.ts`
- `src/features/match/rules.ts`
- `src/features/match/storage.ts`
- `src/features/match/useTheme.ts`
- `src/themes.css`
- `tests/chi.test.ts`
- `tests/match.test.ts`
- `tests/rc1-storage.test.ts`
- `tests/rc1.test.tsx`
- `docs/release-rc1.md` (this report)

The work is in C:\Projects\mahjong-buddy. Existing branded SVGs, PNG icons and README hero artwork are retained. No runtime or development dependency was added. The package lock changes only the root package version.

## 2. Implemented behavior

- Four equal 2×2 cards in East HK / South 日本四麻 / West Sanma / North Taiwan order. Future modes are disabled and excluded from the playable union; internal riichi ID is unchanged.
- Global system/light/dark preference, accessible header sun/moon switch, OS-change subscription, IndexedDB preference, theme-color and pre-paint cache, design tokens across sheets and Hand Builder.
- Existing table center contains round label, dealer, Honba and contextual settings/draw actions. Settings work with no players; current match rules are available through the round summary.
- No active manual turn controls or More section. Two distinct confirmed resets preserve rule preferences, histories and win drafts. Cancel/Escape do not reset.
- Smart Chi selects a numbered discard, illustrates every containing sequence and highlights the claimed tile. It confirms the two supplied tiles, preserves source/claimed/supplied/stable IDs, permits explicit available red-five composition, and supports correction/undo/reload. Predecessor comes from the turn-order function in both modes. Pon and same-ID Added Kan remain intact.
- Wall guide has two centered sections, concise opening text, four dynamic player/wind labels and the original geometry. Riichi alone explains the dead-wall Rinshan replacement; no ordinary live-wall replacement or drawing the indicator is suggested.
- Independent editable HK/Riichi preferences; save/cancel and confirmed restore defaults; frozen match snapshot. Hand Builder reads frozen red-five rules.
- Persistent initial/current dealer, wind/kyoku, physical sequence, Honba, points, pool, history and ledger. Exhaustive draws require explicit confirmation; Riichi requires all four Tenpai/Noten decisions and rejects contradictions with confirmed Riichi.
- Finalization archives the old hand and creates a new ID in one saved settings record. Latest draw undo restores setup, balances, dealer and deposits; it is refused after the next hand has records. Final scheduled hands require an explicit end/extend choice.
- Exactly-once 1,000-point Riichi deposits, carry-over pool and refunds on undo. Legacy declarations are marked unreconciled with an explicit actual-balances/pool form; historical deposits are never silently debited.
- Four-Kan eligibility derives from projected active melds, including Ankan/Daiminkan/Shouminkan once each. Multi-player fourth Kan creates persisted pending confirmation. Physical Rinshan/discard/no-win confirmation is required; reported wins take precedence. Four by one player continues; fifth Kan is prohibited even when abortive draws are disabled.
- Confirmed four-kan-abortive-draw repeats dealer/kyoku, adds one Honba, preserves pool and points, skips Tenpai/Noten payment, archives and prepares a new physical hand, with undo and duplicate-finalization protection.
- Premium README preserves hero/live CTA, adds natural first-use HK/Taiwan glosses and correct Japanese terminology, current limits and Issues feedback link.

## 3. Still unsupported

Automatic legal-win validation, Yaku/Han/Fu/fan calculation, winner payments, final win settlement, win-driven round progression or deposit awards; automatic Tenpai detection; tracking every physical draw/discard; Sanma/Taiwan play; Nuki Kita; accounts/cloud sync; export/import backup; offline PWA caching. Confirmed win input remains pending, without points or outcome changes. An explicitly erroneous win marker can be corrected from the summary without deleting drafts.

## 4. Selected rules and defaults

| Area | Default / supported options |
| --- | --- |
| Hong Kong opening | 3 dice, optional 2; fixed eight flowers and 18 stacks per wall |
| Hong Kong draw | Dealer repeat / 冧莊（連莊）; rotate option |
| Hong Kong scoring preferences | Minimum 3 fan, cap 13 or 10; half-la, full-la or explicit custom ron/tsumo amounts; stored for future scoring only |
| Hong Kong length | East/South/West/North four winds |
| Riichi length / points | Hanchan, optional Tonpuu; 25,000 each, customizable integer 1,000–1,000,000 |
| Riichi reds / opening | One red five per suit, configurable 0–4; fixed two dice and 17 stacks |
| Exhaustive draw | 3,000 total Noten transfer for 1–3 Tenpai; 0/4 Tenpai no transfer; dealer Tenpai repeats, otherwise rotates; Honba +1 either way |
| Riichi deposit | Exactly 1,000 per confirmed declaration; pool retained across draws |
| Four-Kan | Casual abortive rule enabled by default, configurable off; maximum four completed Kans either way; one-player four-Kan exception; no automatic 四槓子 award |

The casual profile is **not exact WRC 2025**: WRC 2025 has no abortive draws. Kan-Dora reveal timing must be checked against the physical table's rules; the guide describes initial geometry and correct Rinshan source only. Kazoe Yakuman and compound genuine Yakuman remain separate concepts; no universal 13+ Han award is claimed.

## 5. Storage compatibility

Database `mahjong-companion`, database version 1, store `settings`, key `table` and record schemaVersion 1 are unchanged. No database/store rename or replacement. Optional version-1 preferences and match data extend the existing record; actions/drafts keep their identities and old fields. Match snapshots, history and ledger are written in the same transaction as activeRoundId/setup changes.

Old player/setup/action/draft records still load. Existing Riichi declarations trigger explicit reconciliation rather than retroactive deductions. Unsupported outer/gameplay/match/preferences/setup versions and corrupt records fail closed; failed reads disable writes, so defaults do not overwrite unread data. Existing conservative setup-value recovery remains for malformed version-1 setup values. The theme localStorage key is only a non-gameplay pre-paint hint, with authoritative preference in IndexedDB. Reset archives matches rather than deleting actions/drafts.

## 6. Verification results

- `npm.cmd run build` — passed (TypeScript + Vite production bundle).
- `npm.cmd run lint` — passed.
- `npm.cmd test` — **156 tests passed across 13 files**.
- Regression coverage includes legacy records, future versions, serialized writes, modes, themes/system changes, resets/Cancel/Escape, Chi boundaries/source/red tiles, wall geometry across dealer orientations, settings isolation, frozen snapshots, all five Tenpai counts, dealer/wind transitions, Honba, deposit idempotency/reconciliation, result reload/undo, next-hand identity, all Kan forms, disabled abortive setting, fifth-Kan rejection, pending timing and win precedence.
- README local artwork/link existence checks pass. Cloudflare configuration has no diff: Worker `app`, existing account_id and assets/deployment configuration preserved.

## 7. Manual iPhone / desktop QA

**Not performed and not claimed passing.** Automated tests run in jsdom and do not render CSS or emulate Safari. No browser/computer automation tool is available in this session. Desktop CSS retains the 900px breakpoint, 590px cap, viewport-height flex root and safe auto margins, but this is source inspection rather than visual verification.

Pending manual checks: mobile widths 320/375/390/402/430px; iPhone Safari with browser bars and standalone mode; 1280×720 and 1440×900 desktop, plus 1920×1080/2560×1440/3840×2160 and short windows; equal selector dimensions and icon alignment; no horizontal overflow/overlap; light/dark contrast; large text/zoom; native dialog focus and keyboard/Escape; short-screen scrolling and safe areas. Content may naturally exceed a short viewport; no clipping or global scaling is used.

## 8. Known limitations / unresolved QA

No failing automated checks are known at this checkpoint. Visual/native-device behavior remains unverified. The app records user-confirmed physical conditions and cannot establish concealed tile availability, real Tenpai, legal Riichi, a legal win or exact physical fourth-Kan timing. Win scoring and settlement are intentionally incomplete. Different tabs still use last successful write, without merge/sync; clearing site data can remove local records. These limitations are disclosed in the UI and documentation. There is no claim that all possible defects have been excluded.

## 9. Exact proposed Git commit

Title:

```text
v1.0.0rc1 - Release Candidate 1 of Mahjong Buddy Friends Preview
```

Body:

```text
- Add a four-mode Mahjong selector with upcoming variants
- Introduce system-aware Light and Dark themes
- Simplify active gameplay controls and add safe reset confirmations
- Improve Chi selection with automatic illustrated sequence options
- Refine wall-opening guidance and Japanese dead-wall instructions
- Centralize Hong Kong and Japanese match settings
- Introduce persistent match, round and dealer progression
- Implement Hong Kong exhaustive draw dealer policies
- Add Japanese Tenpai/Noten payments, Honba and Riichi deposit accounting
- Preserve existing smart player actions and win-triggered Hand Builder
- Extend IndexedDB compatibility, automated tests and documentation
- Prepare Mahjong Buddy for initial friends testing and feedback
- Detect Japanese Four-Kan abortive draw conditions across multiple players
- Preserve the single-player Four-Kans Yakuman exception
- Add a safe Fourth-Kan confirmation and round-ending workflow
- Keep Japanese abortive draws separate from ordinary exhaustive draws
- Extend Riichi settings for the Four-Kan abortive draw rule
- Refine bilingual HK/Taiwan terminology in the public README
- Standardize Japanese Riichi, Han, Fu and Yakuman terminology
- Expand Kan, round progression and regression tests
```

No commit, push, history rewrite or deployment has been performed. Await manual review.
