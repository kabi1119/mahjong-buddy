# Setup and wall-opening conventions

Verified on 1 November 2026 against the requested sources:

- [Hong Kong Mahjong — 流程](https://zh.wikipedia.org/wiki/香港麻雀#流程): 144 tiles with flowers, 18 double stacks per wall; modern two- or three-dice opening; counter-clockwise seats, clockwise wall counting/drawing; flower/kan replacements from the tail. The source also discusses 136-tile play without flowers. This release deliberately supports the requested **18-stack, with-flowers** configuration only.
- [WRC rules page](https://www.worldriichi.org/wrc-rules) → [WRC Rules 2025, v20250526](https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6834d67360e19c1da6c0d12c/1748293243651/WRC%2BRules%2B2025.pdf), §§6.2, 7.2–7.6 and 8: two dice; 17 double stacks per wall; owner-relative right-end counting; seven final stacks reserved; initial indicator on the upper tile of the third stack back from the break; East discards first and normal turns go East–South–West–North.
- [Riichi Wiki — Wall break / Japanese mahjong setup](https://riichi.wiki/Wall_break): corroborates the opening and dealing sequence. Direct access returned HTTP 403; the indexed page text was available through web search. WRC is the reference for wall geometry, not an exact description of the casual match profile. No alternative two-roll procedure is implemented.

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

The 450ms animation shows only abstract placeholders. The result is generated/finalized after it finishes. Reduced motion skips the delay. Beginning a preparation reroll immediately clears saved dice; refresh during a roll resumes at the ready-to-roll step. Finalized dice alone are stored; wall geometry is recalculated rather than duplicated in IndexedDB.

The version-1 database and record remain compatible with existing player records. An optional `setup` field has its own version 1. It stores the legacy HK dice-count preference, dealer, phase, finalized dice and deprecated current-player field. Central rule preferences and match snapshots are additive fields. Old records without it start at dealer selection. Invalid setup is discarded or rolled back to the last safe step while validated player records are retained. Variant changes and removing players reset setup; changing dealer or dice count clears dice and turns. The in-game confirmed reset retains profiles; the distinct pre-game confirmed clear removes profiles. Both preserve preferences, drafts and histories.

## RC1 match profile and progression

The app records confirmed physical outcomes, never simulates draws/discards. Deprecated stored turn fields remain readable for compatibility; visible turn controls are removed.

HK defaults: three dice (two optional), exhaustive-draw dealer repeat (rotate optional), minimum 3 fan, cap 13 (10 optional), half-la (full-la/custom optional). Explicit custom payout rows distinguish ron/tsumo; these preferences are for future scoring and do not transfer money. Fixed eight flowers, 18 stacks, four winds. Rotation advances kyoku and winds without moving physical players. Repeated hands keep the displayed hand but receive a new physical round ID.

Casual Riichi defaults: hanchan (tonpuu optional), 25,000 starting points (custom integer 1,000–1,000,000), one red five per suit (0–4 configurable), two dice, 17 stacks, maximum four completed Kans, 3,000-point Noten total. Dealer Tenpai repeats; otherwise the dealer rotates. Every exhaustive draw adds one Honba. With 0/4 Tenpai no transfer occurs; with 1/2/3 Tenpai the Noten players split −3,000 and Tenpai players split +3,000. Unanswered decisions are rejected; a confirmed Riichi cannot be labelled Noten without correcting its declaration. No automatic win scoring, winner payment or deposit award is implemented.

Riichi declarations debit 1,000 once into the table pool. Undo reverses the entry. Pool carries over draws. Legacy declarations start unreconciled: the user must enter actual current balances and pool, already including old sticks; the app does not silently charge historical declarations. Final scheduled hands require an explicit end/continue decision.

### Four-Kan abortive draw (四槓散了／四開槓)

Enabled by default in the Mahjong Buddy casual profile, **not an exact WRC 2025 implementation**. WRC 2025 recognizes no abortive draws, including Suukaikan. Disabling this house rule still forbids a fifth completed Kan.

Only active, completed Kans projected from the current physical round count: Ankan, Daiminkan and a Pon upgraded into Shouminkan each count once. Robbed/incomplete, undone, duplicate and old-round actions do not add Kans. Exactly four completed Kans by at least two players produces a persisted pending confirmation, never an automatic ending. Four by one player continues toward a possible 四槓子; no Yakuman is awarded by this app.

Confirm only after the fourth Kan's Rinshan replacement and subsequent discard, with no Tsumo/Ron. A robbed Added Kan retains its Pon and does not count as a completed fourth Kan. A reported win locks draw settlement pending correction or a future supported win settlement. The distinct four-kan-abortive-draw outcome keeps dealer/kyoku and pool, increases Honba once, makes no Tenpai/Noten transfer, archives events and creates a new physical hand ID. Undo restores the full previous cursor and balances.

### Replacement tiles and terminology

After a Kan, take one replacement from the Rinshan portion of the dead wall; the Dora indicator is not drawn. The dead wall remains 14 tiles by consuming the live-wall tail. Additional indicator reveal timing varies by profile and must be checked at the table; the guide shows the initial geometry only. Sanma remains disabled and reserves separate Nuki Kita and abortive-draw adapters.

Japanese terms use 榮和 (Ron), 自摸 (Tsumo), 和牌, 本場, 供託, 荒牌流局 and 途中流局. Future scoring must distinguish 累計役滿 (Kazoe, a rules-dependent Han limit) from 複合役滿 (multiple genuine Yakuman). No universal 13+ Han award or working Han/Fu/Yakuman engine is claimed.

Rules are frozen when a match begins. Global preferences cannot rewrite active snapshots. Draw finalization, archive, next round and ledger changes are saved together in the existing single IndexedDB record. The newest draw can be undone until the next round has actions or drafts.
