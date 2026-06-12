import piexif from 'piexifjs';
import JSZip from 'jszip';
import DATA from '../data.json';
import { t, setLang, toggleLang, applyTranslations, lang } from './i18n.js';
import { toDms, strToUtf8Binary, toUcs2Binary, injectXmp, escXml, esc, fmtSize, dmsToDecimal, newFilmPrefix } from './lib/utils.js';
import { initGear, fillSelect, fillSelectWithCustom, saveCustomOpts, setupCustom, updateLensUI, collect, validate } from './modules/gear.js';
import { initGps, initMap, updateGpsDots, updateGpsSaveBtn, setGpsForSelected } from './modules/gps.js';

// Register custom EXIF tags used by exiftool -Instructions
piexif.TAGS.Exif[0x828D] = { name: 'Instructions', type: 'Ascii' };

var APP_VERSION = typeof FILMTAG_VERSION !== 'undefined' ? FILMTAG_VERSION : 'dev';
document.addEventListener('DOMContentLoaded', function() {
  var el = document.getElementById('version');
  if (el) el.textContent = 'v' + APP_VERSION;
});

// Disclaimer acknowledgment
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

  var CAMERAS = DATA.cameras;

  var $ = function(id) { return document.getElementById(id); };
  var uploadedFiles = [];

  var authorSel = $('author-select'), authorCust = $('author-custom');
  var cameraSel = $('camera-select'), cameraCust = $('camera-custom');
  var lensDrop = $('lens-dropdown-group'), lensSel = $('lens-select'), lensCust = $('lens-custom');
  var filmSel = $('film-select'), filmCust = $('film-custom');
  var labSel = $('lab-select'), labCust = $('lab-custom');
  var ppSel = $('pushpull-select'), ppCust = $('pushpull-custom');
  var scanSel = $('scanner-select'), scanCust = $('scanner-custom');
  var singleDateInp = $('single-date-input'), singleTimeInp = $('single-time-input');
  var fileDates = {}, clearedDates = {};
  var fileInp = $('file-input'), uploadWrap = $('upload-wrap');
  var fileListEl = $('file-list'), reviewBtn = $('review-btn');
  var gallery = $('gallery-overlay'), galleryGrid = $('gallery-grid'), galleryTitle = $('gallery-title');
  var galleryZipBtn = $('gallery-zip-btn');
  var gpsSection = null, dateSection = null, mapEl = $('map'), mapInfoEl = $('map-info'), clearLocBtn = $('clear-location-btn');
  var mapSearchInput = $('map-search-input'), mapSearchBtn = $('map-search-btn');
  var fileActions = $('file-actions'), editDateBtn = $('edit-date-btn'), editGpsBtn = $('edit-gps-btn');
  var dateOverlay = $('date-overlay'), gpsOverlay = $('gps-overlay');
  var dateSaveBtn = $('date-save-btn'), dateCancelBtn = $('date-cancel-btn');
  var gpsSaveBtn = $('gps-save-btn'), gpsCancelBtn = $('gps-cancel-btn');
  var imgOverlay = $('img-overlay'), imgOverlayImg = $('img-overlay-img'), imgOverlayClose = $('img-overlay-close');
  var selectToolbar = $('select-toolbar'), selectAllBtn = $('select-all-btn');
  var rangeRowsEl = $('range-rows'), addRangeBtn = $('add-range-btn');
  var gpsData = {}, selectedSet = {}, thumbnailCache = {}, geocodeCache = {}, geocodeQueue = [];
  var isIPhone = /iPhone|iPad/.test(navigator.userAgent);

  var currentPage = 1, pageSize = 5, prefetchTimer = null;
  var summaryPage = 1, summaryPageSize = 5;

  var refs = { CAMERAS: CAMERAS, $: $,
    authorSel: authorSel, authorCust: authorCust,
    cameraSel: cameraSel, cameraCust: cameraCust,
    lensDrop: lensDrop, lensSel: lensSel, lensCust: lensCust,
    filmSel: filmSel, filmCust: filmCust,
    labSel: labSel, labCust: labCust,
    ppSel: ppSel, ppCust: ppCust,
    scanSel: scanSel, scanCust: scanCust,
    selectedSet: selectedSet, gpsData: gpsData,
    geocodeCache: geocodeCache, geocodeQueue: geocodeQueue
  };
  refs.geocodeBusy = false; refs.map = null; refs.mapMarker = null; refs.mapInitialized = false;
  refs.gpsOverlay = gpsOverlay; refs.gpsSaveBtn = gpsSaveBtn; refs.mapEl = mapEl;
  refs.mapInfoEl = mapInfoEl; refs.clearLocBtn = clearLocBtn;
  refs.mapSearchInput = mapSearchInput; refs.mapSearchBtn = mapSearchBtn;
  initGear(refs);
  initGps(refs);

  // Calculate total pages for file list pagination
  function getTotalPages() {
    if (pageSize === 0) return 1;
    return Math.ceil(uploadedFiles.length / pageSize) || 1;
  }
  // Navigate file list to a specific page
  function goToPage(p) {
    if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
    currentPage = Math.max(1, Math.min(p, getTotalPages()));
    renderFileList();
  }
  // Change number of files shown per page
  function changePageSize(s) {
    if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
    pageSize = parseInt(s, 10);
    currentPage = 1;
    renderFileList();
  }

  // Calculate total pages for review summary pagination
  function getSummaryTotalPages() {
    if (summaryPageSize === 0) return 1;
    return Math.ceil(uploadedFiles.length / summaryPageSize) || 1;
  }
  // Navigate review summary to a specific page
  function goToSummaryPage(p) {
    summaryPage = Math.max(1, Math.min(p, getSummaryTotalPages()));
    rebuildSummaryBody();
  }
  // Change number of files per page in review summary
  function changeSummaryPageSize(s) {
    summaryPageSize = parseInt(s, 10);
    summaryPage = 1;
    rebuildSummaryBody();
  }

  var summaryPanel = $('summary-overlay'), summaryBody = $('summary-body');
  var progressSec = $('progress-overlay'), progBar = $('progress-bar'), progText = $('progress-text');
  var statusMsg = $('status-msg');
  var loadingEl = $('loading-overlay'), loadingText = $('loading-text');

  // Populate gear dropdowns
  fillSelectWithCustom(authorSel, DATA.authors, 'author');
  fillSelectWithCustom(cameraSel, DATA.cameras.map(function(c) { return c.model; }), 'cameraModel');
  fillSelectWithCustom(labSel, DATA.labs, 'lab');
  fillSelectWithCustom(scanSel, DATA.scanners, 'scanner');
  fillSelectWithCustom(ppSel, DATA.pushpulls, 'pushPull');
  fillSelect($('process-select'), DATA.processes);

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

  setupCustom(authorSel, authorCust);
  setupCustom(cameraSel, cameraCust);
  setupCustom(labSel, labCust);
  setupCustom(ppSel, ppCust);
  setupCustom(scanSel, scanCust);
  setupCustom(filmSel, filmCust);

  cameraSel.addEventListener('change', updateLensUI);
  lensSel.addEventListener('change', function() {
    if (cameraSel.value === '__custom__') return;
    lensCust.classList.toggle('show', lensSel.value === '__custom__');
  });

  singleDateInp.valueAsDate = new Date();
  singleTimeInp.value = '12:00';

  // Apply current date/time inputs to all selected files, auto-incrementing minutes
  function applyDateToSelected() {
    var keys = Object.keys(selectedSet);
    if (!keys.length) return;
    var dv = singleDateInp.value, tv = singleTimeInp.value;
    if (!dv || !tv) return;
    var fd = dv.replace(/-/g, ''), ed = dv.replace(/-/g, ':');
    var p = tv.split(':'), h = parseInt(p[0], 10) || 0, m = parseInt(p[1], 10) || 0;
    for (var k = 0; k < keys.length; k++) {
      var mins = m + k;
      fileDates[keys[k]] = { fileDate: fd, exifDate: ed, hr: (h + Math.floor(mins / 60)) % 24, min: mins % 60 };
      delete clearedDates[keys[k]];
    }
    renderFileList();
  }

  singleDateInp.addEventListener('change', applyDateToSelected);
  singleTimeInp.addEventListener('change', applyDateToSelected);

  // Re-render file list and toggle review button state
  function refreshSegments() {
    renderFileList();
    reviewBtn.disabled = uploadedFiles.length === 0;
  }

  fileInp.addEventListener('change', function(e) { handleFiles(e.target.files); fileInp.value = ''; });
  uploadWrap.addEventListener('dragover', function(e) { e.preventDefault(); uploadWrap.classList.add('dragover'); });
  uploadWrap.addEventListener('dragleave', function() { uploadWrap.classList.remove('dragover'); });
  uploadWrap.addEventListener('drop', function(e) { e.preventDefault(); uploadWrap.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

  // Process selected/dropped files: deduplicate, sort, select all, render, extract EXIF
  function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!uploadedFiles.some(function(x) { return x.file.name === f.name && x.file.size === f.size; })) {
        uploadedFiles.push({ file: f });
      }
    }
    uploadedFiles.sort(function(a, b) { return a.file.name.localeCompare(b.file.name); });
    for (var k = 0; k < uploadedFiles.length; k++) selectedSet[k] = true;
    currentPage = 1;
    renderFileList(true);
    reviewBtn.disabled = false;
    extractExifFromFiles();
  }


  // Read EXIF date + GPS from each uploaded JPEG, render once first page is ready
  function extractExifFromFiles() {
    var completed = 0;
    var total = uploadedFiles.length;
    if (!total) return;
    var firstPageSize = pageSize === 0 ? total : Math.min(pageSize, total);
    var firstPageDone = false;
    loadingText.textContent = t('extracting_exif', {n: total});
    loadingEl.classList.add('show');
    for (var i = 0; i < total; i++) {
      (function(idx) {
        var file = uploadedFiles[idx].file;
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'jpg' && ext !== 'jpeg') {
          completed++;
          if (completed >= firstPageSize && !firstPageDone) { firstPageDone = true; renderFileList(); }
          if (completed === total) { renderFileList(); }
          return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
          var bytes = new Uint8Array(e.target.result);
          var jpegStr = '';
          for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]);
          uploadedFiles[idx]._jpegStr = jpegStr;
          try {
            var exifObj = piexif.load(jpegStr);
            if (!fileDates[idx]) {
              var dt = exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] || exifObj['0th'][piexif.ImageIFD.DateTime];
              if (dt) {
                var dp = dt.split(' ')[0].split(':');
                var tp = dt.split(' ')[1].split(':');
                if (dp.length === 3 && tp.length >= 2) {
                  fileDates[idx] = { fileDate: dp.join(''), exifDate: dp.join(':'), hr: parseInt(tp[0], 10), min: parseInt(tp[1], 10) };
                  delete clearedDates[idx];
                }
              }
            }
            if (!gpsData[idx]) {
              var gps = exifObj['GPS'];
              if (gps && gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLongitude]) {
                var lat = dmsToDecimal(gps[piexif.GPSIFD.GPSLatitude], gps[piexif.GPSIFD.GPSLatitudeRef]);
                var lng = dmsToDecimal(gps[piexif.GPSIFD.GPSLongitude], gps[piexif.GPSIFD.GPSLongitudeRef]);
                if (lat !== null && lng !== null) {
                  gpsData[idx] = { lat: lat, lng: lng, addr: '' };
                  reverseGeocode(lat, lng, [idx]);
                }
              }
            }
          } catch(_) {}
          completed++;
          if (completed >= firstPageSize && !firstPageDone) { firstPageDone = true; renderFileList(); }
          if (completed === total) renderFileList();
        };
        reader.readAsArrayBuffer(file);
      })(i);
    }
  }

  // Compute display date/time for file at 1-based index (custom date or fallback to lastModified)
  function computeDateForFile(idx) {
    if (clearedDates[idx - 1]) return null;
    var fd = fileDates[idx - 1];
    if (fd) {
      var ds = fd.fileDate;
      return { date: ds.slice(0,4) + '/' + ds.slice(4,6) + '/' + ds.slice(6,8), time: String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') };
    }
    var baseTime = uploadedFiles[0].file.lastModified;
    var d = new Date(baseTime + (idx - 1) * 60000);
    var dd = String(d.getFullYear()) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
    return { date: dd.slice(0,4) + '/' + dd.slice(4,6) + '/' + dd.slice(6,8), time: String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') };
  }

  // Render paginated file list with thumbnails, GPS indicators, date info, and selection UI
  function renderFileList(skipThumbs) {
    if (uploadedFiles.length === 0) {
      fileListEl.innerHTML = ''; reviewBtn.disabled = true;
      selectToolbar.style.display = 'none';
      fileActions.style.display = 'none';
      return;
    }
    selectToolbar.style.display = 'flex';
    var hasS = Object.keys(selectedSet).length > 0;
    fileActions.style.display = hasS ? 'flex' : 'none';
    var h = '<div class="file-list-header"><span>' + t('file_count', {n: uploadedFiles.length}) + '</span>' +
      '<button class="btn btn-sm btn-danger" onclick="clearAll()">' + t('clear_all') + '</button></div>';
    var start = pageSize === 0 ? 0 : (currentPage - 1) * pageSize;
    var end = pageSize === 0 ? uploadedFiles.length : Math.min(start + pageSize, uploadedFiles.length);
    for (var i = start; i < end; i++) {
      var f = uploadedFiles[i];
      var sel = selectedSet[i] ? ' selected' : '';
      var hasGps = gpsData[i];
      var addrTxt = hasGps && gpsData[i].addr ? ' <span class="gps-addr">' + esc(gpsData[i].addr) + '</span>' : '';
      var dot = hasGps ? '📍' + addrTxt : '<img src="no_gps.png" class="no-gps-icon">';
      var dateInfo = computeDateForFile(i + 1);
      var dateDot = dateInfo ? '<span class="date-dot">🗓️ ' + dateInfo.date + ' ' + dateInfo.time + '</span>' : '<img src="no_date.png" class="no-date-icon">';
      h += '<div class="file-item' + sel + '" data-idx="' + i + '">' +
        '<canvas class="file-thumb" data-idx="' + i + '" width="40" height="40"></canvas>' +
        '<div class="fidx">#' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="fname">' + esc(f.file.name) + '</div>' +
        '<div class="fsize">' + fmtSize(f.file.size) + '</div>' +
        '<span class="file-gps-dot">' + dot + '</span>' +
        dateDot +
        '<button class="remove-btn" onclick="removeOne(' + i + ')">✕</button>' +
        '</div>';
    }
    var tp = getTotalPages();
    h += '<div class="pagination">' +
      '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(' + (currentPage - 1) + ')"' + (currentPage <= 1 ? ' disabled' : '') + '>◀</button>' +
      '<span class="page-info">' + t('page_of', {current: currentPage, total: tp}) + '</span>' +
      '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(' + (currentPage + 1) + ')"' + (currentPage >= tp ? ' disabled' : '') + '>▶</button>' +
      '<select onchange="changePageSize(this.value)">' +
        '<option value="5"' + (pageSize === 5 ? ' selected' : '') + '>5</option>' +
        '<option value="10"' + (pageSize === 10 ? ' selected' : '') + '>10</option>' +
        '<option value="25"' + (pageSize === 25 ? ' selected' : '') + '>25</option>' +
        '<option value="50"' + (pageSize === 50 ? ' selected' : '') + '>50</option>' +
        '<option value="0"' + (pageSize === 0 ? ' selected' : '') + '>' + t('all') + '</option>' +
      '</select></div>';
    fileListEl.innerHTML = h;
    if (!skipThumbs) {
      generateThumbnails(function() {
        loadingEl.classList.remove('show');
        startPrefetch(currentPage + 1);
      });
    }
    bindFileItemClicks();
    initMap();
    renderRanges();
    selectAllBtn.textContent = Object.keys(selectedSet).length > 0 ? t('unselect_all') : t('select_all');
    fileActions.style.display = hasS ? 'flex' : 'none';
  }

  // Generate 40×40 thumbnail canvases for all files (cached or fresh decode, concurrency=6)
  function generateThumbnails(onDone) {
    var queue = [], concurrency = 6;
    for (var i = 0; i < uploadedFiles.length; i++) {
      (function(idx) {
        var c = document.querySelector('canvas.file-thumb[data-idx="' + idx + '"]');
        if (!c) return;
        c.removeEventListener('click', thumbnailClick);
        c.addEventListener('click', thumbnailClick);
        c._thumbFile = uploadedFiles[idx].file;
        if (thumbnailCache[idx]) {
          var img = new Image();
          img.onload = function() { c.getContext('2d').drawImage(img, 0, 0, 40, 40); };
          img.src = thumbnailCache[idx];
        } else {
          queue.push({ canvas: c, idx: idx, file: uploadedFiles[idx].file });
        }
      })(i);
    }
    var next = 0;
    // Decode next queued file and render its thumbnail
    function processNext() {
      if (next >= queue.length) {
        if (onDone) { var cb = onDone; onDone = null; cb(); }
        return;
      }
      var item = queue[next++];
      var img = new Image();
      img.onload = function() {
        if (!item.canvas.parentNode) return;
        var s = Math.min(40 / img.width, 40 / img.height);
        var ctx = item.canvas.getContext('2d');
        ctx.drawImage(img, (40 - img.width * s) / 2, (40 - img.height * s) / 2, img.width * s, img.height * s);
        var tmp = document.createElement('canvas');
        tmp.width = 40; tmp.height = 40;
        tmp.getContext('2d').drawImage(img, (40 - img.width * s) / 2, (40 - img.height * s) / 2, img.width * s, img.height * s);
        thumbnailCache[item.idx] = tmp.toDataURL();
        URL.revokeObjectURL(img.src);
        processNext();
      };
      img.src = URL.createObjectURL(item.file);
    }
    for (var i = 0; i < Math.min(concurrency, queue.length); i++) processNext();
    if (queue.length === 0 && onDone) { var cb = onDone; onDone = null; cb(); }
  }

  // Prefetch thumbnails for upcoming pages in background (concurrency=2) for instant navigation
  function startPrefetch(fromPage) {
    if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
    if (fromPage > getTotalPages() || pageSize === 0) return;
    var start = (fromPage - 1) * pageSize;
    var end = Math.min(start + pageSize, uploadedFiles.length);

    var allCached = true;
    for (var i = start; i < end; i++) {
      if (!thumbnailCache[i]) { allCached = false; break; }
    }
    if (allCached) {
      prefetchTimer = setTimeout(function() { startPrefetch(fromPage + 1); }, 50);
      return;
    }

    var active = 0, next = start, concurrency = 2;
    // Pump the prefetch queue until all files on this page are cached
    function pump() {
      while (active < concurrency && next < end) {
        var idx = next++; active++;
        processFile(idx);
      }
      if (active === 0 && next >= end) {
        prefetchTimer = setTimeout(function() { startPrefetch(fromPage + 1); }, 50);
      }
    }
    // Decode and cache a single thumbnail for prefetch
    function processFile(idx) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var tmp = document.createElement('canvas');
          tmp.width = 40; tmp.height = 40;
          var s = Math.min(40 / img.width, 40 / img.height);
          tmp.getContext('2d').drawImage(img, (40 - img.width * s) / 2, (40 - img.height * s) / 2, img.width * s, img.height * s);
          thumbnailCache[idx] = tmp.toDataURL();
          URL.revokeObjectURL(img.src);
          active--;
          pump();
        };
        img.src = URL.createObjectURL(new Blob([e.target.result]));
      };
      reader.readAsArrayBuffer(uploadedFiles[idx].file);
    }
    pump();
  }

  // Show full-size image overlay when a thumbnail is clicked
  function thumbnailClick(e) {
    e.stopPropagation();
    var url = URL.createObjectURL(e.target._thumbFile);
    imgOverlayImg.src = url;
    imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
    imgOverlay.classList.add('show');
  }

  // Attach click handlers to all .file-item elements
  function bindFileItemClicks() {
    var items = document.querySelectorAll('.file-item');
    for (var k = 0; k < items.length; k++) {
      items[k].removeEventListener('click', fileItemClick);
      items[k].addEventListener('click', fileItemClick);
    }
  }

  // Toggle file selection on click and update selection UI
  function fileItemClick(e) {
    if (e.target.closest('.remove-btn')) return;
    var item = e.currentTarget;
    var i = parseInt(item.getAttribute('data-idx'), 10);
    if (selectedSet[i]) {
      delete selectedSet[i]; item.classList.remove('selected');
    } else {
      selectedSet[i] = true; item.classList.add('selected');
    }
    selectAllBtn.textContent = Object.keys(selectedSet).length > 0 ? t('unselect_all') : t('select_all');
    var ct = Object.keys(selectedSet).length;
    fileActions.style.display = ct ? 'flex' : 'none';
    renderRanges();
  }

  // Remove all uploaded files and reset all state
  function clearAll() {
    uploadedFiles = [];
    gpsData = {}; selectedSet = {}; thumbnailCache = {}; geocodeCache = {}; fileDates = {}; clearedDates = {};
    currentPage = 1;
    if (refs.mapMarker) { refs.map.removeLayer(refs.mapMarker); refs.mapMarker = null; }
    refreshSegments();
  }
  // Remove a single file by index and reindex dependent state objects
  function removeOne(i) {
    uploadedFiles.splice(i, 1);
    var newGps = {}, newSel = {}, newCache = {};
    for (var j = 0; j < uploadedFiles.length; j++) {
      var oldIdx = j < i ? j : j + 1;
      if (gpsData[oldIdx]) newGps[j] = gpsData[oldIdx];
      if (selectedSet[oldIdx]) newSel[j] = true;
      if (thumbnailCache[oldIdx]) newCache[j] = thumbnailCache[oldIdx];
    }
    gpsData = newGps; selectedSet = newSel; thumbnailCache = newCache;
    if (currentPage > getTotalPages()) currentPage = getTotalPages();
    refreshSegments();
    renderRanges();
  }
  window.clearAll = clearAll; window.removeOne = removeOne;
  window.goToPage = goToPage; window.changePageSize = changePageSize;
  window.goToSummaryPage = goToSummaryPage; window.changeSummaryPageSize = changeSummaryPageSize;

  // Build file selection set from range-row dropdown values
  function buildSelectedFromRanges() {
    var set = {}, max = uploadedFiles.length;
    var rows = rangeRowsEl.querySelectorAll('.range-row');
    for (var r = 0; r < rows.length; r++) {
      var sel = rows[r].querySelectorAll('select');
      if (sel.length < 2) continue;
      var s = parseInt(sel[0].value, 10), e = parseInt(sel[1].value, 10);
      if (isNaN(s) || isNaN(e)) continue;
      s = Math.max(1, s); e = Math.min(max, e);
      for (var i = s - 1; i < e; i++) set[i] = true;
    }
    return set;
  }

  // Render range-selection UI rows based on current selection state
  function renderRanges() {
    rangeRowsEl.innerHTML = '';
    if (!uploadedFiles.length) return;
    var max = uploadedFiles.length;
    var keys = Object.keys(selectedSet).map(Number).sort(function(a, b) { return a - b; });
    var ranges = [];
    if (keys.length) {
      var s = keys[0] + 1, e = keys[0] + 1;
      for (var i = 1; i <= keys.length; i++) {
        if (keys[i] === keys[i - 1] + 1) { e = keys[i] + 1; }
        else { ranges.push([s, e]); if (i < keys.length) { s = keys[i] + 1; e = keys[i] + 1; } }
      }
    }
    for (var r = 0; r < ranges.length; r++) {
      var row = document.createElement('div');
      row.className = 'range-row';
      var rangeSet = {};
      for (var i = ranges[r][0]; i <= ranges[r][1]; i++) rangeSet[i] = true;
      var otherSet = {};
      for (var j = 0; j < max; j++) { if (selectedSet[j] && !rangeSet[j + 1]) otherSet[j + 1] = true; }
      row.innerHTML = 'Start: <select class="range-start">' + buildOptions(max, ranges[r][0], otherSet) + '</select> End: <select class="range-end">' + buildOptions(max, ranges[r][1], otherSet) + '</select> <button class="btn btn-sm btn-danger remove-range-btn">✕</button>';
      row.querySelector('.remove-range-btn').addEventListener('click', function() {
        this.parentElement.remove();
        syncRange();
      });
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
      rangeRowsEl.appendChild(row);
    }
  }

  // Build HTML option strings for range dropdowns, excluding already-used indices
  function buildOptions(max, selected, excludeSet) {
    var h = '';
    for (var i = 1; i <= max; i++) {
      if (excludeSet && excludeSet[i]) continue;
      var sel = i === selected ? ' selected' : '';
      h += '<option value="' + i + '"' + sel + '>' + i + '</option>';
    }
    return h;
  }

  // Recalculate selectedSet from range rows and re-render
  function syncRange() {
    selectedSet = buildSelectedFromRanges();
    renderFileList();
  }

  addRangeBtn.addEventListener('click', function() {
    var max = uploadedFiles.length;
    if (!max) return;
    var def = 1;
    for (var i = 0; i < max; i++) { if (!selectedSet[i]) { def = i + 1; break; } }
    var otherSet = {};
    for (var j = 0; j < max; j++) { if (selectedSet[j]) otherSet[j + 1] = true; }
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
    rangeRowsEl.appendChild(row);
  });

  // Resolve effective date for a file (custom date or fallback to lastModified)
  function getFileDate(i) {
    var fd = fileDates[i];
    if (fd) return fd;
    var baseTime = uploadedFiles[0].file.lastModified;
    var d = new Date(baseTime + i * 60000);
    var dd = String(d.getFullYear()) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
    return { fileDate: dd, exifDate: dd.slice(0,4) + ':' + dd.slice(4,6) + ':' + dd.slice(6,8), hr: d.getHours(), min: d.getMinutes() };
  }


  // Build output filename: FilmPrefix_YYYYMMDDHHMM_XX.ext
  function newFName(film, ext, i) {
    var fd = getFileDate(i);
    var c = newFilmPrefix(film);
    return c + '_' + fd.fileDate + String(fd.hr).padStart(2,'0') + String(fd.min).padStart(2,'0') + '_' + String(i + 1).padStart(2,'0') + '.' + ext;
  }

  // Build review summary HTML: settings panel + rename table with pagination
  function buildSummaryHtml(p) {
    var html = '';
    html += '<div class="summary-section"><h3>' + t('settings') + '</h3>';
    var rows = [
      [t('author'), p.author], [t('camera'), p.camera.make + ' ' + p.camera.model],
      [t('lens'), p.lens.name + (p.lens.focal ? ' (' + p.lens.focal + 'mm)' : '') + (p.lens.aperture ? ' F/' + p.lens.aperture : '')],
      [t('film_stock'), p.film.name + ' (ISO ' + p.film.iso + ')'], [t('lab'), p.lab],
      [t('process'), p.process + ' (' + p.pushpull + ')'], [t('scanner'), p.scanner]
    ];
    if (p.camera.shutter) rows.push([t('shutter'), p.camera.shutter]);
    for (var i = 0; i < rows.length; i++) html += '<div class="summary-row"><span class="k">' + rows[i][0] + '</span><span class="v">' + esc(rows[i][1]) + '</span></div>';
    html += '</div>';

    html += '<div class="summary-section"><h3>' + t('files_header', {n: uploadedFiles.length}) + '</h3>';
    html += '<table class="rename-table"><tr><th></th><th>' + t('col_index') + '</th><th>' + t('col_original') + '</th><th>' + t('col_new_name') + '</th><th>📍 ' + t('col_location') + '</th><th>🗓️ ' + t('col_date') + '</th></tr>';
    var start = summaryPageSize === 0 ? 0 : (summaryPage - 1) * summaryPageSize;
    var end = summaryPageSize === 0 ? uploadedFiles.length : Math.min(start + summaryPageSize, uploadedFiles.length);
    for (var j = start; j < end; j++) {
      var ext = uploadedFiles[j].file.name.split('.').pop().toLowerCase();
      var nn = newFName(p.film.name, ext, j);
      var gpsLoc = gpsData[j] && gpsData[j].addr ? '📍 ' + esc(gpsData[j].addr) : '<img src="no_gps.png" class="no-gps-icon">';
      var dateInfo2 = computeDateForFile(j + 1);
      var dateCell2 = dateInfo2 ? '<span class="date-dot">🗓️ ' + dateInfo2.date + ' ' + dateInfo2.time + '</span>' : '<img src="no_date.png" class="no-date-icon">';
      html += '<tr><td><canvas class="summary-thumb" width="40" height="40" data-idx="' + j + '"></canvas></td><td style="color:#555;">' + (j + 1) + '</td><td class="old-name">' + esc(uploadedFiles[j].file.name) + '</td><td class="new-name">' + esc(nn) + '</td><td style="text-align:center;font-size:0.65rem;">' + gpsLoc + '</td><td style="text-align:center;font-size:0.65rem;">' + dateCell2 + '</td></tr>';
    }
    html += '</table>';
    var tp = getSummaryTotalPages();
    html += '<div class="pagination" style="padding:0.75rem 0;">' +
      '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToSummaryPage(' + (summaryPage - 1) + ')"' + (summaryPage <= 1 ? ' disabled' : '') + '>◀</button>' +
      '<span class="page-info">' + t('page_of', {current: summaryPage, total: tp}) + '</span>' +
      '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToSummaryPage(' + (summaryPage + 1) + ')"' + (summaryPage >= tp ? ' disabled' : '') + '>▶</button>' +
      '<select onchange="changeSummaryPageSize(this.value)">' +
        '<option value="5"' + (summaryPageSize === 5 ? ' selected' : '') + '>5</option>' +
        '<option value="10"' + (summaryPageSize === 10 ? ' selected' : '') + '>10</option>' +
        '<option value="25"' + (summaryPageSize === 25 ? ' selected' : '') + '>25</option>' +
        '<option value="50"' + (summaryPageSize === 50 ? ' selected' : '') + '>50</option>' +
        '<option value="0"' + (summaryPageSize === 0 ? ' selected' : '') + '>' + t('all') + '</option>' +
      '</select></div>';
    html += '</div>';
    html += '<div class="actions" style="margin-top:1rem;">' +
      '<button class="btn btn-secondary" id="summary-close-btn">' + t('close') + '</button>' +
      '<button class="btn btn-primary" id="confirm-save-btn">' + t('save_to_album') + '</button>' +
      '<button class="btn btn-primary" id="confirm-zip-btn">' + t('download_zip') + '</button></div>';
    return html;
  }

  // Rebuild the review summary panel body and attach event listeners
  function rebuildSummaryBody() {
    var p = collect();
    var tp = getSummaryTotalPages();
    summaryPage = Math.max(1, Math.min(summaryPage, tp));
    summaryBody.innerHTML = buildSummaryHtml(p);
    generateSummaryThumbnails();
    $('confirm-zip-btn').addEventListener('click', startZipProcess);
    $('confirm-save-btn').addEventListener('click', startSaveProcess);
    var closeBtn = $('summary-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function() { summaryPanel.classList.remove('show'); summaryPage = 1; });
  }

  // Generate 40×40 thumbnails for summary table (cached or fresh decode)
  function generateSummaryThumbnails() {
    var queue = [], concurrency = 6;
    var canvases = document.querySelectorAll('canvas.summary-thumb');
    for (var ti = 0; ti < canvases.length; ti++) {
      (function(canvas) {
        var idx = parseInt(canvas.getAttribute('data-idx'), 10);
        var file = uploadedFiles[idx].file;
        if (thumbnailCache[idx]) {
          var img = new Image();
          img.onload = function() { canvas.getContext('2d').drawImage(img, 0, 0, 40, 40); };
          img.src = thumbnailCache[idx];
        } else {
          queue.push({ canvas: canvas, idx: idx, file: file });
        }
        canvas.addEventListener('click', function(e) {
          e.stopPropagation();
          var url = URL.createObjectURL(file);
          imgOverlayImg.src = url;
          imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
          imgOverlay.classList.add('show');
        });
      })(canvases[ti]);
    }
    var next = 0;
    // Decode next queued summary thumbnail
    function processNext() {
      if (next >= queue.length) return;
      var item = queue[next++];
      var img = new Image();
      img.onload = function() {
        if (!item.canvas.parentNode) return;
        var s = Math.min(40 / img.width, 40 / img.height);
        var ctx = item.canvas.getContext('2d');
        ctx.drawImage(img, (40 - img.width * s) / 2, (40 - img.height * s) / 2, img.width * s, img.height * s);
        var tmp = document.createElement('canvas');
        tmp.width = 40; tmp.height = 40;
        tmp.getContext('2d').drawImage(img, (40 - img.width * s) / 2, (40 - img.height * s) / 2, img.width * s, img.height * s);
        thumbnailCache[item.idx] = tmp.toDataURL();
        URL.revokeObjectURL(img.src);
        processNext();
      };
      img.src = URL.createObjectURL(item.file);
    }
    for (var i = 0; i < Math.min(concurrency, queue.length); i++) processNext();
  }

  reviewBtn.addEventListener('click', function() {
    var p = collect();
    var err = validate(p); if (err) { showStatus(err, 'error'); return; }
    summaryPage = 1;
    rebuildSummaryBody();
    summaryPanel.classList.add('show');
  });

  $('summary-close-btn') && $('summary-close-btn').addEventListener('click', function() { summaryPanel.classList.remove('show'); summaryPage = 1; });

  // Process all files → inject EXIF/XMP → package as ZIP download (concurrency=4)
  function startZipProcess() {
    summaryPanel.classList.remove('show');
    var p = collect();

    reviewBtn.disabled = true;
    progressSec.classList.add('show');
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';

    var total = uploadedFiles.length, zip = new JSZip();
    var completed = 0, nextIdx = 0, active = 0, CONCURRENCY = 4;

    function startNext() {
      while (active < CONCURRENCY && nextIdx < total) {
        var idx = nextIdx++;
        active++;
        processFile(idx);
      }
      if (active === 0 && completed === total) {
        progText.textContent = t('creating_zip');
        zip.generateAsync({ type: 'blob' }).then(function(blob) {
          var url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url;
          a.download = 'filmtag_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip';          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          progBar.style.width = '100%'; progText.textContent = t('done_processed', {n: total});
          showStatus(t('processed_success', {n: total}), 'success');
          reviewBtn.disabled = false;
          saveCustomOpts();
          setTimeout(function() { progressSec.classList.remove('show'); progBar.style.width = '0%'; }, 3000);
        });
      }
    }

    function processFile(idx) {
      var entry = uploadedFiles[idx], ext = entry.file.name.split('.').pop().toLowerCase();
      var fd = getFileDate(idx);
      var nn = newFName(p.film.name, ext, idx);

      var reader = new FileReader();
      reader.onload = function(e) {
        var bytes = new Uint8Array(e.target.result);

        if (ext === 'jpg' || ext === 'jpeg') {
          try {
            var jpegStr = entry._jpegStr || '';
            if (!jpegStr) {
              for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]);
            }

            var exifObj;
            try { exifObj = piexif.load(jpegStr); } catch(_) {
              exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null };
            }

            exifObj['0th'][piexif.ImageIFD.Make] = p.camera.make;
            exifObj['0th'][piexif.ImageIFD.Model] = p.camera.model;
            exifObj['0th'][piexif.ImageIFD.Artist] = p.author;
            exifObj['0th'][piexif.ImageIFD.Software] = p.scanner + ' (FilmTag by Jeffrey Chu)';
            exifObj['Exif'][0x828D] = p.process + ' (' + p.pushpull + ')';

            var dateTimeStr = fd.exifDate + ' ' + String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') + ':00+08:00';
            exifObj['0th'][piexif.ImageIFD.DateTime] = dateTimeStr;
            exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateTimeStr;
            exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = dateTimeStr;
            exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = parseInt(p.film.iso, 10) || 400;
            exifObj['Exif'][piexif.ExifIFD.LensModel] = p.lens.name;

            if (p.lens.focal) {
              var fl = parseFloat(p.lens.focal);
              exifObj['Exif'][piexif.ExifIFD.FocalLength] = Number.isInteger(fl) ? [fl, 1] : [Math.round(fl * 100), 100];
            }
            if (p.lens.aperture) {
              var ap = Math.round(parseFloat(p.lens.aperture) * 100);
              exifObj['Exif'][piexif.ExifIFD.FNumber] = [ap, 100];
              exifObj['Exif'][piexif.ExifIFD.MaxApertureValue] = [ap, 100];
              exifObj['Exif'][piexif.ExifIFD.ApertureValue] = [ap, 100];
            }
            if (p.camera.shutter) {
              var sf = p.camera.shutter.split('/');
              if (sf.length === 2) {
                exifObj['Exif'][piexif.ExifIFD.ExposureTime] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
                exifObj['Exif'][piexif.ExifIFD.ShutterSpeedValue] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
              }
            }

            exifObj['Exif'][piexif.ExifIFD.UserComment] =
              'UNICODE\x00' + toUcs2Binary(
              'Film Stock: ' + p.film.name + ' | Process: ' + p.process + ' | Exposure: ' + p.pushpull +
              (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Scanner: ' + p.scanner);

                        exifObj['0th'][piexif.ImageIFD.ImageDescription] =
              ($('public-checkbox').checked ? 'FilmTag by Jeffrey Chu | ' : '') +
              'Photo by ' + p.author + ' | Camera: ' + p.camera.model + ' (' + p.lens.name + ') | Film: ' + p.film.name +
              ' (ISO ' + p.film.iso + ')' + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') +
              ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' (' + p.pushpull + ') | Scanner: ' + p.scanner;
            exifObj['0th'][piexif.ImageIFD.Copyright] =
              'FilmTag by Jeffrey Chu | ' +
              'Processed by ' + p.lab + ' (' + p.process + ') | Scanned via ' + p.scanner;

            var gps = gpsData[idx];
            if (gps) {
              exifObj['GPS'] = exifObj['GPS'] || {};
              exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = toDms(gps.lat);
              exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = gps.lat >= 0 ? 'N' : 'S';
              exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = toDms(gps.lng);
              exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = gps.lng >= 0 ? 'E' : 'W';
            }

            var exifBytes = piexif.dump(exifObj);
            var newStr = piexif.insert(exifBytes, jpegStr);
            p.dateTime = dateTimeStr;
            p.publicDesc = $('public-checkbox').checked;
            newStr = injectXmp(newStr, p, p.lab, p.process, p.scanner);
            bytes = new Uint8Array(newStr.length);
            for (var b2 = 0; b2 < newStr.length; b2++) bytes[b2] = newStr.charCodeAt(b2) & 0xFF;
          } catch(err) { console.warn('EXIF write failed', err); }
        }

        zip.file(nn, bytes, { binary: true });
        completed++;
        active--;
        progBar.style.width = Math.round((completed / total) * 100) + '%';
        progText.textContent = t('processing_of', {i: completed, n: total});
        startNext();
      };
      reader.readAsArrayBuffer(entry.file);
    }

    startNext();
  }

  var processedFiles = [];

  // Process all files → inject EXIF/XMP → save to device album (iOS share or download)
  function startSaveProcess() {
    summaryPanel.classList.remove('show');
    var p = collect();

    reviewBtn.disabled = true;
    progressSec.classList.add('show');
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';
    processedFiles = [];

    var total = uploadedFiles.length, zip = new JSZip();
    var completed = 0, nextIdx = 0, active = 0, CONCURRENCY = 4;

    function startNext() {
      while (active < CONCURRENCY && nextIdx < total) {
        var idx = nextIdx++;
        active++;
        processFile(idx);
      }
      if (active === 0 && completed === total) {
        progText.textContent = t('done_processed', {n: total});
        progressSec.classList.remove('show');
        reviewBtn.disabled = false;
        saveCustomOpts();
        showGallery(processedFiles, p, zip);
      }
    }

    function processFile(idx) {
      var entry = uploadedFiles[idx], ext = entry.file.name.split('.').pop().toLowerCase();
      var fd = getFileDate(idx);
      var nn = newFName(p.film.name, ext, idx);

      var reader = new FileReader();
      reader.onload = function(e) {
        var bytes = new Uint8Array(e.target.result);

        if (ext === 'jpg' || ext === 'jpeg') {
          try {
            var jpegStr = entry._jpegStr || '';
            if (!jpegStr) {
              for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]);
            }
            var exifObj;
            try { exifObj = piexif.load(jpegStr); } catch(_) {
              exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null };
            }
            exifObj['0th'][piexif.ImageIFD.Make] = p.camera.make;
            exifObj['0th'][piexif.ImageIFD.Model] = p.camera.model;
            exifObj['0th'][piexif.ImageIFD.Artist] = p.author;
            exifObj['0th'][piexif.ImageIFD.Software] = p.scanner + ' (FilmTag by Jeffrey Chu)';
            var dt = fd.exifDate + ' ' + String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') + ':00+08:00';
            exifObj['0th'][piexif.ImageIFD.DateTime] = dt;
            exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dt;
            exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = dt;
            exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = parseInt(p.film.iso, 10) || 400;
            exifObj['Exif'][piexif.ExifIFD.LensModel] = p.lens.name;
            if (p.lens.focal) {
              var fl = parseFloat(p.lens.focal);
              exifObj['Exif'][piexif.ExifIFD.FocalLength] = Number.isInteger(fl) ? [fl, 1] : [Math.round(fl * 100), 100];
            }
            if (p.lens.aperture) {
              var ap = Math.round(parseFloat(p.lens.aperture) * 100);
              exifObj['Exif'][piexif.ExifIFD.FNumber] = [ap, 100];
              exifObj['Exif'][piexif.ExifIFD.MaxApertureValue] = [ap, 100];
              exifObj['Exif'][piexif.ExifIFD.ApertureValue] = [ap, 100];
            }
            if (p.camera.shutter) {
              var sf = p.camera.shutter.split('/');
              if (sf.length === 2) {
                exifObj['Exif'][piexif.ExifIFD.ExposureTime] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
                exifObj['Exif'][piexif.ExifIFD.ShutterSpeedValue] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
              }
            }
            exifObj['Exif'][piexif.ExifIFD.UserComment] =
              'UNICODE\x00' + toUcs2Binary('Film Stock: ' + p.film.name + ' | Process: ' + p.process + ' | Exposure: ' + p.pushpull + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Scanner: ' + p.scanner);
            exifObj['Exif'][0x828D] = p.process + ' (' + p.pushpull + ')';
            exifObj['0th'][piexif.ImageIFD.ImageDescription] =
              ($('public-checkbox').checked ? 'FilmTag by Jeffrey Chu | ' : '') +
              'Photo by ' + p.author + ' | Camera: ' + p.camera.model + ' (' + p.lens.name + ') | Film: ' + p.film.name + ' (ISO ' + p.film.iso + ')' + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' (' + p.pushpull + ') | Scanner: ' + p.scanner;
            exifObj['0th'][piexif.ImageIFD.Copyright] = 'FilmTag by Jeffrey Chu | ' + 'Processed by ' + p.lab + ' (' + p.process + ') | Scanned via ' + p.scanner;
            var gps2 = gpsData[idx];
            if (gps2) {
              exifObj['GPS'] = exifObj['GPS'] || {};
              exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = toDms(gps2.lat);
              exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = gps2.lat >= 0 ? 'N' : 'S';
              exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = toDms(gps2.lng);
              exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = gps2.lng >= 0 ? 'E' : 'W';
            }
            var exifBytes = piexif.dump(exifObj);
            var newStr = piexif.insert(exifBytes, jpegStr);
            p.dateTime = dt;
            p.publicDesc = $('public-checkbox').checked;
            newStr = injectXmp(newStr, p, p.lab, p.process, p.scanner);
            bytes = new Uint8Array(newStr.length);
            for (var b2 = 0; b2 < newStr.length; b2++) bytes[b2] = newStr.charCodeAt(b2) & 0xFF;
          } catch(err) { console.warn('EXIF write failed', err); }
        }

        zip.file(nn, bytes, { binary: true });
        processedFiles.push({ name: nn, blob: new Blob([bytes], { type: entry.file.type || 'image/jpeg' }) });
        completed++;
        active--;
        progBar.style.width = Math.round((completed / total) * 100) + '%';
        progText.textContent = t('processing_of', {i: completed, n: total});
        startNext();
      };
      reader.readAsArrayBuffer(entry.file);
    }

    startNext();
  }

  imgOverlayClose.addEventListener('click', function() { imgOverlay.classList.remove('show'); });
  imgOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });

  clearLocBtn.addEventListener('click', function() {
    var keys = Object.keys(selectedSet);
    for (var k = 0; k < keys.length; k++) delete gpsData[keys[k]];
    if (refs.mapMarker) { refs.map.removeLayer(refs.mapMarker); refs.mapMarker = null; updateGpsSaveBtn(); }
    updateGpsDots();
  });

  selectAllBtn.addEventListener('click', function() {
    if (Object.keys(selectedSet).length > 0) {
      selectedSet = {};
    } else {
      for (var i = 0; i < uploadedFiles.length; i++) selectedSet[i] = true;
    }
    renderFileList();
  });

  editDateBtn.addEventListener('click', function() { dateOverlay.classList.add('show'); });
  editGpsBtn.addEventListener('click', function() {
    gpsOverlay.classList.add('show');
    setTimeout(function() { refs.mapEl.style.height = '280px'; initMap(); updateGpsSaveBtn(); }, 100);
  });
  dateCancelBtn.addEventListener('click', function() { dateOverlay.classList.remove('show'); });
  gpsCancelBtn.addEventListener('click', function() { gpsOverlay.classList.remove('show'); });
  dateSaveBtn.addEventListener('click', function() { applyDateToSelected(); dateOverlay.classList.remove('show'); });
  gpsSaveBtn.addEventListener('click', function() {
    if (refs.mapMarker) {
      var latLng = refs.mapMarker.getLatLng();
      setGpsForSelected(latLng.lat, latLng.lng);
    }
    gpsOverlay.classList.remove('show');
  });
  gpsOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });

  mapSearchBtn.addEventListener('click', function() {
    var q = mapSearchInput.value.trim();
    if (!q || !refs.map) return;
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q))
      .then(function(r) { return r.json(); })
      .then(function(results) {
        if (!results.length) return;
        var lat = parseFloat(results[0].lat), lng = parseFloat(results[0].lon);
        refs.map.setView([lat, lng], 15);
        if (refs.mapMarker) refs.mapMarker.setLatLng([lat, lng]);
        else refs.mapMarker = L.marker([lat, lng]).addTo(refs.map);
        setGpsForSelected(lat, lng);
        updateGpsSaveBtn();
      })
      .catch(function() {});
  });
  mapSearchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') mapSearchBtn.click();
  });

  // Show gallery overlay with processed files, per-file save buttons, and ZIP download
  function showGallery(files, params, zip) {
    galleryTitle.textContent = t('files_ready', {n: files.length});
    galleryGrid.innerHTML = '';
    for (var i = 0; i < files.length; i++) {
      (function(f) {
        var item = document.createElement('div');
        item.className = 'gallery-item';

        var canvas = document.createElement('canvas');
        canvas.width = 150; canvas.height = 150;
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function() {
          var scale = Math.min(150 / img.width, 150 / img.height);
          var w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (150 - w) / 2, (150 - h) / 2, w, h);
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(f.blob);
        canvas.addEventListener('click', function(e) {
          e.stopPropagation();
          var url = URL.createObjectURL(f.blob);
          imgOverlayImg.src = url;
          imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
          imgOverlay.classList.add('show');
        });
        item.appendChild(canvas);

        var nameEl = document.createElement('div');
        nameEl.className = 'g-name'; nameEl.textContent = f.name;
        item.appendChild(nameEl);

        var saveBtn2 = document.createElement('button');
        saveBtn2.className = 'g-save-btn'; saveBtn2.textContent = t('save');
        saveBtn2.addEventListener('click', function() {
          var file = new File([f.blob], f.name, { type: 'image/jpeg' });
          if (/iPhone|iPad|Android/.test(navigator.userAgent) && navigator.share) {
            navigator.share({ files: [file] }).catch(function(){});
          } else {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(f.blob);
            a.download = f.name;
            a.click();
          }
        });
        item.appendChild(saveBtn2);
        galleryGrid.appendChild(item);
      })(files[i]);
    }
    gallery.classList.add('show');

    galleryZipBtn.onclick = function() {
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'filmtag_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      });
    };

    var newBtn = $('gallery-new-btn');
    if (newBtn) newBtn.onclick = function() {
      gallery.classList.add('fade-out');
      setTimeout(function() { history.scrollRestoration = 'manual'; location.reload(); }, 300);
    };
  }

  // Display a transient status message (success/error) above the file list
  function showStatus(msg, type) {
    statusMsg.textContent = msg; statusMsg.className = 'status-msg ' + type; statusMsg.style.display = 'block';
  }

  $('reset-btn').addEventListener('click', function() {
    var ss = document.querySelectorAll('select');
    for (var i = 0; i < ss.length; i++) { ss[i].selectedIndex = 0; ss[i].dispatchEvent(new Event('change')); }
    var ins = document.querySelectorAll('input[type="text"], input[type="number"]');
    for (var j = 0; j < ins.length; j++) ins[j].value = '';
    singleDateInp.valueAsDate = new Date(); singleTimeInp.value = '12:00';
    uploadedFiles = [];
    summaryPanel.classList.remove('show'); summaryBody.innerHTML = ''; summaryPage = 1;
    gallery.classList.remove('show'); galleryGrid.innerHTML = '';
    dateOverlay.classList.remove('show'); gpsOverlay.classList.remove('show');
    gpsData = {}; selectedSet = {}; fileDates = {};
    if (refs.mapMarker) { refs.map.removeLayer(refs.mapMarker); refs.mapMarker = null; }
    refs.mapInitialized = false;
    progressSec.classList.remove('show'); progBar.style.width = '0%';
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';
    updateLensUI(); refreshSegments();
  });

  updateLensUI();

  document.querySelectorAll('.section-collapse-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var target = document.getElementById(header.dataset.target);
      var icon = header.querySelector('.collapse-icon');
      target.classList.toggle('collapsed');
      icon.classList.toggle('open');
    });
  });

  document.querySelectorAll('.file-sub-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var target = document.getElementById(header.dataset.target);
      var icon = header.querySelector('.collapse-icon');
      target.classList.toggle('collapsed');
      icon.classList.toggle('open');
    });
  });

  applyTranslations();

  $('lang-float-btn').addEventListener('click', function() {
    toggleLang();
    document.querySelectorAll('select option[value="__custom__"]').forEach(function(opt) {
      opt.textContent = t('other_free_text');
    });
    summaryPanel.classList.remove('show');
    summaryBody.innerHTML = ''; summaryPage = 1;
    gallery.classList.remove('show');
    galleryGrid.innerHTML = '';
    dateOverlay.classList.remove('show'); gpsOverlay.classList.remove('show');
    refreshSegments();
    renderFileList();
  });

  $('easter-egg-btn').addEventListener('click', function() {
    $('egg-overlay').classList.add('show');
  });
  $('egg-close').addEventListener('click', function() {
    $('egg-overlay').classList.remove('show');
  });
  $('egg-overlay').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
  });
})();
