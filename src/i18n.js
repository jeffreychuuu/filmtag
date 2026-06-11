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
  if (tb) tb.textContent = lang === 'en' ? '中文' : 'EN';
}

window.toggleLang = toggleLang;

tpl.en = {
  // Header
  "origin": "Origin",
  "origin_text": "FilmTag started as a CLI tool for myself and a few friends \u2014 I'm a film photography beginner who happens to write code for a living, and I just wanted an easy way to tag my scans with proper metadata. Before a trip, I worried that a lab might send scans back while I was away, so I turned it into a web app I could use from anywhere.",
  "disclaimer": "Disclaimer",
  "disclaimer_text": "This tool is shared freely with the film photography community. Commercial use or profiteering is strictly prohibited. Unauthorised commercial use will be subject to legal action.",

  // Sections
  "upload_photos": "Upload Photos",
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
  "date_time": "Date & Time",
  "date_question": "Are all photos from the same date?",
  "date_yes": "Yes \u2014 all same date",
  "date_no": "No \u2014 multiple date segments",
  "shoot_date": "Shoot Date",
  "start_time": "Start Time (24h)",
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
  "clear_all": "Clear All",
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
  "save": "Save"
};

tpl.zh = {
  // Header / Disclaimer
  "origin": "\u8d77\u6e90",
  "origin_text": "\u8d77\u521d\u53ea\u4fc2\u5beb\u4f86\u500b\u547d\u4ee4\u884c\u5de5\u5177\u4ffe\u81ea\u5df1\u540c\u670b\u53cb\u7528\u2014\u2014\u6211\u672c\u8eab\u4fc2\u83f2\u6797\u651d\u5f71\u5165\u9580\u8005\uff0c\u5481\u5605\u53c8\u4fc2\u505a\u7a0b\u5f0f\u958b\u767c\uff0c\u7d14\u7cb9\u60f3\u6709\u500b\u65b9\u4fbf\u5605\u65b9\u6cd5\u5e6b\u6383\u63cf\u6a94\u52a0\u8fd4\u76f8\u7247\u8cc7\u8a0a\u3002\u5f8c\u5c3e\u6e96\u5099\u53bb\u65c5\u884c\uff0c\u9a5a\u6c96\u6383\u821e\u559e\u65c5\u884c\u671f\u9593\u50b3\u8fd4\u5657\u6383\u63cf\u6a94\u904e\u565e\u5481\u5f97\u6574\u7406\uff0c\u5c31\u7d22\u6027\u6574\u4f86\u500b\u7db2\u7ad9\u51fa\u565e\uff0c\u81ea\u5df1\u559e\u5916\u5730\u90fd\u8655\u7406\u5f97\u5230\u3002",
  "disclaimer": "\u8072\u660e",
  "disclaimer_text": "\u5462\u500b\u5de5\u5177\u4fc2\u514d\u8cbb\u5206\u4eab\u4ffe\u83f2\u6797\u651d\u5f71\u611b\u597d\u8005\u5605\uff0c\u7d55\u4e0d\u80fd\u7528\u4f5c\u5546\u696d\u7528\u9014\u6216\u8b00\u5229\u7528\u9014\uff0c\u5426\u5247\u5c07\u8ffd\u7a76\u6cd5\u5f8b\u8cac\u4efb\u3002",

  // Sections
  "upload_photos": "\u4e0a\u50b3\u76f8\u7247",
  "upload_hint": "\u9ede\u64ca\u9078\u64c7\u6a94\u6848\uff0c\u6216\u62d6\u62fd\u5230\u6b64\u8655",
  "upload_formats": "JPEG\u3001TIFF\u3001DNG\u3001PNG\uff08\u5efa\u8b70\u4f7f\u7528 JPEG \u2014 EXIF \u50c5\u5beb\u5165 JPEG\uff09",
  "author": "\u4f5c\u8005",
  "author_placeholder": "\u8f38\u5165\u81ea\u5b9a\u7fa9\u4f5c\u8005\u540d\u7a31",
  "camera_lens": "\u76f8\u6a5f & \u93e1\u982d",
  "camera": "\u76f8\u6a5f",
  "make": "\u88fd\u9020\u5546",
  "model": "\u578b\u865f",
  "lens": "\u93e1\u982d",
  "lens_name": "\u93e1\u982d\u540d\u7a31",
  "focal_length": "\u7126\u8ddd (mm)",
  "max_aperture": "\u6700\u5927\u5149\u5708",
  "film_stock": "\u5e95\u7247 & ISO",
  "film_name": "\u5e95\u7247\u540d\u7a31",
  "iso": "ISO",
  "lab": "\u6c96\u6383\u5de5\u4f5c\u5ba4",
  "lab_placeholder": "\u8f38\u5165\u81ea\u5b9a\u7fa9\u5de5\u4f5c\u5ba4\u540d\u7a31",
  "process": "\u6c96\u6d17\u65b9\u5f0f",
  "push_pull": "\u63a8\u52d5 / \u62c9\u56de",
  "scanner": "\u6383\u63cf\u5668",
  "scanner_placeholder": "\u8f38\u5165\u81ea\u5b9a\u7fa9\u6383\u63cf\u5668\u540d\u7a31",
  "date_time": "\u65e5\u671f & \u6642\u9593",
  "date_question": "\u6240\u6709\u76f8\u7247\u662f\u5426\u540c\u4e00\u65e5\u671f\uff1f",
  "date_yes": "\u662f \u2014 \u5168\u90e8\u540c\u4e00\u65e5\u671f",
  "date_no": "\u5426 \u2014 \u591a\u500b\u65e5\u671f\u5206\u6bb5",
  "shoot_date": "\u62cd\u651d\u65e5\u671f",
  "start_time": "\u958b\u59cb\u6642\u9593 (24\u5c0f\u6642)",
  "add_segment": "+ \u65b0\u589e\u65e5\u671f\u5206\u6bb5",
  "signature": "\u{1F60E} \u7c3d\u540d",
  "signature_label": "\u65bc EXIF \u4e2d\u52a0\u5165\u300cFilmTag by Jeffrey Chu\u300d",
  "public_label": "\u516c\u958b\u663e\u793a\uff08\u5728\u63cf\u8ff0\u4e2d\u5305\u542b\u300cFilmTag by Jeffrey Chu\u300d\uff09",

  // Actions / Status
  "review_summary": "\u6aa2\u8996\u6458\u8981",
  "reset_all": "\u5168\u90e8\u91cd\u7f6e",
  "close": "\u95dc\u9589",
  "download_zip": "\u4e0b\u8f09 ZIP",
  "save_to_album": "\u5132\u5b58\u81f3\u76f8\u7c3f",
  "download_all_zip": "\u4e0b\u8f09\u5168\u90e8 ZIP",

  // File list / Segments
  "other_free_text": "\u5176\u4ed6\uff08\u81ea\u7531\u8f38\u5165\uff09",
  "files_range": "\u6a94\u6848 {s} \u2013 {e}",
  "end_file_index": "\u7d50\u675f\u6a94\u6848\u7de8\u865f",
  "remove": "\u79fb\u9664",
  "total_uploaded": "\u5df2\u4e0a\u50b3\uff1a{n} \u500b\u6a94\u6848",
  "file_count": "{n} \u500b\u6a94\u6848",
  "clear_all": "\u6e05\u9664\u5168\u90e8",
  "unknown": "\u672a\u77e5",

  // Validation
  "author_required": "\u8acb\u586b\u5beb\u4f5c\u8005",
  "lens_required": "\u8acb\u586b\u5beb\u93e1\u982d\u540d\u7a31",
  "film_required": "\u8acb\u586b\u5beb\u5e95\u7247",
  "lab_required": "\u8acb\u586b\u5beb\u6c96\u6383\u5de5\u4f5c\u5ba4",
  "scanner_required": "\u8acb\u586b\u5beb\u6383\u63cf\u5668",
  "date_required": "\u8acb\u9078\u64c7\u65e5\u671f",
  "date_error": "\u65e5\u671f\u932f\u8aa4",

  // Summary
  "settings": "\u8a2d\u5b9a",
  "shutter": "\u5feb\u9580",
  "files_header": "\u6a94\u6848\uff08{n}\uff09",
  "col_index": "#",
  "col_original": "\u539f\u59cb\u6a94\u540d",
  "col_new_name": "\u65b0\u6a94\u540d",

  // Progress / Gallery
  "creating_zip": "\u6b63\u5728\u5efa\u7acb ZIP...",
  "done_processed": "\u5b8c\u6210\uff01\u5df2\u8655\u7406 {n} \u500b\u6a94\u6848\u3002",
  "processed_success": "\u5df2\u6210\u529f\u8655\u7406 {n} \u500b\u6a94\u6848",
  "processing_of": "\u6b63\u5728\u8655\u7406 {i}/{n}",
  "files_ready": "\u5df2\u5099\u59a5 {n} \u500b\u6a94\u6848",
  "save": "\u5132\u5b58"
};

export { t, setLang, toggleLang, applyTranslations, lang };
