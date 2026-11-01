<p align="center">
  <img src="docs/assets/brand-hero.svg" alt="麻雀小夥伴 Mahjong Buddy：原創一索小鳥、翠綠牌桌與東南風牌品牌插畫" width="100%" />
</p>

<h1 align="center">麻雀小夥伴 · Mahjong Buddy</h1>
<p align="center"><strong>實體牌局，有個好夥伴。</strong><br />
專注眼前的牌友，讓開局準備更輕鬆。<br />
<sub>A thoughtful companion for real, physical Mahjong games.</sub></p>

<p align="center"><a href="https://app.mahjong-buddy.workers.dev/"><strong>🀄 立即體驗 Mahjong Buddy →</strong></a><br />
<a href="https://github.com/kabi1119/mahjong-buddy">GitHub · kabi1119/mahjong-buddy</a></p>

<p align="center"><img src="docs/assets/tech-stack.svg" alt="React 19、TypeScript、Vite 8、IndexedDB、Cloudflare Workers" width="760" /></p>
<p align="center"><sub>上方為原創品牌插畫，並非應用程式截圖。公開體驗版已上線；本機修改須另行部署。</sub></p>

---

## 好牌，從齊人開枱開始

手機放在牌桌旁，設定四位牌友、揀莊、擲骰，再跟着俯視圖開門。**麻雀小夥伴協助真實麻雀牌局，不代替實體麻雀牌，也不會自動判斷牌局。**

深綠牌桌、奶油色牌面與一隻一索小鳥，陪你把注意力留給眼前的人。

| 一眼睇清牌枱 | 開局有條理 |
| :--- | :--- |
| **四人座位** · 暱稱與 16 款 emoji 頭像，四邊文字保持正向。 | **揀莊與門風** · 手動或隨機選莊，自動分配東南西北。 |
| **港日切換** · 香港麻雀與日本四人立直，保留同一組牌友。 | **輕巧擲骰** · 港式預設三骰／家規兩骰，立直使用兩骰。 |
| **視覺開門** · 兩步指引標示開門處、取牌方向與補牌／王牌端。 | **手動下一家** · 完成配牌後推進輪次，遇上碰槓可自行指定玩家。 |
| **本機記住設定** · 重新開啟同一瀏覽器及網址，可恢復有效設定。 | **手機優先** · 主畫面聚焦當前操作；次要控制收在「更多」。 |

## 兩種玩法，同一桌牌友

| 風牌 | 現已可用 | 開局設定 |
| :---: | :--- | :--- |
| <img src="public/icons/wind-east.svg" width="28" height="35" alt="東風牌" /> | **香港麻雀** | 有花 18 棟牌牆；三骰預設，可選兩骰家規。 |
| <img src="public/icons/wind-south.svg" width="28" height="35" alt="南風牌" /> | **日本麻雀 · 四人立直** | 17 棟牌牆、兩骰；標示七棟王牌與初始寶牌指示牌。 |

西風／北風圖示已預留給未來三麻／台灣麻將；**兩者目前均未開放**。風牌圖示代表模式，不是你的座位門風。

## 五步，準備好一場牌

1. **齊人** — 點選四個座位，加入暱稱和頭像。
2. **揀莊** — 點選玩家或隨機揀選，確認後分配門風。
3. **擲骰** — 產生獨立骰子點數；重擲會清除上一次開門結果。
4. **開門** — 看兩步指引，在實體牌牆配牌，再按「已完成配牌」。
5. **行牌** — 東家先打牌，再手動按「下一家」；需要時到「更多」指定玩家。

> 開門以**牌牆所屬玩家的右手端**開始數，不一定是畫面右邊。圖示處理四個方向與跨角；詳細規則及家規範圍見 [規則筆記](docs/rules.md)。

## 牌友資料，留在你的瀏覽器

**毋須登入，沒有雲端資料庫、分析追蹤或牌友資料上傳。** 暱稱、頭像、模式、莊家、骰子和開局進度透過 IndexedDB 保存在本機。Cloudflare 提供網頁檔案，仍會收到正常網頁存取請求。

資料按瀏覽器與網站來源分開：手機與電腦、localhost 與正式網址不會共享設定。清除網站資料或私隱瀏覽可能令資料消失。目前沒有雲端同步或備份；儲存失敗時，畫面會顯示提示。

## 正在成長，界線清楚

| 現在 | 計劃中 · 尚未可用 |
| :--- | :--- |
| 實體四人牌局準備、開門指引、手動輪次、本機儲存 | Hand Builder、香港／立直自動計分、牌局結算 |
| 香港麻雀、日本四人立直 | 日本三麻、台灣麻將 |
| 瀏覽器使用及 Apple 主畫面圖示 | JSON 備份匯出／匯入、完整離線 PWA 安裝與快取 |

不會偵測實體摸牌、棄牌、上碰槓、立直或食糊；不會自動輪莊。主畫面以常見手機單屏操作為目標，短畫面、較大文字或展開設定時仍可正常捲動。

## 在本機開枱 · Develop

```sh
npm install
npm run dev
```

```sh
npm run build
npm run lint
npm test
npm run preview
```

`v0.2.0b` 為畫面版本標籤；npm 使用有效 SemVer `0.2.0-b`。Windows PowerShell 若限制腳本執行，可使用 `npm.cmd`／`npx.cmd`。

<details>
<summary><strong>技術架構與測試範圍</strong></summary>

- **React + TypeScript + Vite**：沿用單一前端專案，桌面維持置中的 590px 手機式介面。
- **純函式規則層**：門風、骰子、牌牆幾何與狀態流程獨立於 React。
- **IndexedDB**：沿用原有資料庫與識別碼；啟動先讀取，不以預設值覆寫有效資料。
- **Vitest + React Testing Library + fake-indexeddb**：測試規則、流程、儲存、品牌與指引結構。
- **Cloudflare Workers Static Assets**：Worker `app` 提供 Vite 的 `dist/`，沒有後端 API。

自動測試採用 jsdom，不能代替 iPhone Safari、獨立顯示、鍵盤、縮放與原生對話框焦點測試。本次沒有真機或真實瀏覽器版面驗證，亦沒有製作產品畫面截圖。

完整開發、儲存行為與手動驗證清單：[開發筆記](docs/development.md)。

</details>

<details>
<summary><strong>測試與部署 · Cloudflare</strong></summary>

```sh
npm run build
npm run lint
npm test
npx wrangler deploy --dry-run
```

準備好發佈新的前端版本時：

```sh
npm install
npm run build
npx wrangler login
npx wrangler deploy
```

公開體驗站已部署於 **https://app.mahjong-buddy.workers.dev/**。上述部署指令會上傳建置後的前端；單純 GitHub push 不會自動部署，除非另外設定 CI/CD。主畫面圖示不代表離線快取已完成。

</details>

---

<p align="center"><img src="public/mahjong.svg" width="64" height="64" alt="原創一索小鳥標誌" /><br />
<strong>帶上手機，約埋牌友。</strong><br />
<a href="https://app.mahjong-buddy.workers.dev/">立即開枱 →</a> · <a href="https://github.com/kabi1119/mahjong-buddy">查看原始碼</a></p>
