# Setup and wall-opening conventions

Verified on 1 November 2026 against the requested sources:

- [Hong Kong Mahjong — 流程](https://zh.wikipedia.org/wiki/香港麻雀#流程): 144 tiles with flowers, 18 double stacks per wall; modern two- or three-dice opening; counter-clockwise seats, clockwise wall counting/drawing; flower/kan replacements from the tail. The source also discusses 136-tile play without flowers. This release deliberately supports the requested **18-stack, with-flowers** configuration only.
- [WRC rules page](https://www.worldriichi.org/wrc-rules) → [WRC Rules 2025, v20250526](https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6834d67360e19c1da6c0d12c/1748293243651/WRC%2BRules%2B2025.pdf), §§6.2, 7.2–7.6 and 8: two dice; 17 double stacks per wall; owner-relative right-end counting; seven final stacks reserved; initial indicator on the upper tile of the third stack back from the break; East discards first and normal turns go East–South–West–North.
- [Riichi Wiki — Wall break / Japanese mahjong setup](https://riichi.wiki/Wall_break): corroborates the opening and dealing sequence. Direct access returned HTTP 403; the indexed page text was available through web search. WRC is the authority chosen for this release. No alternative two-roll procedure is implemented.

## Coordinates and calculations

Physical positions are screen positions, never fixed seat winds. From a bottom East, South is right, West top, North left. Players remain physically stationary. Manual/random initial dealer selection is an app convenience, not an implementation of WRC's tournament seating draw.

The clockwise wall traversal is `top → right → bottom → left → top`. Every wall's index 0 is the owner's right-hand end:

| Owner at | Owner's right end on screen | Increasing stack indices |
| --- | --- | --- |
| Top | Left end | Left → right |
| Right | Upper end | Top → bottom |
| Bottom | Right end | Right → left |
| Left | Lower end | Bottom → top |

Use the dealer as count 1 and advance in player order for each additional pip. With dice sum `n`, the selected wall's indices `0…n−1` are counted; the break follows index `n−1`. The first dealing stack is the next clockwise stack, wrapping around a corner if needed. In a global clockwise ring, call that stack `B`.

- HK: replacement draws begin at `B−1` and proceed backwards. The chosen default is modern draw-to-the-tail, without a fixed reserved dead wall. The guide identifies the two ends; it does not track live tiles or replacements as play proceeds. House rules for repeated flower replacement order must be agreed at the table; this app does not enforce them.
- Riichi: dead-wall stacks are `B−1…B−7`, with wraparound. Dora indicator = upper tile of `B−3`. Those seven stacks are excluded from ordinary dealing/drawing. They can occupy two physical wall sections; do not move stacks around a corner to make one separate seven-stack row. The diagram shows the initial arrangement, not evolving kan replacements or additional indicators.

The two-step guide presents the dice result and the wall diagram. The SVG and short screen-direction annotation show physical orientation; the numbered red marker is the break after the counted stack. Highlighted tiles are location markers, not generated tile identities. The rule calculations are unchanged.

## Randomness, state and limitations

Dice and random dealer selection use `crypto.getRandomValues`. Rejection sampling removes modulo bias for six-sided dice. A separate independent sample is taken per die. Tests inject uint32 values; production never substitutes `Math.random` if secure randomness fails.

The 450ms animation shows only abstract placeholders. The result is generated/finalized after it finishes. Reduced motion skips the delay. Beginning a reroll immediately clears saved dice and manual turns; refresh during a roll resumes at the ready-to-roll step. Finalized dice alone are stored; wall geometry is recalculated rather than duplicated in IndexedDB.

The version-1 database and record remain compatible with existing player records. An optional `setup` field has its own version 1. It stores the HK dice-count preference, dealer, phase, finalized dice and manual current player. Old records without it start at dealer selection. Invalid setup is discarded or rolled back to the last safe step while validated player records are retained. Variant changes and removing players reset setup; changing dealer or dice count clears dice and turns. Resetting setup retains all players.

Manual turn tracking never detects claims or physical tile actions. It assigns no fabricated tile counts, handles no scoring, does not rotate dealers after hands, and has no hand-history engine.
