var lang = localStorage.getItem("filmtag-lang") || "en";

var tpl = {};

function t(key, vars) {
  var s = (tpl[lang] && tpl[lang][key]) || tpl.en[key] || key;
  if (vars) {
    for (var k in vars) s = s.replace("{" + k + "}", vars[k]);
  }
  return s;
}

function setLang(l) {
  lang = l;
  localStorage.setItem("filmtag-lang", l);
  applyTranslations();
}

function toggleLang() {
  setLang(lang === "en" ? "zh" : "en");
}

function applyTranslations() {
  var els = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute("data-i18n");
    var vars = els[i].getAttribute("data-i18n-vars");
    els[i].textContent = t(key, vars ? JSON.parse(vars) : null);
  }
  var ph = document.querySelectorAll("[data-i18n-placeholder]");
  for (var j = 0; j < ph.length; j++) {
    ph[j].placeholder = t(ph[j].getAttribute("data-i18n-placeholder"));
  }
  var tb = document.getElementById("lang-float-btn");
  if (tb) tb.textContent = lang === "en" ? "🇭🇰" : "🇺🇸";
}

window.toggleLang = toggleLang;

tpl.en = {
  // Header
  origin: "Origin",

  // Sections
  file_setup: "Film Setup",
  upload_hint: "Click to select photos, or drag & drop here",
  upload_formats: "JPEG only (.jpg / .jpeg)",
  artist: "Artist",
  artist_placeholder: "Enter custom artist name",
  camera_lens: "Camera & Lens",
  photo_gear: "Photos & Gear",
  metadata: "Metadata",
  metadata_locked: "Upload photos to unlock metadata options",
  camera: "Camera",
  make: "Make",
  model: "Model",
  lens: "Lens",
  lens_name: "Lens Name",
  focal_length: "Focal Length (mm)",
  max_aperture: "Max Aperture",
  film_stock: "Film Stock & ISO",
  film_name: "Film Stock Name",
  iso: "ISO",
  lab: "Lab",
  lab_placeholder: "Enter custom lab name",
  process: "Developing Process",
  push_pull: "Push / Pull",
  scanner: "Scanner",
  scanner_placeholder: "Enter custom scanner name",
  date_time: "Shooting Date & Time",
  shoot_date: "Shoot Date",
  start_time: "Start Time (24h, first photo)",
  signature: "😎 Signature",
  public_label: "Add FilmTag credit to photo description",

  // Actions / Status
  review_summary: "Review Summary",
  reset_all: "Reset All",
  manage_opts_title: "Custom Options",
  manage_opts_none:
    "No saved custom options yet. Use the free-text dropdown option to add your own camera, lens, film, lab, and more — they'll be saved here automatically.",
  hide: "Hide",
  show: "Show",
  default: "Default",
  custom: "Custom",
  reset_defaults: "Show all defaults",
  close: "Close",
  download_zip: "Download ZIP",
  save_to_album: "Save to Album",
  download_all_zip: "Download All as ZIP",

  // File list / Segments
  other_free_text: "Other (free text)",
  remove: "Remove",
  file_count: "{n} photo(s)",
  clear_all: "Remove all photos",
  upload_non_jpeg_warn:
    "{n} non-JPEG file(s) skipped. Only JPEG files are supported.",
  unknown: "Unknown",

  // Validation
  artist_required: "Artist is required",
  lens_required: "Lens name is required",
  lens_coverage: "Assign a lens to every photo (set a roll default, or override each batch)",
  film_required: "Film stock is required",
  lab_required: "Lab is required",
  scanner_required: "Scanner is required",

  // Summary
  settings: "Settings",
  shutter: "Shutter",
  files_header: "Photos ({n})",
  col_index: "#",
  col_original: "Original",
  col_new_name: "New Name",

  // Progress / Gallery
  creating_zip: "Creating ZIP...",
  done_processed: "Done! {n} photo(s) processed.",
  processed_success: "{n} photo(s) processed successfully",
  processing_of: "Processing {i} of {n}",
  files_ready: "{n} photo(s) ready",
  save: "Save",

  // Map / GPS
  gps_location: "GPS Location",
  select_all: "Select All",
  unselect_all: "Deselect All",
  search_location: "Search location...",
  search: "Search",
  clear_selected: "Clear",

  add_range: "+ Add Range",

  col_location: "Location",
  col_date: "Date",

  page_of: "Page {current} of {total}",
  all: "All",
  cancel: "Cancel",
  set_date_time: "Set Date & Time",
  set_gps: "Set GPS Location",
  set_lens: "Set Lens",
  lens_overlay_title: "Choose Lens",
  lens_apply: "Apply",
  lens_apply_to: "Will apply to {n} selected photo(s)",
  lens_apply_all_photos: "Will apply to all {n} photos",
  lens_unset_count: "{n} photo(s) have no lens",
  lens_change_confirm: "You have assigned {n} different lenses to this roll. Changing camera will require re-selecting a lens for every photo. Continue?",
  lens_change_title: "Change Camera",
  lens_change_continue: "Continue, change camera",
  col_lens: "Lens",
  lens_multiple_note: "This roll uses {n} lenses",

  extracting_exif: "Uploading {n} photos…",
  next_roll: "🎞️ Next Roll",
  edit_roll: "✏️ Edit This Roll",

  // Disclaimer acknowledgment
  disclaimer_title: "Before You Use This Tool",
  disclaimer_acknowledge:
    "This tool is built with the assistance of AI. If you are concerned about potential security risks or do not trust AI-assisted tools, please do not use this tool.",
  disclaimer_cb_ai:
    "I understand this tool was built with AI assistance and I accept the implications",
  disclaimer_cb_noncommercial:
    "I agree this tool is for non-commercial use only",
  disclaimer_agree: "I understand and agree to proceed",
  disclaimer_disagree: "I do not agree",

  // Feedback
  feedback_title: "Share Your Feedback",
  feedback_type: "Type",
  feedback_bug: "Bug Report",
  feedback_suggestion: "Suggestion",
  feedback_title_ph: "Title",
  feedback_desc_ph: "Describe your feedback...",
  feedback_email_ph: "Email (optional, for follow-up)",
  feedback_email_invalid: "Invalid email format",
  feedback_submit: "Submit",
  feedback_error: "Failed to submit feedback. Please try again.",

  // Contact Sheet
  content_sheet: "Include Content Sheet",
  content_sheet_hint: "* Content Sheet Included",
  content_sheet_download: "Download Content Sheet",
  content_sheet_generating: "Generating Content Sheet...",
  content_sheet_done: "Content Sheet ready",

  // Feedback success
  feedback_success_title: "Thank You!",
  feedback_success_msg: "Your feedback has been submitted successfully.",
  ok: "OK",
};

