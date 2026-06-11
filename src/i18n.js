var lang = localStorage.getItem('filmtag-lang') || 'en';

var tpl = {};

function t(key, vars) {
  var s = tpl[lang] && tpl[lang][key] || tpl.en[key] || key;
  if (vars) {
    for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
  }
  return s;
}

function setLang(l) {
  lang = l;
  localStorage.setItem('filmtag-lang', l);
  applyTranslations();
}

function toggleLang() {
  setLang(lang === 'en' ? 'zh' : 'en');
}

function applyTranslations() {
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute('data-i18n');
    var vars = els[i].getAttribute('data-i18n-vars');
    els[i].textContent = t(key, vars ? JSON.parse(vars) : null);
  }
  var ph = document.querySelectorAll('[data-i18n-placeholder]');
  for (var j = 0; j < ph.length; j++) {
    ph[j].placeholder = t(ph[j].getAttribute('data-i18n-placeholder'));
  }
  var tb = document.getElementById('lang-float-btn');
  if (tb) tb.textContent = lang === 'en' ? '🇭🇰' : '🇺🇸';
}

window.toggleLang = toggleLang;

tpl.en = {
  // Header
  "origin": "Origin",
  "origin_text": "FilmTag started as a CLI tool for myself and a few friends \u2014 I'm a film photography beginner who happens to write code for a living, and I just wanted an easy way to tag my scans with proper metadata. Before a trip, I worried that a lab might send scans back while I was away, so I turned it into a web app I could use from anywhere.",
  "disclaimer": "Disclaimer",
  "disclaimer_text": "This tool is shared freely with the film photography community. Commercial use or profiteering is strictly prohibited. Unauthorised commercial use will be subject to legal action.",

  // Sections
  "file_setup": "File Setup",
  "upload_hint": "Click to select files, or drag & drop here",
  "upload_formats": "JPEG, TIFF, DNG, PNG (JPEG recommended \u2014 EXIF writes to JPEG only)",
  "author": "Author",
  "author_placeholder": "Enter custom author name",
  "camera_lens": "Camera & Lens",
  "camera": "Camera",
  "make": "Make",
  "model": "Model",
  "lens": "Lens",
  "lens_name": "Lens Name",
  "focal_length": "Focal Length (mm)",
  "max_aperture": "Max Aperture",
  "film_stock": "Film Stock & ISO",
  "film_name": "Film Stock Name",
  "iso": "ISO",
  "lab": "Lab",
  "lab_placeholder": "Enter custom lab name",
  "process": "Developing Process",
  "push_pull": "Push / Pull",
  "scanner": "Scanner",
  "scanner_placeholder": "Enter custom scanner name",
  "date_time": "Shooting Date & Time",
  "date_question": "Are all photos from the same date?",
  "date_yes": "Yes \u2014 all same date",
  "date_no": "No \u2014 multiple date segments",
  "shoot_date": "Shoot Date",
  "start_time": "Start Time (24h, first photo)",
  "add_segment": "+ Add Date Segment",
  "signature": "\u{1F60E} Signature",
  "signature_label": "Add \"FilmTag by Jeffrey Chu\" to EXIF metadata",
  "public_label": "Make it public (include \"FilmTag by Jeffrey Chu\" in description)",

  // Actions / Status
  "review_summary": "Review Summary",
  "reset_all": "Reset All",
  "close": "Close",
  "download_zip": "Download ZIP",
  "save_to_album": "Save to Album",
  "download_all_zip": "Download All as ZIP",

  // File list / Segments
  "other_free_text": "Other (free text)",
  "files_range": "Files {s} \u2013 {e}",
  "end_file_index": "End file index",
  "remove": "Remove",
  "total_uploaded": "Total: {n} file(s) uploaded",
  "file_count": "{n} file(s)",
  "clear_all": "Remove all photos",
  "unknown": "Unknown",

  // Validation
  "author_required": "Author is required",
  "lens_required": "Lens name is required",
  "film_required": "Film stock is required",
  "lab_required": "Lab is required",
  "scanner_required": "Scanner is required",
  "date_required": "Date is required",
  "date_error": "Date error",

  // Summary
  "settings": "Settings",
  "shutter": "Shutter",
  "files_header": "Files ({n})",
  "col_index": "#",
  "col_original": "Original",
  "col_new_name": "New Name",

  // Progress / Gallery
  "creating_zip": "Creating ZIP...",
  "done_processed": "Done! {n} file(s) processed.",
  "processed_success": "{n} file(s) processed successfully",
  "processing_of": "Processing {i} of {n}",
  "files_ready": "{n} file(s) ready",
  "save": "Save",

  // Map / GPS
  "gps_off": "Don't add GPS location",
  "gps_on": "Add GPS location to EXIF",
  "select_all": "Select All",
  "unselect_all": "Deselect All",
  "search_location": "Search location...",
  "search": "Search",
  "map_hint": "Select file(s) above, then click the map or search to set location",
  "clear_selected": "Clear Selected GPS",
  "clear_date": "Clear Date",

  "col_location": "Location",
  "col_date": "Date",
};

