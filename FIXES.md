# Instagram 下載器修復說明（1.18.5）

## 1.18.5 書籤不再被擠到下一行

1.18.4 把按鈕當成動作列的一個正常子元素，列一換行，書籤就掉到第二行中間。1.18.5 不再往那一列加佔位的節點。書籤按鈕前面只放一個寬高都是 0 的錨點，下載與開新分頁用絕對定位畫在書籤左邊、垂直置中。書籤的位置不該因此改變。放大貼文、Reels、私訊維持 1.18.3 的行為。

下面是先前版本的說明。

# Instagram 下載器修復說明（1.18.4）

## 1.18.4 首頁動作列又變成兩行

1.18.3 不再搬走書籤之後，按鈕被插進書籤外面那層很窄的盒子，寬度只夠一顆圖示，所以開新分頁和下載排在書籤上面。1.18.4 改插在真正的橫向動作列上、書籤外層盒子的前面（`inline-flex`、不換行、`margin-left: auto`），書籤留在原位。找不到那一列時，才用書籤的位置做固定定位，蓋在它左邊並垂直置中。不改原生節點。

下面是先前版本的說明。

# Instagram 下載器修復說明（1.18.3）

## 1.18.3 放大貼文、Reels、私訊

放大貼文的下載沒反應，是因為對話框在捕捉階段就把點擊吃掉，按鈕上的監聽器收不到。另外 1.18.1 會把書籤節點搬進我們的容器，React 會把那棵節點換掉，監聽器跟著不見。1.18.3 改在 `document` 的捕捉階段聽 `.custom-btn`，短碼改認網址上的 `/p/<code>/`、`/reel/<code>/`、`/reels/<code>/`，而且只插入自己的節點，不再搬走或改原生節點的樣式。

Reels 的按鈕浮在影片旁邊，是因為書籤圖示不在右側直排動作列，腳本卻把橫向集群插在那個圖示旁。左側通知氣泡也被「有數字的一排圖示」誤認成貼文。現在 `/reels/` 只在右側直排動作列底下加一組直向按鈕，每個 Reels 一組。導覽列、通知、沒有大圖的區塊都不再注入。

`/direct/` 會提早結束掃描，並清掉已注入的按鈕。私訊頁不再改 DOM，訊息列表就不會被觀察器弄壞。`/accounts/`、`/notifications` 同樣略過。

下面是先前版本的說明。

# Instagram 下載器修復說明（1.18.2）

## 1.18.2 首頁貼文照片下載失敗

根因：首頁輪播貼文（網址仍是 `/`，短碼在貼文裡的 `/p/` 連結）仍走舊的輪播索引。圓點 class `div._acnb` 已經不在了，程式直接丟出 `Cannot find the media index`，`postOnClicked` 把例外吃掉，所以按鈕沒有反應、也不會下載。就算沒進輪播分支，圖片選擇器還在找巢狀的 `article article ... img`，媒體 id 則去抓貼文 HTML 裡已經常常不存在的 `media_id`，API 還打會被 CORS 擋下的 `i.instagram.com`。CDN 圖片也不能靠 `<a download>` 存檔。

這版改為：從貼文裡的 `/p/` 或 `/reel/` 連結取出 shortcode，在本機換成 media id，再打 `www.instagram.com/api/v1/media/<id>/info/`。輪播用目前看得到的那張（`li` 或圓點顏色），`carousel_media` 取最寬的 `image_versions2` 或 `video_versions`。API 失敗時改抓可見 `<img>` 的 srcset 最大一張。檔案用 `GM_xmlhttpRequest` 取 blob 再存。失敗時 `console.debug` 會以 `[IGDL]` 開頭，按鈕會短暫紅框。

下面是先前版本的說明。

# Instagram 下載器修復說明（1.18.1）

## 1.18.1（同一支 PR，依已登入 Edge 的截圖再修）

1.18.0 把按鈕插進書籤的父節點。那個節點是右側窄欄（會換行或直向排），所以開新分頁與下載排成一列、書籤被擠到下一列。1.18.1 改到真正的橫向動作列上，用一個 `inline-flex`、`flex-wrap: nowrap` 的集群包住「開新分頁、下載、書籤」，不改書籤原容器的寬度。圖示固定畫成 24×24、`stroke-width: 2`、`currentColor`，按鈕用 `content-box`，避免內距把圖示壓小。