tpl.zh = {
  // Header / Disclaimer
  origin: "起源",
  origin_text:
    "起初只係寫咗個命令行工具俾自己同朋友用——我本身係菲林攝影入門者，咁啱又係做程式開發，純粹想有個方便嘅方法幫掃描檔加返相片資訊。後尾準備去旅行，驚沖掃舖喺旅行期間傳返啲掃描檔過嚟冇得整理，就索性整咗個網站出嚟，自己喺外地都處理得到。",
  disclaimer: "聲明",
  disclaimer_text:
    "呢個工具係免費分享俾菲林攝影愛好者嘅，絕不能用作商業用途或謀利用途，否則將追究法律責任。",

  // Sections
  file_setup: "菲林設定",
  upload_hint: "點擊選擇相片，或拖拽到此處",
  upload_formats: "只接受 JPEG (.jpg / .jpeg)",
  artist: "藝術家",
  artist_placeholder: "輸入自定義藝術家名稱",
  camera_lens: "相機 & 鏡頭",
  photo_gear: "相片 & 器材",
  metadata: "資料",
  metadata_locked: "上傳相片後即可使用資料選項",
  camera: "相機",
  make: "製造商",
  model: "型號",
  lens: "鏡頭",
  lens_name: "鏡頭名稱",
  focal_length: "焦距 (mm)",
  max_aperture: "最大光圈",
  film_stock: "菲林 & ISO",
  film_name: "菲林名稱",
  iso: "ISO",
  lab: "沖掃工作室",
  lab_placeholder: "輸入自定義工作室名稱",
  process: "沖洗方式",
  push_pull: "增感 / 減感",
  scanner: "掃描器",
  scanner_placeholder: "輸入自定義掃描器名稱",
  date_time: "拍攝日期 & 時間",
  shoot_date: "拍攝日期",
  start_time: "開始時間 (24小時, 第一張相)",
  signature: "😎 簽名",
  public_label: "在相片描述中加入 FilmTag 署名",

  // Actions / Status
  review_summary: "檢視摘要",
  reset_all: "全部重設",
  manage_opts_title: "自訂選項",
  manage_opts_none:
    "未有已儲存嘅自訂選項。用下拉選單嘅「其他（自由輸入）」選項加入你嘅相機、鏡頭、菲林、沖曬店等 — 佢哋會自動儲存喺呢度。",
  hide: "隱藏",
  show: "顯示",
  default: "預設",
  custom: "自訂",
  reset_defaults: "顯示所有預設",
  close: "關閉",
  download_zip: "下載 ZIP",
  save_to_album: "儲存至相簿",
  download_all_zip: "下載全部 ZIP",

  // File list / Segments
  other_free_text: "其他（自由輸入）",
  remove: "移除",
  file_count: "{n} 張相",
  clear_all: "移除全部相片",
  upload_non_jpeg_warn: "已略過 {n} 個非 JPEG 檔案。只支援 JPEG 格式。",
  unknown: "未知",

  // Validation
  artist_required: "請填寫藝術家",
  lens_required: "請填寫鏡頭名稱",
  lens_coverage: "請為每張相設定鏡頭（設定成卷預設，或逐批覆蓋）",
  film_required: "請填寫菲林",
  lab_required: "請填寫沖掃工作室",
  scanner_required: "請填寫掃描器",

  // Summary
  settings: "設定",
  shutter: "快門",
  files_header: "相片（{n}）",
  col_index: "#",
  col_original: "原始檔名",
  col_new_name: "新檔名",

  // Progress / Gallery
  creating_zip: "正在建立 ZIP...",
  done_processed: "完成！已處理 {n} 個檔案。",
  processed_success: "已成功處理 {n} 個檔案",
  processing_of: "正在處理 {i}/{n}",
  files_ready: "已備妥 {n} 張相",
  save: "儲存",

  // Map / GPS
  gps_location: "GPS 位置",
  select_all: "全選",
  unselect_all: "取消全選",
  search_location: "搜尋位置...",
  search: "搜尋",
  clear_selected: "清除",

  add_range: "+ 新增範圍",

  col_location: "位置",
  col_date: "日期",

  page_of: "第 {current} 頁，共 {total} 頁",
  all: "全部",
  cancel: "取消",
  set_date_time: "設定日期時間",
  set_gps: "設定 GPS 位置",
  set_lens: "設定鏡頭",
  lens_overlay_title: "揀鏡頭",
  lens_apply: "套用",
  lens_apply_to: "會套用喺 {n} 張已選相片",
  lens_apply_all_photos: "會套用喺全部 {n} 張相",
  lens_unset_count: "{n} 張相未設定鏡頭",
  lens_change_confirm: "你已經為呢卷揀咗 {n} 支唔同嘅鏡頭。換相機之後需要重新為每張相揀鏡頭，繼續嗎？",
  lens_change_title: "更換相機",
  lens_change_continue: "繼續，更換相機",
  col_lens: "鏡頭",
  lens_multiple_note: "呢卷用咗 {n} 支鏡頭",

  extracting_exif: "正在上傳 {n} 張相…",
  edit_roll: "✏️ 編輯此卷",
  next_roll: "🎞️ 下一卷菲林",

  // Disclaimer acknowledgment
  disclaimer_title: "使用前須知",
  disclaimer_acknowledge:
    "呢個工具係由 AI 輔助開發。如果你擔心潛在嘅安全風險或者唔信任 AI 協助製造嘅工具，請唔好使用呢個工具。",
  disclaimer_cb_ai: "我明白呢個工具由 AI 輔助開發，並接受相關風險",
  disclaimer_cb_noncommercial: "我同意呢個工具只供非商業用途使用",
  disclaimer_agree: "我明白並同意使用",
  disclaimer_disagree: "我不同意",

  // Feedback
  feedback_title: "分享你嘅意見",
  feedback_type: "類別",
  feedback_bug: "錯誤回報",
  feedback_suggestion: "功能建議",
  feedback_title_ph: "標題",
  feedback_desc_ph: "詳細描述你嘅意見…",
  feedback_email_ph: "電郵（選擇性，方便跟進）",
  feedback_email_invalid: "電郵格式不正確",
  feedback_submit: "提交",
  feedback_error: "提交失敗，請再試一次。",

  // Contact Sheet
  content_sheet: "包含索引樣片",
  content_sheet_hint: "* 已包含索引樣片",
  content_sheet_download: "下載索引樣片",
  content_sheet_generating: "正在生成索引樣片…",
  content_sheet_done: "索引樣片已準備好",

  // Feedback success
  feedback_success_title: "多謝你！",
  feedback_success_msg: "你嘅意見已成功提交。",
  ok: "好的",
};

export { t, setLang, toggleLang, applyTranslations, lang };
