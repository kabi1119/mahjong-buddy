# Mahjong Buddy v1.0.0rc2 — review notes

Focused UI polish on the RC1 baseline. npm SemVer: 1.0.0-rc.2; visible badge: v1.0.0rc2. No commit, push or deployment performed.

## Files changed

- package.json — RC2 package version.
- package-lock.json — matching root package versions; no dependency changes.
- src/App.tsx — original SVG sun/moon toggle artwork and natural mode-label content.
- src/App.css — remove mode-card color/background transitions that caused the delayed appearance.
- src/themes.css — compact toggle, component color tokens, knob movement, header spacing and centered card contents.
- tests/presentation.test.tsx — RC2 badge, switch structure/semantics/header position, uniform card classes and disabled subtitle assertions.
- docs/release-rc2.md — these review notes and manual QA checklist.

## What changed and why

The old switch was a filled 44px circle. The new visible pill is 42×24px with an 18px sliding knob, original sun/moon SVGs and subtle inset/knob shadows. Its transparent native button retains a 44×44px touch target. The version badge remains immediately to its right, with an 8px gap and no wrapping. Native switch semantics, accessible name, keyboard behavior and focus outline remain intact. Only the knob transform animates (160ms); the existing reduced-motion rule disables it.

Enabled mode labels previously contained two blank subtitle lines. Those lines gave the visible title an upward offset. The labels now contain only actual content; a centered flex group aligns each tile and text block within equal grid cells. The future-mode subtitles remain visible, and the mobile/desktop card heights remain 70px/76px. All four icons and content groups are vertically centered; the two future modes remain disabled.

The inherited 180ms background/text transition made the disabled cards visibly fade to their new theme after the rest of the shell updated. Removing that transition makes all card colors and inherited subtitles update together in the same paint. No asynchronous classes, timers or additional theme state were added. The system/light/dark hook, follow-system setting, pre-paint bootstrap, persistence identifiers and gameplay logic are unchanged.

## Visual trade-offs

- The visible switch is compact while its larger transparent hit area keeps it easy to tap. The header still accommodates a 44px interaction target.
- Mode colors switch instantly instead of fading, including during mode selection. This avoids staggered theme updates; the knob alone supplies motion.
- Enabled cards center their single-line titles while disabled cards center the complete title/subtitle block. No fake text or blank subtitle placeholders remain.

## Validation performed

- npm run build — passed (invoked with npm.cmd on Windows).
- npm run lint — passed.
- npm test — 156 tests passed across 13 files, including existing system-theme changes, persisted manual preference, follow-system restoration, mode switching and RC1 gameplay/storage regressions.
- Isolated local headless Chrome — passed in light and dark at widths 320, 375, 390, 402, 430 and 1280px. The desktop app measured 590px wide. No additional dependency was installed and the normal browser profile was not used.
- Browser geometry checks: equal card widths/heights, centered icons/content groups, text inside card padding, header alignment, version visibility and no horizontal document overflow.
- Browser timing checks: card backgrounds/text/borders and Coming soon subtitles were stable immediately after the theme change, at 60ms and at 240ms; no selector animations remained.
- Browser interaction checks: Space toggled the native switch; saved manual preference survived reload. Reduced-motion emulation disabled the knob transition.
- Screenshot inspection: both 375px themes and the dark 590px desktop application were reviewed.

These are Chrome checks and screenshot inspection, not real iPhone or Safari testing. Exact perceived animation smoothness and native mobile interactions still need the checks below.

## Manual QA checklist

1. Open the local app in a desktop browser. At 320, 375, 390, 402 and 430px responsive widths, and at a desktop viewport with a 590px app, inspect the header in both themes. Confirm logo/title, switch and badge remain on one row without clipping or crowding.
2. Confirm the pill is only slightly taller than the badge, its knob slides cleanly, and sun/moon are readable. Tab to the switch, check the focus ring and test Space/Enter. Enable reduced motion and confirm the knob stops animating.
3. Inspect all four cards: identical outer dimensions and padding, centered wind icons, balanced title blocks, no clipped Chinese/Coming soon text, and no upward-hanging enabled titles. Switch HK/Japanese modes and confirm the future modes stay unavailable.
4. Toggle themes repeatedly in both directions. Observe all four backgrounds, borders, titles and disabled subtitles changing together without a delayed fade or layout shift.
5. Reload after each explicit theme selection. Then choose 跟隨系統 in settings and change the OS theme; confirm system tracking returns. Restore the preferred test theme afterwards.
6. Repeat on an actual iPhone Safari and Add to Home Screen session if available, including narrow portrait width, short screens, larger text and touch targets. Real-device/Safari/standalone checks have not been performed for this patch.

## Suggested final commit

Title:

```text
v1.0.0rc2 - Polish theme switch and mode selector alignment
```

Body:

```text
- Redesign the Light/Dark theme switch with a more refined compact toggle style
- Reduce the switch size so it sits more naturally beside the version badge
- Improve header alignment between the theme switch and version display
- Fix vertical alignment of the active Hong Kong and Japanese mode cards
- Keep all four mode selector cards visually balanced and consistently sized
- Resolve delayed theme-transition updates on the disabled Coming Soon cards
- Preserve existing theme persistence, mode selection and gameplay functionality
- Validate responsive layout, build, lint and automated tests
```

Await manual review. HEAD remains the RC1 baseline until a separate commit is authorized.
