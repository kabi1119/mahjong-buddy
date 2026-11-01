# 動作記錄與 Win-triggered Hand Builder · v1.0.0

## 使用原則

平時不輸入暗牌，不追蹤所有摸打。配牌確認後點玩家，才出現上／吃、碰、槓、立直（日本限定）及食糊／和牌。副露選牌只問此組需要的牌種；Win action 才會進入完整 Hand Builder。主畫面不再提供手動輪次控制；實體摸打由牌友處理。

開啟食糊／和牌流程及儲存草稿不會改變點數。RC4 在完整核對後計算支援的番／役／符，經預覽及第二次確認才鎖定手牌；再明確確認結算才支付、輪莊及封存。

## 本機資料與版本

沿用 IndexedDB `mahjong-companion`、database version 1、object store `settings`、key `table`、外層 `schemaVersion: 1`。新增可選 `gameplay` 欄位，RC4 的 `version` 為 2，會讀取並在記憶中遷移有效舊版 version 1；未新增 object store，因此不升資料庫版本。

| 模型 | 關鍵資料 |
| --- | --- |
| `RoundContext` | UUID、模式、莊家、座位玩家快照、建立時間、active/archived |
| `PlayerAction` | 穩定 ID、roundId、playerId（此局座位）、建立順序、active/undone、更正版本、結構化動作內容 |
| `Meld` | 穩定 ID、模式所在 roundId、玩家、kind、base tile、實體牌、open/status、來源及原始 actionId |
| `RiichiDeclaration` | 玩家自行確認、未經程式合法性驗證；新宣告扣 1,000 點至供託，舊宣告須先對帳 |
| `HandDraft` | UUID、版本、原局及贏家、WinContext、暗牌、副露、獨立贏牌牌張、花牌、指示牌、赤五設定、draft/confirmed |
| `TileInstance` | 實體輸入 ID、34 種之一的 base type、獨立 red flag |
| `DoraIndicator` | 實際指示牌 TileInstance、dora/ura；實際寶牌由純函式換算 |

舊版沒有 gameplay 的記錄正常載入，不以預設值覆寫。完成配牌或舊牌局第一次打開動作選單時，才建立新局 ID。重擲、改莊、重設或模式改變會封存舊局；新局不會繼承舊碰牌的加槓資格。原有草稿永遠保留；切回相同模式、完成新局開局後，可由同一座位的食糊／和牌流程選擇舊局草稿。

儲存隊列與讀取保護沿用 `useSettings`。未知未來 gameplay 版本或損壞內容會令讀取失敗，顯示本次記憶模式警告並禁止覆寫原始資料。合法但與當前開局／模式不符的 active context 會在記憶中封存；其歷史和草稿仍保留。多分頁並無同步合併，仍以最後成功寫入為準。

## 碰、加槓與撤回

碰必須選一個已知 base tile，產生三張同牌的明刻。一般記錄不猜赤五組成；五牌副露的赤牌數量在重建時必須核對。

`getEligibleAddedKanMelds(playerId, roundId, melds, tile?)` 只回傳同玩家、同局、有效、尚未升級、三張已知相同牌的明碰。它只核對記錄，不能證明第四張實體牌存在。單一候選會標牌種；多候選必須選一組。沒有候選就沒有加槓按鈕。

確認第四張同牌後，`upgradePon` 保留同一 meld ID、原始碰快照、來源與牌種，並加入升級 action ID；實體三張變四張，但仍是一個邏輯組。撤回 upgrade action 會重播剩餘動作，還原同一組碰。撤回原碰後，其相依升級不會被套用；歷史會指出問題，不刪其他玩家記錄。更正若破壞後續依賴會被拒絕，須先撤回相依動作。

暗槓／大明槓亦須確認實體條件。槓的狀態可記為「已完成」或「未完成／被搶槓」。後者保留歷史但不建立完成槓、不增加可輸入的額外寶牌指示牌。加槓被搶時仍保留原碰。草稿中引用已撤回／更正的槓，完成確認前需核對／同步，不能讓舊快照重新產生槓寶牌。

## 立直與來源限制

立直只在日本模式出現。明副露記錄與有效立直不能並存；已立直後記錄暗槓須再次手動確認額外限制。程式不檢查聽牌是否改變、振聽或宣告時機。暗槓保留門前清；上／吃、碰、大明槓、加槓為明副露。

Smart Chi 在港式及日本都先選上家棄牌，圖像列出所有包含它的順子，確認另外兩張手牌及赤五組成。來源經實體行牌次序函式固定為上家；其他動作來源如知道可記錄，未知保留 null。這是記錄限制，不是實體棄牌偵測。

## Hand Builder 的檢查界線

