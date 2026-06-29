import piexif from 'piexifjs';
import JSZip from 'jszip';
import DATA from '../data.json';
import { t, setLang, toggleLang, applyTranslations, lang } from './i18n.js';
import { toDms, strToUtf8Binary, toUcs2Binary, injectXmp, escXml, esc, fmtSize, dmsToDecimal, newFilmPrefix } from './lib/utils.js';
import { initGear, fillSelect, fillSelectWithCustom, saveCustomOpts, setupCustom, updateLensUI, collect, validate, saveLastSession, restoreLastSession } from './modules/gear.js';
import { initGps, initMap, updateGpsDots, updateGpsSaveBtn, setGpsForSelected, reverseGeocode } from './modules/gps.js';
import { init as initUi, renderFileList, goToPage, changePageSize, goToSummaryPage, changeSummaryPageSize, clearAll, removeOne, sortFiles, getTotalPages, buildSummaryHtml, generateSummaryThumbnails, rebuildSummaryBody, buildOptions, syncRange, buildSelectedFromRanges } from './modules/ui.js';
import { init as initDate, applyDateToSelected, refreshSegments, computeDateForFile, getFileDate, newFName } from './modules/date.js';
import { init as initUpload, handleFiles } from './modules/upload.js';
import { init as initProcess, startZipProcess, startSaveProcess, showGallery, showStatus } from './modules/process.js';

piexif.TAGS.Exif[0x828D] = { name: 'Instructions', type: 'Ascii' };

var APP_VERSION = typeof FILMTAG_VERSION !== 'undefined' ? FILMTAG_VERSION : 'dev';
document.addEventListener('DOMContentLoaded', function() {
  var el = document.getElementById('version');
  if (el) el.textContent = 'v' + APP_VERSION;
});

(function() {
  if (!localStorage.getItem('filmtag-disclaimer-acknowledged')) {
    var overlay = document.getElementById('disclaimer-overlay');
    if (overlay) {
      overlay.classList.add('show');
      document.getElementById('disclaimer-agree').addEventListener('click', function() {
        localStorage.setItem('filmtag-disclaimer-acknowledged', '1');
        overlay.classList.remove('show');
      });
      document.getElementById('disclaimer-disagree').addEventListener('click', function() {
        var content = overlay.querySelector('.overlay-content');
        content.innerHTML = '<h3 style="margin-bottom:1rem;color:var(--red);">' +
          (lang === 'zh' ? '無法使用' : 'Access Denied') +
          '</h3><p style="line-height:1.7;">' +
          (lang === 'zh'
            ? '你選擇咗不同意。呢個工具需要你先同意使用條款先可以用到。如果你改變主意，請重新整理頁面然後撳「我明白並同意使用」。'
            : 'You have chosen not to agree. This tool requires acknowledgment to function. If you change your mind, please refresh the page and click "I understand and agree to proceed".') +
          '</p>';
      });
    }
  }
})();

