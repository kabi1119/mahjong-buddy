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

## Match profile and progression

The app records confirmed physical outcomes, never simulates draws/discards. Deprecated stored turn fields remain readable for compatibility; visible turn controls are removed.

HK defaults: three dice (two optional), exhaustive-draw dealer repeat (rotate optional), minimum 3 fan, cap 13 (10 optional), half-la (full-la/custom optional). Explicit custom payout rows distinguish ron/tsumo; RC4 uses these preferences for verified single-winner settlement after explicit locking and payment confirmation. Fixed eight flowers, 18 stacks, four winds. Rotation advances kyoku and winds without moving physical players. Repeated hands keep the displayed hand but receive a new physical round ID.

Casual Riichi defaults: hanchan (tonpuu optional), 25,000 starting points (custom integer 1,000–1,000,000), one red five per suit (0–4 configurable), two dice, 17 stacks, maximum four completed Kans, 3,000-point Noten total. Dealer Tenpai repeats; otherwise the dealer rotates. Every exhaustive draw adds one Honba. With 0/4 Tenpai no transfer occurs; with 1/2/3 Tenpai the Noten players split −3,000 and Tenpai players split +3,000. Unanswered decisions are rejected; a confirmed Riichi cannot be labelled Noten without correcting its declaration. RC4 now also supports verified single-winner payments and deposit awards; unsupported exceptional payments remain blocked.

Riichi declarations debit 1,000 once into the table pool. Undo reverses the entry. Pool carries over draws. Legacy declarations start unreconciled: the user must enter actual current balances and pool, already including old sticks; the app does not silently charge historical declarations. Final scheduled hands require an explicit end/continue decision.

### Four-Kan abortive draw (四槓散了／四開槓)

Enabled by default in the Mahjong Buddy casual profile, **not an exact WRC 2025 implementation**. WRC 2025 recognizes no abortive draws, including Suukaikan. Disabling this house rule still forbids a fifth completed Kan.

Only active, completed Kans projected from the current physical round count: Ankan, Daiminkan and a Pon upgraded into Shouminkan each count once. Robbed/incomplete, undone, duplicate and old-round actions do not add Kans. Exactly four completed Kans by at least two players produces a persisted pending confirmation, never an automatic ending. Four by one player continues toward a possible 四槓子; no Yakuman is awarded by this app.

Confirm only after the fourth Kan's Rinshan replacement and subsequent discard, with no Tsumo/Ron. A robbed Added Kan retains its Pon and does not count as a completed fourth Kan. A reported win locks draw settlement pending correction or a future supported win settlement. The distinct four-kan-abortive-draw outcome keeps dealer/kyoku and pool, increases Honba once, makes no Tenpai/Noten transfer, archives events and creates a new physical hand ID. Undo restores the full previous cursor and balances.

### Replacement tiles and terminology

After a Kan, take one replacement from the Rinshan portion of the dead wall; the Dora indicator is not drawn. The dead wall remains 14 tiles by consuming the live-wall tail. Additional indicator reveal timing varies by profile and must be checked at the table; the guide shows the initial geometry only. Sanma remains disabled and reserves separate Nuki Kita and abortive-draw adapters.

Japanese terms use 榮和 (Ron), 自摸 (Tsumo), 和牌, 本場, 供託, 荒牌流局 and 途中流局. Scoring distinguishes 累計役滿 (Kazoe, a rules-dependent Han limit) from 複合役滿 (multiple genuine Yakuman). 13+ Han follows the selected Kazoe policy; the RC4 engine implements the supported Han/Fu/Yakuman catalog below.

Rules are frozen when a match begins. Global preferences cannot rewrite active snapshots. Draw finalization, archive, next round and ledger changes are saved together in the existing single IndexedDB record. The newest draw can be undone until the next round has actions or drafts.

## RC4 verified scoring profile

RC4 calculates only supported single-winner hands after explicit final review. It does not infer a real discard history, Furiten, HK 過水, declaration legality, Ippatsu, first-turn wins, or special draw timing. The user must confirm those untracked physical conditions. Menzen itself is derived from the final authoritative meld state; concealed Kan retains Japanese Menzen but follows the documented HK no-Kan Menzen convention.

### Sources and intentional house-rule choices

