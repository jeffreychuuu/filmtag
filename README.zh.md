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

成品效果 👇

**Google Photos（網頁版）**
![Google Photos Web](img/gphoto_web.png)

**Google Photos（手機版）**
![Google Photos Mobile](img/gphoto_mobile.png)

**iPhone 相簿**
![iPhone Photos](img/iphone.png)

**Mac 相簿**
![Mac Photos](img/mac.jpg)

## 功能

- 支援拖放上傳 JPEG/TIFF/DNG/PNG 相片
- 透過下拉選單設定相機、鏡頭、菲林、ISO、沖掃工作室、沖洗方式、Push/Pull、掃描器
- 支援多個日期分段，各自設定起始時間
- 處理前可預覽檔案重新命名摘要
- 寫入 EXIF 標籤：Make、Model、Artist、ISO、LensModel、DateTime、FocalLength、FNumber、Aperture、Shutter、UserComment、ImageDescription、Copyright、Instructions
- 寫入 XMP：Label、Creator、Credit、DateCreated、dc:description
- 批次下載為 ZIP，檔名標準化（`FilmName_YYYYMMDDHHMM_XX.jpg`）
- iOS：透過分享選單儲存至相簿

## 技術

- **piexifjs** — 瀏覽器端 EXIF 讀寫
- **JSZip** — 用戶端 ZIP 打包
- **esbuild** — 打包工具
- **Vercel** — 部署

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