限時動態不再只看網址。首頁動態列點開的檢視器網址可能仍是 `/`。只要畫面上方有進度條、而且頂端有播放／更多按鈕，就當成故事檢視器。按鈕加在最右側「…」**後面**，同一橫列、不換行，這樣就不會被靜音鍵往左展開的音量滑桿蓋住，也不會壓到播放／暫停。`pushState`／`replaceState`／`popstate` 仍會重掃。

下面是 1.18.0 的說明。

# Instagram 下載器修復說明（1.18.0）

適用環境：Microsoft Edge + Tampermonkey（開發人員模式已開啟），2026 年 11 月的 Instagram 網頁。此檔說明這份 fork（`hfming225/Instagram_Download_Button`）相對上游 `y252328/Instagram_Download_Button` 1.17.21 修了什麼。

## 現象

在已登入的 Edge 上：

- 貼文可以下載，但兩個按鈕（新分頁：兩個重疊方塊；下載：箭頭）接在書籤右邊，線條粗細、尺寸、間距、垂直位置都和原生圖示不一樣。
- 目前動作列是左側「讚、留言、轉發、分享」並帶數字（例如 14.8K、111、116、469），書籤在右側。
- 限時動態與精選動態（highlights）完全沒有按鈕。

## 什麼壞了

對過上游未解 issue、近期 fork，以及 2026-11-14 抓下來的 `www.instagram.com` HTML / JS 套件後，對得上的原因如下。

### 貼文按鈕長得不對

舊程式用這條結構選擇器抓「最後一個 `role="button"`」，再把按鈕 `append` 進那個節點裡面：

`article *:not(li)>*>*>*>div:not([class])>div[role="button"]`

動作列改版之後，最後一顆仍是書籤，所以按鈕還會出現，但被塞進書籤按鈕內部、排在圖示後面。圖示本身來自另一套實心 SVG（`viewBox` 約 478×478 與 482×482），再硬縮成 24px，並加上 `margin-left` / `margin-top: 8px`。

同一份網頁套件裡，Instagram 自己的圖示是 `viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、`stroke-linecap/linejoin="round"`、`strokeWidth` 為 `"2"`（少數為 `"3"`）。桌面版 App ID 仍是 `936619743392459`（頁面裡的 `X-IG-App-ID` / `appId`）。

### 限時動態沒有按鈕

舊程式只認兩條寫死的播放／暫停 `path[d="..."]`。這兩條 path 在 2026-11-14 的首頁套件裡已經不存在，`setInterval` 每 500ms 掃一次也掃不到，所以 `custom-btn` 不會被加進去。

Instagram 是單頁應用。限時動態網址是 `/stories/<使用者>/<媒體 id>/`，精選是 `/stories/highlights/<id>/`。只靠計時器、又沒有在路由變化時重掃，header 晚一點才畫出來就會漏掉。

媒體網址也過時。影片常是 `blob:`（MSE），不能直接存。舊程式打 `https://i.instagram.com/api/v1/media/{id}/info/`，而且 App ID 只從 `body > script` 的一個正則去抓，抓不到就整段放棄。官方網頁套件（`PolarisInstapi`）現在是：

- 未登入：`GET https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=...`
- 已登入：`POST https://www.instagram.com/api/v1/feed/reels_media/`，body 為 `reel_ids=<JSON 陣列>`，可再帶 `media_id`
- 精選的 reel id 是 `highlight:<id>`（`getReelIdForHighlight`）

`www.instagram.com/api/...` 與頁面同源，已登入時會帶上 cookie。`i.instagram.com` 從頁面 `fetch` 常常被 CORS 擋下。

上游至今仍開著的相關 issue 包括：按鈕消失（#69、#39、#37）、獨立貼文／故事失效（#36、#58）、Firefox 下載 CORS（#53、#64）、腳本啟用後頁面不載入（#73，2025-05）。近期 fork 裡，`colonnellotong/instagram-download-button` 改了工具列與 `www.instagram.com` 的 info API，但圖示仍是舊的實心 SVG，故事也還沒改成 `reels_media`。

## 這次改了什麼