- The requested [HK orthodox hand list](https://zh.wikipedia.org/wiki/香港麻雀胡牌列表#正統牌型), including its exclusions and footnotes, defines the HK pattern baseline. On 1 November 2026 the user explicitly chose **坎坎糊 8 Fan plus compatible honor/flush bonuses**, without 門前清 or 對對糊. The orthodox no-Kan restriction applies; no Taiwanese scoring rules are imported.
- [WRC 2025, sections 11.2–11.5](https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6834d67360e19c1da6c0d12c/1748293243651/WRC%2BRules%2B2025.pdf) is the primary reference for standard Yaku, Fu, payment multipliers and hand interpretation. The app's selectable casual defaults intentionally differ from WRC; it does not advertise an exact WRC implementation.
- The [CUHK competition rules](https://home.culhk.org/files/ICUD/2016ICUD-Mahjong_Comp-Regulation.pdf) and [CityU competition rules](https://files.cityusu.hk/files/events/mj2023_rules.pdf) illustrate that HK pattern limits, flower treatment and table amounts vary. They are not silently imported as this app's payment table.

### HK patterns and exclusions

Supported: standard four groups plus pair, Thirteen Orphans, Pinhu, Menzen, self-draw, Dragon/seat/round triplet or Kan bonuses, no flowers, correct-seat flowers, full flower sets, all triplets, mixed/pure flush, mixed terminals/honors, Small/Big Three Dragons, Small/Big Four Winds, Kankan, all honors, all terminals, Nine Gates, Four Kans, and manually confirmed supported first-turn/robbing-Kan/last-tile/replacement circumstances. Seven Pairs is an optional non-orthodox three-Fan rule, disabled by default.

Exclusions are part of the calculation, not merely display labels:

- Kankan = 8 Fan by the confirmed default; compatible individual honor and one-suit bonuses may combine. No Menzen or all-triplets Fan is added. A Kan-containing hand can remain valid but does not receive orthodox Kankan or HK Menzen.
- Mixed terminals/honors = 4 Fan already includes its all-triplets value; it does not add another 3 Fan. Optional Seven Pairs is not treated as an all-triplets hand.
- Small Three Dragons = 5 already includes two Dragon triplets; Big Three Dragons = 8 already includes three. Do not add those Dragon Fan twice.
- Small Four Winds = 6 already includes its forced mixed-flush aspect; only compatible wind triplets and all-triplets bonuses add, without another mixed flush.
- Full flower set = 2 replaces the matching correct-seat flower within that set; a correct flower from the other set remains separate. No flowers = 1.
- Fixed-limit hands suppress ordinary additive bonuses: all honors/all terminals/Nine Gates use 10; Thirteen Orphans, Big Four Winds, Four Kans and supported first-turn limit hands use 13 before the selected cap.
- Seven distinct flowers with confirmed self-draw = 2 + 1 = 3 Fan, without an ordinary 14-tile requirement. Eight-flower instant win uses 8 Fan. Composite flower-instant plus first-turn/Kan/last-tile house rules are not configured and are blocked, rather than receiving a guessed extra award.

The configured minimum applies, and effective Fan is capped at 10 or 13. HK normal balances are cumulative net amounts starting at zero, not fabricated starting cash. Dealer status has no payment multiplier in this profile.

### HK money/point units

New v1.0.0 matches use the selected default integer base of 1 (editable before play); legacy frozen matches with a missing value require explicit completion. The following share conventions and integer definitions apply. Defaults for share multipliers are Ron one discarder pays 2 shares; Tsumo each opponent pays 1 share. These are visible configurable payment conventions, not an assertion that all HK tables use the same denomination. Use the table's chosen integer denomination (for example points or smallest currency units) consistently.

Full-la multiplier = 2^Fan. Half-la uses 1/2/4/8/16 at Fan 0–4, then 24/32/48/64/96/128/192/256/384 through Fan 13. Multiply this by the explicit unit, then by the corresponding shares. A custom row's Ron is the one discarder’s complete payment; its Tsumo is each non-winning player's payment. No extra multiplier is applied to a custom row. All actual transfers must be safe integers; the four HK deltas sum to zero. Missing units/rows or fractional final amounts block settlement. Legacy fractional preferences stay readable for review, not silently rounded.

### Riichi calculation

Enumerate all standard decompositions and every eligible concealed winning-tile interpretation, plus Seven Pairs and Thirteen Orphans. Exposed fixed meld tiles cannot become the winning tile. Select the highest payable base-point result; Han/Fu are tie-breakers only. A Ron-completed triplet is open for Fu and Sanankou/Suuankou evaluation, while the overall closed hand still qualifies for closed Ron and closed-only Yaku.

The implemented standard catalog includes Riichi, Double Riichi, Ippatsu, Menzen Tsumo, Pinfu, Tanyao, Iipeikou, Yakuhai, Chankan, Rinshan, Haitei/Houtei, Chiitoitsu, Ittsu, Sanshoku Doujun/Doukou, Toitoi, Sanankou, Sankantsu, Chanta, Junchan, Honroutou, Shousangen, Honitsu, Chinitsu and Ryanpeikou. Apply open reductions, non-bonus Yaku requirements and exclusions. Yakuman include Kokushi, Suuankou, Daisangen, Shousuushii, Daisuushii, Suukantsu, Tsuuiisou, Chinroutou, Ryuuiisou, Chuuren, Tenhou and Chiihou. Situational awards require manual evidence plus consistency checks against known actions; known calls after Riichi invalidate Ippatsu.

Fu: base 20; closed Ron +10; ordinary Tsumo +2; qualifying pair +2 or configured double-wind +2/+4; closed/open simple triplets 4/2 and terminal/honor triplets 8/4; closed/open simple Kans 16/8 and terminal/honor Kans 32/16; Kanchan/Penchan/Tanki +2. Round upward to 10. Exceptions: Seven Pairs 25; Pinfu Tsumo 20; closed Pinfu Ron 30; open Ron no-Fu minimum 30. Display each contribution.

Base = Fu × 2^(Han+2), capped as appropriate: Mangan 2,000; Haneman 3,000; Baiman 4,000; Sanbaiman 6,000; Yakuman 8,000 per applicable genuine multiple. Ron pays rounded-up-to-100 base ×6 for dealer or ×4 for non-dealer; Tsumo pays base ×2 from each opponent for dealer, or ×2 from dealer and ×1 from others for non-dealer. Honba adds 300 to Ron or 100 from each Tsumo payer. The existing deposit pool is awarded once, with no second declaration debit. Player deltas plus pool delta must sum to zero.

RC4/RC5 defaults retained by historical frozen matches: Kiriage off; Kazoe Yakuman for 13+ Han; double-Yakuman variants off; genuine Yakuman stacking on; open Tanyao on; double-wind pair 4 Fu. Optional doubles apply to thirteen-sided Kokushi, Suuankou Tanki, Daisuushii and pure Nine Gates. Disabling stacking keeps the highest individual applicable Yakuman value. Kazoe is never added as another genuine Yakuman condition. WRC conventions differ, including Kiriage, counted limits and double-wind pairs; choose rules explicitly.

### RC5 Kazoe policies

The default and existing saved policy values are unchanged. Select one before starting a new match; active-match snapshots remain frozen.

| Policy | 13+ Han base points |
| --- | --- |
| 單倍累計役滿（預設）, saved as yakuman | 8,000, including 26+ Han |
| 三倍滿封頂, saved as sanbaiman | 6,000 |
| 無封頂累計役滿, saved as uncapped | floor(Han / 13) × 8,000 |

Uncapped Kazoe is an optional house rule, not universal Riichi practice. Its ranges are 13–25 = 1×, 26–38 = 2×, 39–51 = 3×, 52–64 = 4×, continuing without an arbitrary scoring ceiling. A genuine non-Dora Yaku is still required. Genuine Yakuman are evaluated independently and never added to counted multiples.

Counted results show 累計役滿／累計雙倍役滿／累計三倍役滿／累計四倍役滿, numeric multiples above four, and actual Han. Detailed Yaku, bonus and Fu breakdowns remain available. The existing genuine 1×/2×/3×/4×+ effects are reused; only visual intensity saturates at tier 8. Scoring uses base points rather than animation text. Existing dealer/Ron/Tsumo multipliers, Honba and deposit awards are unchanged; replay never pays. IndexedDB identifiers and storage schemas are unchanged, and legacy preferences/locked snapshots remain readable.

### Shared indicators and timing

New Riichi hands remain in preparation until the first actual revealed indicator is confirmed. Dora advances suit ranks cyclically, winds East/South/West/North, dragons White/Green/Red. Initial and Kan indicators belong to the physical round, not a winner. Duplicate positions are disallowed; repeated tile values at different physical positions are valid and each contributes its bonus.

Default reveal profile: Ankan immediately, Daiminkan/Added Kan after a discard; an all-immediate option is provided. A completed authoritative Kan creates one pending position, never a guessed tile. The user selects revealed/input, not yet revealed, or record later. Incomplete/robbed/undone/old-round Kans do not add positions. Unknown/deferred state blocks scoring; a mandatory immediate indicator must be effective. Explicitly unrevealed delayed positions do not contribute. Ura is entered only for a confirmed Riichi winner and must have exactly one physical tile for each effective visible position. Red fives share the four-copy limit and use the frozen supply.

### Lock, payment and reversals

A complete reliable result enables final preview. A second explicit confirmation locks the hand, conditions, rules, indicators and scoring snapshot. Locking never pays. The locked round's actions/draft/indicators cannot ordinarily be edited. Settlement requires a separate confirmation and revalidates the fingerprint and exact score, then records one win ledger entry and outcome, awards the pool, archives the old ID and creates a new hand. Dealer win repeats; Japanese dealer also adds one Honba; non-dealer advances and clears Honba. Existing draw flows remain separate and cannot overwrite a locked win.

Exceptional correction uses a reasoned audited reversal of the newest win, only before the next hand has actions or drafts. Restore pre-win balances/pool/setup/dealer, mark the win transaction reversed and retain the original locked snapshot. Animation/replay never calls settlement.

Unsupported: multiple Ron, split-discard/Responsibility/Pao payments, Renhou and unlisted local Yaku, penalties, Uma/placement settlement, Tobi/automatic bankruptcy ending, flower-instant combinations and fractional transfers. Known potentially liable open Dragon/Wind/Four-Kan or HK twelve-exposed Tsumo cases are conservatively blocked. Physically untracked legality must be manually confirmed; no app can infer the missing discard history from the winning hand alone.

## v1.0.0 正式版規則與相容範圍

新港式牌局凍結 `firstTurn: v1`：天糊為莊家配牌後立即自摸，地糊為無先前上／碰／槓的閒家第一摸，人糊為閒家食莊家第一張棄牌（須開局前啟用，預設關閉）。三者皆為 13 番例牌，再受 10／13 番封頂限制。贏牌方式下方以「否／是」欄明確選擇首巡情境；未知完整實體歷史仍由使用者確認，已知矛盾動作、錯誤方式／莊閒／出銃來源會被拒絕。

舊 RC5 凍結規則沒有此標記，仍按舊地糊＝食莊家第一棄、人糊＝閒家首摸處理。舊鎖定及已結算快照、番數、付款不會重新標示或重算。

新港式牌局預設零番一份底額 **1**，半辣／辣辣及出銃／自摸份數均使用凍結設定，自訂表仍獨立。這是牌桌選定的單位，不假定貨幣。原有明確金額保留；舊未結算牌局缺值時，須在摘要明確補設一次，已鎖定牌局不准改值。歷史付款原封保留。

新日本四麻預設啟用真正雙倍役滿，可在開局前關閉：大四喜、純正九蓮寶燈、國士無雙十三面待ち、四暗刻單騎為兩倍；小四喜、普通九蓮、普通國士、非單騎四暗刻為單倍。根據實際和牌張與和牌前牌形辨別；結果顯示相應名稱。天和／地和為單倍真正役滿，可按原有複合規則與其他真正役滿結合。舊局的雙倍開關和舊名稱不改。累計役滿的三個政策維持 RC5 行為，絕不與真正役滿相加。

新手牌流程以 `workflow: 2` 表達普通食糊／和牌，不再要求舊的五個勾選。只有一個可選例外欄；選取後阻止普通自動結算。這不代表程式能驗證未記錄的過水、振聽或實體摸打。所有確定性牌型、副本、指示牌、已知責任支付及來源限制照常檢查。首巡、搶槓、槓上、海底等正常支援情境用獨立欄選擇，不當成不支援例外。

先預覽並鎖定手牌，再進入手牌／計分畫面。按「下一步：查看四家結算」只切換至獨立四家預覽，約 1.7 秒數字動畫亦不付款。只有「確認結算並結束本局」提交帳本；返回、重播、重新整理、重開舊結果都不能重複支付。本場、供託、冧莊、下一局與審計撤銷沿用原有帳本規則。