(function() {
  'use strict';

  var $ = function(id) { return document.getElementById(id); };
  var CAMERAS = DATA.cameras;
  var S = { $: $, _: $, CAMERAS: CAMERAS };

  S.uploadedFiles = []; S.fileDates = {}; S.clearedDates = {}; S.thumbnailCache = {};
  S.gpsData = {}; S.selectedSet = {}; S.geocodeCache = {}; S.geocodeQueue = [];
  S.isIPhone = /iPhone|iPad/.test(navigator.userAgent);
  S.currentPage = 1; S.pageSize = 5; S.prefetchTimer = null;
  S.summaryPage = 1; S.summaryPageSize = 5; S.processedFiles = [];
  S.geocodeBusy = false; S.map = null; S.mapMarker = null; S.mapInitialized = false;
  S.reverseGeocode = reverseGeocode;

  var artistSel = $('artist-select'), artistCust = $('artist-custom'), cameraSel = $('camera-select'), cameraCust = $('camera-custom');
  var lensDrop = $('lens-dropdown-group'), lensSel = $('lens-select'), lensCust = $('lens-custom');
  var filmSel = $('film-select'), filmCust = $('film-custom'), labSel = $('lab-select'), labCust = $('lab-custom');
  var ppSel = $('pushpull-select'), ppCust = $('pushpull-custom'), scanSel = $('scanner-select'), scanCust = $('scanner-custom'), processSel = $('process-select'), processCust = $('process-custom');
  var singleDateInp = $('single-date-input'), singleTimeInp = $('single-time-input');
  var fileInp = $('file-input'), uploadWrap = $('upload-wrap');
  var fileListEl = $('file-list'), reviewBtn = $('review-btn');
  var gallery = $('gallery-overlay'), galleryGrid = $('gallery-grid'), galleryTitle = $('gallery-title'), galleryZipBtn = $('gallery-zip-btn');
  var mapEl = $('map'), mapInfoEl = $('map-info'), clearLocBtn = $('clear-location-btn');
  var mapSearchInput = $('map-search-input'), mapSearchBtn = $('map-search-btn');
  var fileActions = $('file-actions'), editDateBtn = $('edit-date-btn'), editGpsBtn = $('edit-gps-btn');
  var dateOverlay = $('date-overlay'), gpsOverlay = $('gps-overlay');
  var dateSaveBtn = $('date-save-btn'), dateCancelBtn = $('date-cancel-btn');
  var gpsSaveBtn = $('gps-save-btn'), gpsCancelBtn = $('gps-cancel-btn');
  var imgOverlay = $('img-overlay'), imgOverlayImg = $('img-overlay-img'), imgOverlayClose = $('img-overlay-close');
  var selectToolbar = $('select-toolbar'), selectAllBtn = $('select-all-btn');
  var rangeRowsEl = $('range-rows'), addRangeBtn = $('add-range-btn');
  var summaryPanel = $('summary-overlay'), summaryBody = $('summary-body');
  var progressSec = $('progress-overlay'), progBar = $('progress-bar'), progText = $('progress-text');
  var statusMsg = $('status-msg');
  var loadingEl = $('loading-overlay'), loadingText = $('loading-text');

  S.artistSel = artistSel; S.artistCust = artistCust; S.cameraSel = cameraSel; S.cameraCust = cameraCust;
  S.lensDrop = lensDrop; S.lensSel = lensSel; S.lensCust = lensCust;
  S.filmSel = filmSel; S.filmCust = filmCust; S.labSel = labSel; S.labCust = labCust;
  S.ppSel = ppSel; S.ppCust = ppCust; S.scanSel = scanSel; S.scanCust = scanCust; S.processSel = processSel; S.processCust = processCust;
  S.singleDateInp = singleDateInp; S.singleTimeInp = singleTimeInp;
  S.fileInp = fileInp; S.uploadWrap = uploadWrap;
  S.fileListEl = fileListEl; S.reviewBtn = reviewBtn;
  S.gallery = gallery; S.galleryGrid = galleryGrid; S.galleryTitle = galleryTitle; S.galleryZipBtn = galleryZipBtn;
  S.mapEl = mapEl; S.mapInfoEl = mapInfoEl; S.clearLocBtn = clearLocBtn;
  S.mapSearchInput = mapSearchInput; S.mapSearchBtn = mapSearchBtn;
  S.fileActions = fileActions; S.editDateBtn = editDateBtn; S.editGpsBtn = editGpsBtn;
  S.dateOverlay = dateOverlay; S.gpsOverlay = gpsOverlay;
  S.dateSaveBtn = dateSaveBtn; S.dateCancelBtn = dateCancelBtn;
  S.gpsSaveBtn = gpsSaveBtn; S.gpsCancelBtn = gpsCancelBtn;
  S.imgOverlay = imgOverlay; S.imgOverlayImg = imgOverlayImg; S.imgOverlayClose = imgOverlayClose;
  S.selectToolbar = selectToolbar; S.selectAllBtn = selectAllBtn;
  S.rangeRowsEl = rangeRowsEl; S.addRangeBtn = addRangeBtn;
  S.summaryPanel = summaryPanel; S.summaryBody = summaryBody;
  S.progressSec = progressSec; S.progBar = progBar; S.progText = progText;
  S.statusMsg = statusMsg; S.loadingEl = loadingEl; S.loadingText = loadingText;

  initGear(S); initGps(S); initUi(S); initDate(S); initUpload(S); initProcess(S);

  S.renderFileList = renderFileList; S.computeDateForFile = computeDateForFile;
  S.getFileDate = getFileDate; S.newFName = newFName;
  S.refreshSegments = refreshSegments;
  S.collect = collect; S.validate = validate;
  S.saveCustomOpts = saveCustomOpts; S.saveLastSession = saveLastSession;
  S.startZipProcess = startZipProcess; S.startSaveProcess = startSaveProcess;
  S.showStatus = showStatus; S.initMap = initMap;
  window.clearAll = clearAll; window.removeOne = removeOne; window.sortFiles = sortFiles;
  window.goToPage = goToPage; window.changePageSize = changePageSize;
  window.goToSummaryPage = goToSummaryPage; window.changeSummaryPageSize = changeSummaryPageSize;

  fillSelectWithCustom(artistSel, DATA.artists, 'artist');
  fillSelectWithCustom(cameraSel, DATA.cameras.map(function(c) { return c.model; }), 'cameraModel');
  fillSelectWithCustom(labSel, DATA.labs, 'lab');
  fillSelectWithCustom(scanSel, DATA.scanners, 'scanner');
  fillSelectWithCustom(ppSel, DATA.pushpulls, 'pushPull');
  fillSelectWithCustom(processSel, DATA.processes, 'process');
  (function() {
    filmSel.innerHTML = '';
    for (var i = 0; i < DATA.films.length; i++) {
      var o = document.createElement('option');
      o.textContent = DATA.films[i].name;
      o.setAttribute('data-iso', DATA.films[i].iso);
      filmSel.appendChild(o);
    }
    var savedFilms = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}').filmName || [];
    for (var si = 0; si < savedFilms.length; si++) {
      var o2 = document.createElement('option');
      o2.textContent = savedFilms[si]; filmSel.appendChild(o2);
    }
    var oo = document.createElement('option');
    oo.value = '__custom__'; oo.textContent = t('other_free_text'); filmSel.appendChild(oo);
  })();
  setupCustom(artistSel, artistCust);
  setupCustom(cameraSel, cameraCust);
  setupCustom(labSel, labCust);
  setupCustom(ppSel, ppCust);
  setupCustom(scanSel, scanCust);
  setupCustom(processSel, processCust);
  setupCustom(filmSel, filmCust);
  cameraSel.addEventListener('change', updateLensUI);
  lensSel.addEventListener('change', function() {
    if (cameraSel.value === '__custom__') return;
    lensCust.classList.toggle('show', lensSel.value === '__custom__');
  });

  singleDateInp.valueAsDate = new Date();
  singleTimeInp.value = '12:00';
  singleDateInp.addEventListener('change', applyDateToSelected);
  singleTimeInp.addEventListener('change', applyDateToSelected);

  fileInp.addEventListener('change', function(e) { handleFiles(e.target.files); fileInp.value = ''; });
  uploadWrap.addEventListener('dragover', function(e) { e.preventDefault(); uploadWrap.classList.add('dragover'); });
  uploadWrap.addEventListener('dragleave', function() { uploadWrap.classList.remove('dragover'); });
  uploadWrap.addEventListener('drop', function(e) { e.preventDefault(); uploadWrap.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

  S.addRangeBtn.addEventListener('click', function() {
    var max = S.uploadedFiles.length;
    if (!max) return;
    var def = 1;
    for (var i = 0; i < max; i++) { if (!S.selectedSet[i]) { def = i + 1; break; } }
    var otherSet = {};
    for (var j = 0; j < max; j++) { if (S.selectedSet[j]) otherSet[j + 1] = true; }
    var row = document.createElement('div');
    row.className = 'range-row';
    row.innerHTML = 'Start: <select class="range-start">' + buildOptions(max, def, otherSet) + '</select> End: <select class="range-end">' + buildOptions(max, def, otherSet) + '</select> <button class="btn btn-sm btn-danger remove-range-btn">✕</button>';
    row.querySelector('.remove-range-btn').addEventListener('click', function() { this.parentElement.remove(); syncRange(); });
    row.querySelector('.range-start').addEventListener('change', function() {
      var endSel = this.parentElement.querySelector('.range-end');
      if (parseInt(endSel.value, 10) < parseInt(this.value, 10)) endSel.value = this.value;
      syncRange();
    });
    row.querySelector('.range-end').addEventListener('change', function() {
      var startSel = this.parentElement.querySelector('.range-start');
      if (parseInt(startSel.value, 10) > parseInt(this.value, 10)) startSel.value = this.value;
      syncRange();
    });
    S.rangeRowsEl.appendChild(row);
  });

  reviewBtn.addEventListener('click', function() {
    var p = collect();
    var err = validate(p); if (err) { showStatus(err, 'error'); return; }
    S.summaryPage = 1;
    rebuildSummaryBody();
    summaryPanel.classList.add('show');
  });

  imgOverlayClose.addEventListener('click', function() { imgOverlay.classList.remove('show'); });
  imgOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  clearLocBtn.addEventListener('click', function() {
    var keys = Object.keys(S.selectedSet);
    for (var k = 0; k < keys.length; k++) delete S.gpsData[keys[k]];
    if (S.mapMarker) { S.map.removeLayer(S.mapMarker); S.mapMarker = null; updateGpsSaveBtn(); }
    updateGpsDots();
  });
  selectAllBtn.addEventListener('click', function() {
    if (Object.keys(S.selectedSet).length > 0) { S.selectedSet = {}; }
    else { for (var i = 0; i < S.uploadedFiles.length; i++) S.selectedSet[i] = true; }
    S.renderFileList();
  });
  editDateBtn.addEventListener('click', function() { dateOverlay.classList.add('show'); });
  editGpsBtn.addEventListener('click', function() {
    gpsOverlay.classList.add('show');
    setTimeout(function() { S.mapEl.style.height = '280px'; initMap(); updateGpsSaveBtn(); }, 100);
  });
  dateCancelBtn.addEventListener('click', function() { dateOverlay.classList.remove('show'); });
  gpsCancelBtn.addEventListener('click', function() { gpsOverlay.classList.remove('show'); });
  dateSaveBtn.addEventListener('click', function() { applyDateToSelected(); dateOverlay.classList.remove('show'); });
  gpsSaveBtn.addEventListener('click', function() {
    if (S.mapMarker) { var latLng = S.mapMarker.getLatLng(); setGpsForSelected(latLng.lat, latLng.lng); }
    gpsOverlay.classList.remove('show');
  });
  gpsOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  mapSearchBtn.addEventListener('click', function() {
    var q = mapSearchInput.value.trim();
    if (!q || !S.map) return;
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q))
      .then(function(r) { return r.json(); })
      .then(function(results) {
        if (!results.length) return;
        var lat = parseFloat(results[0].lat), lng = parseFloat(results[0].lon);
        S.map.setView([lat, lng], 15);
        if (S.mapMarker) S.mapMarker.setLatLng([lat, lng]);
        else S.mapMarker = L.marker([lat, lng]).addTo(S.map);
        setGpsForSelected(lat, lng); updateGpsSaveBtn();
      }).catch(function() {});
  });
  mapSearchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') mapSearchBtn.click(); });

  $('reset-btn').addEventListener('click', function() {
    document.querySelectorAll('select').forEach(function(s, i, a) { s.selectedIndex = 0; s.dispatchEvent(new Event('change')); });
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(function(i) { i.value = ''; });
    singleDateInp.valueAsDate = new Date(); singleTimeInp.value = '12:00';
    S.uploadedFiles = []; S.gpsData = {}; S.selectedSet = {}; S.fileDates = {};
    summaryPanel.classList.remove('show'); summaryBody.innerHTML = ''; S.summaryPage = 1;
    gallery.classList.remove('show'); galleryGrid.innerHTML = '';
    dateOverlay.classList.remove('show'); gpsOverlay.classList.remove('show');
    if (S.mapMarker) { S.map.removeLayer(S.mapMarker); S.mapMarker = null; }
    S.mapInitialized = false; progressSec.classList.remove('show'); progBar.style.width = '0%'; $('progress-next-btn').style.display = 'none'; $('progress-spinner').style.display = 'block'; $('progress-done').style.display = 'none';
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';
    updateLensUI(); refreshSegments();
  });

  updateLensUI();
  restoreLastSession();
  (function() {
    if (!localStorage.getItem('filmtag-tutorial-seen')) showTutorial();
  })();
  document.querySelectorAll('.section-collapse-header').forEach(function(h) {
    h.addEventListener('click', function() {
      var t = document.getElementById(h.dataset.target); var i = h.querySelector('.collapse-icon');
      t.classList.toggle('collapsed'); i.classList.toggle('open');
    });
  });
  document.querySelectorAll('.file-sub-header').forEach(function(h) {
    h.addEventListener('click', function() {
      var t = document.getElementById(h.dataset.target); var i = h.querySelector('.collapse-icon');
      t.classList.toggle('collapsed'); i.classList.toggle('open');
    });
  });
  applyTranslations();

  $('lang-float-btn').addEventListener('click', function() {
    toggleLang();
    document.querySelectorAll('select option[value="__custom__"]').forEach(function(o) { o.textContent = t('other_free_text'); });
    summaryPanel.classList.remove('show'); summaryBody.innerHTML = ''; S.summaryPage = 1;
    gallery.classList.remove('show'); galleryGrid.innerHTML = '';
    dateOverlay.classList.remove('show'); gpsOverlay.classList.remove('show');
    refreshSegments(); S.renderFileList();
  });
  $('progress-next-btn').addEventListener('click', function() { progressSec.classList.remove('show'); progBar.style.width = '0%'; $('progress-next-btn').style.display = 'none'; $('progress-spinner').style.display = 'block'; $('progress-done').style.display = 'none'; location.reload(); });
  $('easter-egg-btn').addEventListener('click', function() { $('egg-overlay').classList.add('show'); });
  $('egg-close').addEventListener('click', function() { $('egg-overlay').classList.remove('show'); });
  $('egg-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  $('help-float-btn').addEventListener('click', showTutorial);
  $('tutorial-close').addEventListener('click', function() { $('tutorial-overlay').classList.remove('show'); });
  $('tutorial-got-it').addEventListener('click', function() { localStorage.setItem('filmtag-tutorial-seen', '1'); $('tutorial-overlay').classList.remove('show'); });
  $('tutorial-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
})();

function showTutorial() {
  var isZh = lang === 'zh';
  var steps = [
    { icon: '\uD83C\uDFC0', t: 'What EXIF Gets Written', tZh: '\u6703\u5BEB\u5165\u4EC0\u9EBC EXIF', d: 'Camera make/model \u00B7 Lens name & specs \u00B7 ISO \u00B7 Focal length \u00B7 Aperture \u00B7 Shutter speed \u00B7 Date & time \u00B7 GPS coordinates & address \u00B7 Artist \u00B7 Copyright \u00B7 Image description. XMP metadata is also injected: Label, Creator, Credit, DateCreated.', dZh: '\u76F8\u6A5F\u54C1\u724C/\u578B\u865F \u00B7 \u93E1\u982D\u540D\u7A31/\u898F\u683C \u00B7 ISO \u00B7 \u7126\u8DDD \u00B7 \u5149\u5708 \u00B7 \u5FEB\u9580 \u00B7 \u651D\u5F71\u65E5\u671F\u6642\u9593 \u00B7 GPS \u5750\u6A19/\u5730\u5740 \u00B7 \u651D\u5F71\u5E2B \u00B7 \u7248\u6B0A \u00B7 \u5716\u7247\u8AAA\u660E\u3002\u540C\u6642\u4E5F\u6703\u5BEB\u5165 XMP \u6A19\u7C64\uFF1ALabel\u3001Creator\u3001Credit\u3001DateCreated\u3002' },
    { icon: '\uD83D\uDD0D', t: 'Google Photos Ordering', tZh: 'Google Photos \u6392\u5E8F', d: 'Google Photos sorts by the EXIF DateTimeOriginal tag. After processing, every photo has its correct shooting time written into EXIF. Your entire roll appears in the right order in Google Photos, Apple Photos, and any app that reads EXIF dates \u2014 no more all-photos-on-the-same-day mess.', dZh: 'Google Photos \u662F\u4F9D\u64DA EXIF \u88E1\u7684 DateTimeOriginal \u4F86\u6392\u5E8F\u7684\u3002\u8655\u7406\u5F8C\uFF0C\u6BCF\u5F35\u76F8\u90FD\u6709\u6B63\u78BA\u7684\u651D\u5F71\u6642\u9593\u3002\u6574\u5377\u85ED\u7247\u5728 Google Photos\u3001Apple Photos \u548C\u6240\u6709\u652F\u63F4 EXIF \u7684\u61C9\u7528\u7A0B\u5F0F\u88E1\u90FD\u6703\u4EE5\u6B63\u78BA\u7684\u9806\u5E8F\u986F\u793A\u3002\u4E0D\u6703\u518D\u51FA\u73FE\u300C\u5168\u90E8\u85ED\u7247\u90FD\u585E\u5728\u540C\u4E00\u5929\u300D\u7684\u554F\u984C\u3002' },
    { icon: '\uD83D\uDCE4', t: 'Upload Photos', tZh: '\u4E0A\u50B3\u76F8\u7247', d: 'Click the upload area or drag & drop your JPEG files. Thumbnails and EXIF data are extracted automatically.', dZh: '\u9EDE\u64CA\u4E0A\u50B3\u5340\u57DF\u6216\u62D6\u66F3 JPEG \u6A94\u6848\uFF0C\u7E2E\u5716\u548C EXIF \u8CC7\u6599\u6703\u81EA\u52D5\u63D0\u53D6\u3002' },
    { icon: '\uD83D\uDCF7', t: 'Set Your Gear', tZh: '\u8A2D\u5B9A\u4F60\u7684 Gear', d: 'Choose Camera, Lens, Film Stock, Lab, Developing Process, Push/Pull, and Scanner from the dropdowns. Type anything custom \u2014 it is saved to your browser and shows up next time.', dZh: '\u5F9E\u4E0B\u62C9\u9078\u55AE\u9078\u64C7\u76F8\u6A5F\u3001\u93E1\u982D\u3001\u83F2\u6797\u3001\u6C96\u6383\u3001\u6C96\u6D17\u65B9\u5F0F\u3001Push/Pull\u3001\u6383\u63CF\u5668\u3002\u4EFB\u4F55\u81EA\u8A02\u8F38\u5165\u90FD\u6703\u81EA\u52D5\u5132\u5B58\uFF0C\u4E0B\u6B21\u958B\u7DB2\u7AD9\u6703\u81EA\u52D5\u51FA\u73FE\u3002' },
    { icon: '\uD83E\uDD1A', t: 'Sort & Reorder', tZh: '\u6392\u5E8F\u8207\u91CD\u65B0\u6392\u5217', d: 'Use the \u25B2Z / \u25BCZ buttons for quick A\u2192Z or Z\u2192A sort. Or drag & drop files anywhere. Order matters: it controls the sequence number in filenames (_01, _02\u2026) and the +1 minute timestamp increment.', dZh: '\u7528 \u25B2Z / \u25BCZ \u6309\u9215\u5FEB\u901F\u6392\u5E8F A\u2192Z \u6216 Z\u2192A\u3002\u4E5F\u53EF\u4EE5\u76F4\u63A5\u62D6\u52D5\u6A94\u6848\u5230\u4EFB\u4F55\u4F4D\u7F6E\u3002\u6392\u5217\u987A\u5E8F\u6703\u63A7\u5236\u6A94\u6848\u540D\u7684\u5E8F\u5217\u865F (_01\u3001_02\u2026) \u548C\u6BCF\u5F35\u76F8\u7684\u6642\u6233\u5206\u914D\u3002' },
    { icon: '\uD83D\uDCC5', t: 'Set Date & Time', tZh: '\u8A2D\u5B9A\u651D\u5F71\u65E5\u671F\u6642\u9593', d: 'Select one or more files, click \u201cSet Date & Time\u201d. Each file automatically gets +1 minute added. Set up date segments if a roll spans multiple days.', dZh: '\u9078\u64C7\u4E00\u6216\u591A\u500B\u6A94\u6848\uFF0C\u9EDE\u64CA\u300C\u8A2D\u5B9A\u65E5\u671F\u6642\u9593\u300D\u3002\u6BCF\u5F35\u76F8\u6703\u81EA\u52D5\u52A0 +1 \u5206\u9418\u3002\u5982\u679C\u4E00\u5377\u85ED\u7247\u8DE8\u591A\u5929\u62CD\u651D\uFF0C\u53EF\u4EE5\u8A2D\u5B9A\u591A\u500B\u65E5\u671F\u6BB5\u3002' },
    { icon: '\uD83D\uDCCD', t: 'Set GPS Location', tZh: '\u8A2D\u5B9A GPS \u4F4D\u7F6E', d: 'Select files, click \u201cSet GPS Location\u201d, then search or drop a pin on the map. Coordinates and address are written into EXIF.', dZh: '\u9078\u64C7\u6A94\u6848\uFF0C\u9EDE\u64CA\u300C\u8A2D\u5B9A GPS \u4F4D\u7F6E\u300D\uFF0C\u7136\u5F8C\u641C\u5C0B\u5730\u5740\u6216\u9EDE\u64CA\u5730\u5716\u843D\u91DD\u3002\u5750\u6A19\u548C\u5730\u5740\u6703\u5BEB\u5165 EXIF\u3002' },
    { icon: '\uD83D\uDCCB', t: 'Review & Process', tZh: '\u6AA2\u95B1\u8207\u8655\u7406', d: 'Click \u201cReview Summary\u201d to check all settings and preview new filenames. Then choose \u201cDownload ZIP\u201d (downloads all files at once) or \u201cSave to Album\u201d (save individually on iOS).', dZh: '\u9EDE\u64CA\u300CReview Summary\u300D\u6AA2\u67E5\u6240\u6709\u8A2D\u5B9A\u548C\u65B0\u6A94\u6848\u540D\u3002\u7136\u5F8C\u9078\u64C7\u300C\u4E0B\u8F09 ZIP\u300D\uFF08\u4E00\u6B21\u4E0B\u8F09\u5168\u90E8\u6A94\u6848\uFF09\u6216\u300C\u5132\u5B58\u5230\u76F8\u7C3F\u300D\uFF08iOS \u500B\u5225\u5132\u5B58\u3002\u3009' }
  ];
  var html = '';
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    html += '<div class="tutorial-step"><div class="ts-icon">' + s.icon + '</div><div><div class="ts-title">' + (isZh ? s.tZh : s.t) + '</div><div class="ts-desc">' + (isZh ? s.dZh : s.d) + '</div></div></div>';
  }
  document.getElementById('tutorial-body').innerHTML = html;
  document.getElementById('tutorial-got-it').textContent = isZh ? '\uD83C\uDF89 \u660E\u767D\u4E86\uFF01' : '\uD83C\uDF89 Got it!';
  document.getElementById('tutorial-overlay').classList.add('show');
}