版本改為 **1.18.0**。檔名、設定常數、檔名模板、`Alt+I` / `Alt+K` / `Alt+J` / `Alt+L` 都還在。

- 貼文按鈕改成與原生圖示同一套筆畫：24×24、`stroke="currentColor"`、`stroke-width: 2`（若旁邊書籤 SVG 自己有 `stroke-width` 就沿用）、圓角線端、`fill="none"`。內距與高度抄書籤按鈕的計算樣式，`inline-flex` 垂直置中，插在書籤**前面**（順序：開新分頁、下載、書籤），不再塞進書籤裡面。
- 書籤辨識不依賴混淆 class。先看 `aria-label`／`<title>`（Save、Saved、儲存、已儲存、收藏…）和舊的書籤 polygon／path；若該則貼文對不上，再在 `article`／`main`／`dialog` 裡找「有數字的動作鈕」那一列，取最右側、沒有數字的圖示鈕。
- 注入改為 `MutationObserver`，並包住 `pushState`／`replaceState`／`popstate`。另外留 1 秒的計時器，避免 SPA 換頁當下 DOM 還沒動。
- `/stories/`（含 highlights）會在 header 的暫停、靜音、選單那一列插入按鈕。辨識用 `aria-label`（Pause、Play、Mute、Audio、暫停、播放、靜音、更多…），沒有標籤時改看 header 裡成組的圖示鈕，尺寸跟旁邊的圖示走（故事 header 若是 16px 就用 16px）。一直找不到控制列時，才在右上角放一條後備列，等到真的控制列出現再拿掉。
- 目前這則故事的網址：
  1. 網址裡有媒體 id 時，`GET /api/v1/media/<id>/info/`，header 帶 `X-IG-App-ID`（頁面上抓得到就用頁面的，否則 `936619743392459`）、`X-CSRFToken`（有 cookie 才帶）、`credentials: 'include'`。
  2. 否則（或 info 失敗）打 `reels_media`。已登入（有 `sessionid`）用 POST，`reel_ids` 為 JSON 陣列；未登入用 GET。精選 id 組成 `highlight:<id>`。使用者 id 從 `web_profile_info` 來。
  3. 多則內容用網址上的媒體 id 對 `pk`；對不到再用 header 進度條（第一個還沒跑滿的分段）。影片取 `video_versions` 裡最寬的一條，圖片取 `image_versions2.candidates` 最寬的一條，略過 `blob:`。
- 下載仍先用頁面的 `fetch`（貼文這條原本就能成功）。CDN 被 CORS 擋下時才改走 `GM_xmlhttpRequest`。
- `Alt+J`／`Alt+L` 仍會先點舊 class `_9zm0`／`_9zm2`；那些 class 已經不在了，所以另外用 Next／Go back／上一張／下一張這類 `aria-label`。

### Tampermonkey（MV3）標頭

| 標頭 | 值 |
| --- | --- |
| `@match` | `https://www.instagram.com/*` |
| `@grant` | `GM_xmlhttpRequest`、`unsafeWindow` |
| `@connect` | `www.instagram.com`、`i.instagram.com`、`*.instagram.com`、`*.cdninstagram.com`、`*.fbcdn.net` |
| `@updateURL` / `@downloadURL` | `https://raw.githubusercontent.com/hfming225/Instagram_Download_Button/master/instagram-dl.user.js` |

`unsafeWindow.fetch` 讓 API 與下載仍走 Instagram 頁面自己的 cookie。`@connect` 是 MV3 裡 `GM_xmlhttpRequest` 的白名單。更新網址指向這個 fork 的 raw 檔，不再指向 Greasy Fork，避免安裝被上游蓋掉。

`@namespace` 改成這個 fork。若 Tampermonkey 裡還留著 Greasy Fork 那份，請把它刪掉或停用後再裝這份，否則兩邊會各跑一次，或更新檢查仍去抓舊網址。

## Edge 安裝步驟