tpl.zh = {
  // Header / Disclaimer
  "origin": "起源",
  "origin_text": "起初只係寫咗個命令行工具俾自己同朋友用——我本身係菲林攝影入門者，咁啱又係做程式開發，純粹想有個方便嘅方法幫掃描檔加返相片資訊。後尾準備去旅行，驚沖掃舖喺旅行期間傳返啲掃描檔過嚟冇得整理，就索性整咗個網站出嚟，自己喺外地都處理得到。",
  "disclaimer": "聲明",
  "disclaimer_text": "呢個工具係免費分享俾菲林攝影愛好者嘅，絕不能用作商業用途或謀利用途，否則將追究法律責任。",

  // Sections
  "file_setup": "檔案設定",
  "upload_hint": "點擊選擇檔案，或拖拽到此處",
  "upload_formats": "JPEG、TIFF、DNG、PNG（建議使用 JPEG — EXIF 僅寫入 JPEG）",
  "author": "作者",
  "author_placeholder": "輸入自定義作者名稱",
  "camera_lens": "相機 & 鏡頭",
  "camera": "相機",
  "make": "製造商",
  "model": "型號",
  "lens": "鏡頭",
  "lens_name": "鏡頭名稱",
  "focal_length": "焦距 (mm)",
  "max_aperture": "最大光圈",
  "film_stock": "底片 & ISO",
  "film_name": "底片名稱",
  "iso": "ISO",
  "lab": "沖掃工作室",
  "lab_placeholder": "輸入自定義工作室名稱",
  "process": "沖洗方式",
  "push_pull": "推動 / 拉回",
  "scanner": "掃描器",
  "scanner_placeholder": "輸入自定義掃描器名稱",
  "date_time": "拍攝日期 & 時間",
  "date_question": "所有相片是否同一日期？",
  "date_yes": "是 — 全部同一日期",
  "date_no": "否 — 多個日期分段",
  "shoot_date": "拍攝日期",
  "start_time": "開始時間 (24小時, 第一張相)",
  "add_segment": "+ 新增日期分段",
  "signature": "😎 簽名",
  "signature_label": "於 EXIF 中加入「FilmTag by Jeffrey Chu」",
  "public_label": "公開顯示（在描述中包含「FilmTag by Jeffrey Chu」）",

  // Actions / Status
  "review_summary": "檢視摘要",
  "reset_all": "全部重設",
  "close": "關閉",
  "download_zip": "下載 ZIP",
  "save_to_album": "儲存至相簿",
  "download_all_zip": "下載全部 ZIP",

  // File list / Segments
  "other_free_text": "其他（自由輸入）",
  "files_range": "檔案 {s} – {e}",
  "end_file_index": "結束檔案編號",
  "remove": "移除",
  "total_uploaded": "已上傳：{n} 個檔案",
  "file_count": "{n} 個檔案",
  "clear_all": "移除全部相片",
  "unknown": "未知",

  // Validation
  "author_required": "請填寫作者",
  "lens_required": "請填寫鏡頭名稱",
  "film_required": "請填寫底片",
  "lab_required": "請填寫沖掃工作室",
  "scanner_required": "請填寫掃描器",
  "date_required": "請選擇日期",
  "date_error": "日期錯誤",

  // Summary
  "settings": "設定",
  "shutter": "快門",
  "files_header": "檔案（{n}）",
  "col_index": "#",
  "col_original": "原始檔名",
  "col_new_name": "新檔名",

  // Progress / Gallery
  "creating_zip": "正在建立 ZIP...",
  "done_processed": "完成！已處理 {n} 個檔案。",
  "processed_success": "已成功處理 {n} 個檔案",
  "processing_of": "正在處理 {i}/{n}",
  "files_ready": "已備妥 {n} 個檔案",
  "save": "儲存",

  // Map / GPS
  "gps_off": "不加入 GPS 位置",
  "gps_on": "加入 GPS 位置到 EXIF",
  "select_all": "全選",
  "unselect_all": "取消全選",
  "search_location": "搜尋位置...",
  "search": "搜尋",
  "map_hint": "選擇上方檔案，然後點擊地圖或搜尋以設定位置",
  "clear_selected": "清除已選 GPS 位置",
  "clear_date": "清除日期",

  "col_location": "位置",
  "col_date": "日期",
};

export { t, setLang, toggleLang, applyTranslations, lang };