- 暗牌不包含獨立的贏牌牌張；它只計算一次。
- 一般輸入確認要求 14 張邏輯牌；每槓增加一張實體牌，但仍按一個三張邏輯組計。14 張並不等於合法贏牌。
- 34 種 base tile 各最多四張，包含輸入的指示牌；赤五與普通五共用此上限。赤五在開局前牌局設定按各門設定 0–4 張；預設各門一張，本局凍結後 Hand Builder 唯讀，普通五相應剩三張。
- 香港八款花牌各一張，與一般暗牌分開。花糊不要求 14 張普通牌；RC4 檢查七／八款不同花牌及自摸，七花即食按 2＋1＝3 番計算。
- 日本模式不提供花牌；香港模式不提供赤五及寶牌。已記錄副露可同步、補完赤五、移除或在重建內新增。遺漏副露編輯及赤五更正會明確更新本局動作記錄，並保留更正版本；不暗中推測副露。
- 重建內加槓也必須升級該草稿中已知的同局同玩家碰，確認第四張牌，保留組 ID；不能建立沒有原碰的獨立加槓。
- 指示牌由使用者選擇實體牌山實際揭開的牌，不猜牌值。相同指示牌可重複，仍受四張實體牌上限。只有已完成的槓才提高額外指示牌範圍。
- 裏寶牌只對有已確認立直記錄、且重建仍門前清的贏家顯示。已揭寶牌／槓寶牌有幾個，鎖定前須輸入完全相同數量的實際裏寶牌。
- 寶牌與赤五是不同概念；RC4 分別計算加飜，但寶牌不能單獨建立役。

Riichi 的槓、門前清與指示牌邊界參考 [WRC Rules 2025](https://www.worldriichi.org/wrc-rules) §§8.7–8.9、8.11.1、8.13、11.4。赤五為本 App 可設定的家規，並非宣稱 WRC 預設使用赤五。搶槓／嶺上役須手動確認實況，再與已知動作及和牌方式核對；不追蹤搶槓宣告時機或完整摸棄牌合法性。

## 手動驗證清單

1. 由原有本機記錄開啟：確認暱稱、頭像、模式、骰子、莊家保留，舊輪次欄位只作兼容。
2. 配牌前點座位應編輯／選莊；配牌後點任何玩家應打開其姓名、頭像、門風的動作選單。選單中仍可編輯玩家。
3. 選碰五筒，取消：不應新增動作。再次確認後，只產生一組三張五筒；重新整理仍存在。
4. 無碰時槓選單只有暗槓／大明槓。有兩組碰時，加槓須選組並確認第四張；撤回加槓後原碰應還原。更正／撤回後重新整理再看。
5. 立直模式核對吃牌來源、立直確認與座位 badge；明碰後不能確認立直，撤回立直退回其一次供託扣點。
6. 食糊／和牌才開重建：確認贏家、自摸／港式出銃或日本榮和及來源、贏牌牌張。加入暗牌、各類副露、花牌／赤五，測試第五張及重複花牌被拒絕。
7. 輸入實際三萬指示牌應顯示四萬，九筒應顯示一筒；非立直贏家不顯示裏寶牌新增按鈕。被搶槓不可新增相應槓寶牌。
8. 選牌時自動儲存，等待成功狀態後重新整理並從相同贏家的食糊／和牌選單續填；關閉視窗不丟棄記憶中的草稿。重設／切換模式再回來，舊局草稿仍在。
9. 完成最後手牌預覽並鎖定：核對真實計分但未付款；再確認正式結算，只支付一次，封存舊局並準備新局。
10. 在 320、375、390、402、430px、iPhone Safari／獨立顯示及桌面測試各對話框的捲動、鍵盤焦點、Escape、取消和焦點回復。桌面應維持 590px 及有空間時垂直置中。

自動化使用 jsdom、fake-indexeddb，不能取代以上真實瀏覽器／真機驗證。此版本沒有提交、推送或部署操作。

確認並鎖定和牌輸入後標記待結算，避免被流局覆蓋；必須再確認付款才會支付及推進局數。單純開啟或儲存未完成草稿不會推進牌局。未鎖定的誤標可明確更正；已付款則須經有原因的審計撤銷，原快照保留。四槓散了以當前 roundId 的完成副露推導；詳細時機與本場／供託規則見 [規則筆記](rules.md)。

## RC4 final hand and settlement workflow

RC4 uses winner/method → simplified selected-hand/catalog builder → verified scoring/results. The final selected eligible concealed tile is proposed as the gold-highlighted winning tile; sorting preserves its ID and explicit reassignment does not rebuild the hand. All ordinary selected tiles are directly removable; flowers have a separate catalog and one-copy limit. A normal Pon and a Kan consume six logical slots but seven physical tiles, leaving eight logical selections.

Recorded current-round melds are imported automatically. The missing-meld panel edits the authoritative action history, preserving existing Pon/Added-Kan relationships and keeping correction/undo records. Japanese Menzen is derived, with Ankan still closed. Unknown red composition must be explicitly completed. The final meld IDs/types/sources/physical identities must match projected actions before lock.

Visible Dora now belongs to the round; private legacy draft inputs remain retained for review. Confirmed Riichi alone enables Ura input. A complete reliable hand first opens a review popup; only the second confirmation locks it irreversibly in the ordinary workflow. Lock is not payment. The results page requires a separate settlement confirmation, then archives the round and offers next-hand preparation. Saved drafts/opening the Win Flow never apply points. See [RC4 rules](rules.md#rc4-verified-scoring-profile) for precise profile choices and [development notes](development.md#rc4-scoring-implementation-and-migration) for schema version 2 and audited reversal.

正式版以兩次按鈕確認手牌及鎖定，不要求五項勾選，只有可選例外欄。首巡與其他支援情境使用選單。手牌計分與四家預覽分開；只有最後結算按鈕付款。詳細新舊規則及儲存邊界見 rules.md、development.md 的 v1.0.0 章節；上文 RC4 段落保留為歷史設計說明。