1. 打開 `edge://extensions`，確認左下角「開發人員模式」已開啟。
2. 從 Chrome 線上應用程式商店安裝 Tampermonkey，並在 Edge 允許它在無痕以外的一般視窗執行。
3. 點 Tampermonkey 圖示 → 管理面板。若已有「Instagram Download Button」且網址是 greasyfork.org，刪除或關閉它。
4. 新增腳本，把本 repo 的 `instagram-dl.user.js` 全部貼上並儲存。或在腳本已合併進 `master` 之後，用上面的 raw 網址安裝。
5. 打開腳本確認 `@version` 是 `1.18.1`，`@updateURL` 的主機是 `raw.githubusercontent.com/hfming225/...`。
6. 重新整理 Instagram。貼文動作列應在書籤左側出現兩個 24px 筆畫圖示；打開限時動態或精選動態，header 控制列應出現同樣的兩個按鈕。
7. 這份更新網址指到 **master**。Pull request 合併前，master 仍是舊檔，請先用本分支的檔案安裝，並先不要按 Tampermonkey 的「檢查更新」，以免被舊的 master 蓋回去。合併之後再讓它從 raw master 更新。

設定仍在檔案開頭的常數：`disableNewUrlFetchMethod`、`prefetchAndAttachLink`、`hoverToFetchAndAttachLink`、`postFilenameTemplate`、`storyFilenameTemplate`、`replaceJpegWithJpg`、`datetimeTemplate`。

## 測試

在沒有 Instagram 登入的情況下，用本機假頁面（動作列與故事 header 依目前套件的標籤與筆畫規格搭出來）加 Chrome headless 跑過腳本：

- 帶 Save 圖示與數字的動作列：開新分頁、下載依序排在書籤前面，不在書籤內部；SVG 為 24×24、`viewBox="0 0 24 24"`、`stroke="currentColor"`、`stroke-width="2"`、`fill="none"`。
- 只有數字、沒有 Save 標籤的第二則貼文：仍插在最右側圖示鈕前面。
- `/stories/someone/123456789/`：按鈕出現在 Pause 左側。點下載會 `GET /api/v1/media/123456789/info/`，並帶 `X-IG-App-ID: 936619743392459`，然後抓 `video_versions` 裡較寬的 mp4，而不是較小的預覽圖。
- `/stories/highlights/1789000/`：未登入時 `GET .../reels_media/?reel_ids=highlight:1789000`；有 `sessionid` 時改為 `POST`，body 為 `reel_ids=["highlight:1789000"]`。進度條停在第二段時，下載的是第二則的影片。
- header 只有未標籤的 16px 圖示時，按鈕仍會插入，並沿用 16px。

`node --check instagram-dl.user.js` 通過。

## 尚未在真實環境核對的部分

這台環境不能登入 Instagram，也看不到已登入才會畫出來的故事 viewer，所以下面幾項是用套件與假 DOM 推論，**沒有**在你的 Edge 帳號上點過：

- 真實動作列的 class、內距是否與書籤按鈕完全同一像素。筆畫規格來自 2026-11-14 的 `IGDSSVGIcon`（`strokeWidth: "2"`、`currentColor`），位置是「書籤前一個兄弟節點」。若書籤的 `aria-label` 與 path 又改了、而且該列也沒有數字，按鈕可能再次對不準。
- 真實故事／精選 header 的 DOM（暫停、靜音、選單是不是 `header` 裡的 `role="button"`）。對不上時會改走右上角後備列，按鈕仍應出現，但位置不是嵌在控制列裡。
- 已登入帳號呼叫 `media/.../info/` 與 `reels_media` 是否回 `video_versions`（地區、年齡或帳號狀態可能改回 `login_required` 或空的 `items`）。POST 的形狀與套件裡 `PolarisInstapi` 一致，回應本體沒有在真實 session 上看過。
- 進度條演算法是「header 裡第一排等寬分段、第一個還沒滿的那格」。假頁面選對了第二則；若 Instagram 把進度條畫在別的結構裡，精選可能一直抓到第一則。網址已經帶媒體 id 的一般限時動態不依賴進度條。
- 主頁動態、Reels 連續播放頁（`/reels/`）、私人帳號、已儲存的貼文。貼文下載路徑故意維持原本的 info API 與 DOM 後備，只改了按鈕外觀與插入點。
- CDN 檔案在 Edge 上若頁面 `fetch` 因 CORS 失敗，會改走 `GM_xmlhttpRequest`。這條後備沒有對真實 `cdninstagram.com`／`fbcdn.net` 檔案下過載。
- 大頭貼按鈕仍用舊的 `header section svg circle`，這次沒有登入個人檔頁面可核對。
