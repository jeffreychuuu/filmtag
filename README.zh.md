# FilmTag

幫菲林掃描檔批次寫入 EXIF 嘅互動網頁工具——全部喺瀏覽器入面完成。

**[filmtag.jeffreychuuu.com](https://filmtag.jeffreychuuu.com)**

> 🇭🇰 :uk: [English README](README.md)

## 點解要用 FilmTag？

### 痛點

每次影完菲林，最煩唔係等沖掃——係拎返啲 JPG 之後，發現入面乜 EXIF 都冇。相機、鏡頭、ISO、拍攝日期，全部空白。對想好好整理底片作品嘅人嚟講，真係有啲崩潰。

### 解決方案

所以我索性自己寫咗個工具，可以幫沖掃後嘅 JPG 一次過加返 EXIF。全部喺瀏覽器入面完成，唔使裝任何嘢，唔使上傳去伺服器。

### 使用流程

1. 入網站選擇你嘅相機／鏡頭／菲林等資料
2. 揀返拍攝日期（可以每卷菲林設唔同日子）
3. 佢會自動幫每張相嘅時間由你揀嗰刻開始，每張加一分鐘
4. 上傳你嘅菲林掃描電子檔（JPEG、TIFF 等）
5. Download 返有完整 EXIF 嘅檔案，upload 去 Google Photos 就會自動排好順序

### 重點功能

| 功能 | 說明 |
|------|------|
| 📷 相機 & 鏡頭 | 內建 Leica MP、Olympus OM-2Sp 等，亦支援完全自訂相機型號、鏡頭焦距同最大光圈 |
| 🎞️ 底片 & ISO | 內建 23 款常見菲林（Kodak、Fujifilm、CineStill、Ilford 等），揀菲林會自動帶入 ISO |
| 🧪 沖掃紀錄 | 內建香港主流沖掃工作室：DOT-WELL、Megatoni、TrueFace Pro Lab 金鈿、Photo Garden 金藝、HK Camera、Showa、Colorluxe 彩圖麗——仲支援記錄 Push/Pull 同掃描器型號 |
| 🕐 時間排序（最正嗰個功能） | 每張相片自動遞增 1 分鐘，時區強制寫入 +08:00。一卷菲林跨唔同日子拍？可以分段設定日期同起始時間，Google Photos 就會完美排好順序 |
| 🌐 多語言 | 英文 & 繁體中文，透過浮動按鈕一鍵切換。所有介面文字均已翻譯 |
| 🗺️ GPS 拍攝位置 | 內建 Leaflet + OpenStreetMap 地圖。選擇檔案後搜尋地址或點擊地圖落針，GPS 坐標寫入 EXIF。逆向地理編碼顯示街道名稱喺每張檔旁邊 |

成品效果 👇

<table>
  <tr>
    <td align="center" width="25%"><b>Google Photos（網頁版）</b><br><img src="img/gphoto_web.png"></td>
    <td align="center" width="25%"><b>Google Photos（手機版）</b><br><img src="img/gphoto_mobile.png"></td>
    <td align="center" width="25%"><b>iPhone 相簿</b><br><img src="img/iphone.png"></td>
    <td align="center" width="25%"><b>Mac 相簿</b><br><img src="img/mac.jpg"></td>
  </tr>
</table>

## 功能

- 支援拖放上傳 JPEG/TIFF/DNG/PNG 相片
- 透過下拉選單設定相機、鏡頭、菲林、ISO、沖掃工作室、沖洗方式、Push/Pull、掃描器
- 支援多個日期分段，各自設定起始時間
- 處理前可預覽檔案重新命名摘要
- 寫入 EXIF 標籤：Make、Model、Artist、ISO、LensModel、DateTime、FocalLength、FNumber、Aperture、Shutter、UserComment、ImageDescription、Copyright、Instructions
- 寫入 XMP：Label、Creator、Credit、DateCreated、dc:description
- 批次下載為 ZIP，檔名標準化（`FilmName_YYYYMMDDHHMM_XX.jpg`）
- iOS：透過分享選單儲存至相簿
- 檔案縮圖預覽，點擊可放大睇原圖
- 多選檔案後點擊地圖批次設定 GPS 位置
- OpenStreetMap Nominatim 地名搜尋功能
- 可摺疊嘅起源與聲明區塊

## 新功能

**2026-06-12** — 分頁顯示 & 縮圖快取
- 📄 檔案列表分頁 — default 每頁 5 張，可選 5/10/25/50/全部；上下頁切換
- 📋 Review Summary 分頁 — 檔案表格同樣支援分頁
- ⚡ 縮圖快取 — thumbnail 首次 render 後 cache 做 data URL；切頁後即時顯示唔使重新 decode
- 🗺️ 「清除已選 GPS 位置」按鈕搬去搜尋列獨立一行，UX 更清晰

**2026-06-12** — 大量上傳效能翻新
- ⚡ 批次 `renderFileList()` — 而家等所有 EXIF 讀完先 render 一次，唔會每張相都 rebuild 成個 list
- ⚡ 快取 byte-to-string 轉換 — 每張相喺 EXIF 提取時只轉一次，zip/save 時重用，唔使 loop 幾千萬次
- 🖼️ 縮圖生成加 concurrency limit — 最多同時 decode 6 張，唔會因為太多相而 freeze 瀏覽器
- 💨 Blob URL 記憶體管理 — 所有 `createObjectURL` 用完即 revoke，杜絕 memory leak

**2026-06-12** — Google AdSense 整合
- 📢 加入 AdSense script 同 meta tag 以便放送廣告
- 📄 網站根目錄放置 `ads.txt` 供廣告網絡驗證
- 🔧 Build script 更新，自動複製 `ads.txt` 到 dist/

**2026-06-11** — 相機-鏡頭關聯同儲存修正
- 📸 自訂鏡頭而家按相機儲存——每部相機只會顯示屬於佢嘅鏡頭
- 💾 焦距同最大光圈會同鏡頭名稱一齊儲存
- 🐛 修正：相機揀自訂時鏡頭資料冇儲存到 localStorage
- 🐛 修正：揀已儲存嘅自訂相機唔再令頁面 crash
- 🐛 修正：已儲存嘅自訂相機會顯示之前嘅鏡頭選項，而唔係空白

**2026-06-11** — GPS + 多語言更新
- 🌐 英文 & 繁體中文（香港），浮動按鈕一鍵切換，所有介面已翻譯
- 🗺️ GPS 拍攝位置 — Leaflet + OpenStreetMap 地圖，搜尋地址或點擊落針，坐標寫入 EXIF
- 📍 逆向地理編碼 — 設定位置後顯示街道名稱於每張檔旁邊
- 🖼️ 檔案縮圖預覽，點擊放大睇原圖
- 🔄 多選檔案批次設定 GPS 位置

**2026-06-11** — 檔案設定 + 日期時間 + 摘要檢視翻新
- 📅 日期時間合併入檔案設定區域 — 揀選檔案後更改日期時間即時生效
- 🗓️ 上傳時自動抽取 EXIF 內原有日期；無日期則預設今日 12:00
- 📍 上傳時自動抽取 EXIF 內 GPS 坐標，同時逆向地理編碼獲取地址
- 🧹 清除日期 / 清除已選 GPS 位置按鈕
- 📋 摘要檢視新增 40×40 縮圖、位置欄、日期欄
- 🏷️「在相片描述中加入 FilmTag 署名」選項取代舊簽名設定

## 技術

- **piexifjs** — 瀏覽器端 EXIF 讀寫
- **JSZip** — 用戶端 ZIP 打包
- **esbuild** — 打包工具
- **Vercel** — 部署
- **Leaflet.js** — 互動地圖
- **OpenStreetMap + Nominatim** — 地圖圖磚、地理編碼／逆向地理編碼

## 本地開發

```bash
npm install
npm run build
npm run dev    # http://localhost:3333
```

## 部署

Push 上 GitHub → 喺 Vercel import → Root Directory = `.`（repo 根目錄）。Vercel 會自動執行 `npm run build`，serve `dist/`。

## 起源

起初只係寫咗個命令行工具俾自己同朋友用——我本身係菲林攝影入門者，咁啱又係做程式開發，純粹想有個方便嘅方法幫掃描檔加返相片資訊。後尾準備去旅行，驚沖掃舖喺旅行期間傳返啲掃描檔過嚟冇得整理，就索性整咗個網站出嚟，自己喺外地都處理得到。

## 聲明

呢個工具係免費分享俾菲林攝影愛好者嘅，絕不能用作商業用途或謀利用途，否則將追究法律責任。

---

© 2026 Jeffrey Chu. 版權所有，保留一切權利。

## 共用設定

`data.json` 定義所有下拉選單選項（相機、鏡頭、菲林、工作室、沖洗方式、Push/Pull、掃描器）。編輯呢個檔案就可以更新所有部署嘅選項。
