import piexif from 'piexifjs';
import JSZip from 'jszip';
import DATA from '../data.json';
import { t, setLang, toggleLang, applyTranslations, lang } from './i18n.js';
import { toDms, strToUtf8Binary, toUcs2Binary, injectXmp, escXml, esc, fmtSize, dmsToDecimal, newFilmPrefix } from './lib/utils.js';
import { initGear, fillSelect, fillSelectWithCustom, saveCustomOpts, setupCustom, updateLensUI, collect, validate, saveLastSession, restoreLastSession, renderManageOverlay, setDefaultItems } from './modules/gear.js';
import { initGps, initMap, updateGpsDots, updateGpsSaveBtn, setGpsForSelected, reverseGeocode } from './modules/gps.js';
import { init as initUi, renderFileList, goToPage, changePageSize, goToSummaryPage, changeSummaryPageSize, clearAll, removeOne, sortFiles, toggleSort, getTotalPages, buildSummaryHtml, generateSummaryThumbnails, rebuildSummaryBody, buildOptions, syncRange, buildSelectedFromRanges } from './modules/ui.js';
import { init as initDate, applyDateToSelected, refreshSegments, computeDateForFile, getFileDate, newFName } from './modules/date.js';
import { init as initUpload, handleFiles } from './modules/upload.js';
import { init as initProcess, startZipProcess, startSaveProcess, startContentSheet, showGallery, showStatus } from './modules/process.js';

piexif.TAGS.Exif[0x828D] = { name: 'Instructions', type: 'Ascii' };

var APP_VERSION = typeof FILMTAG_VERSION !== 'undefined' ? FILMTAG_VERSION : 'dev';
document.addEventListener('DOMContentLoaded', function() {
  var el = document.getElementById('version');
  if (el) el.textContent = 'v' + APP_VERSION;
  var _vc = 0, _vt;
  if (el) el.addEventListener('click', function(e) {
    e.preventDefault();
    _vc++;
    if (_vt) clearTimeout(_vt);
    _vt = setTimeout(function() { _vc = 0; }, 2000);
    if (_vc >= 5) { 
      _vc = 0; 
      var ao = document.getElementById('admin-overlay');
      if (ao) {
        var savedKey = localStorage.getItem('filmtag-admin-key');
        if (savedKey) {
          document.getElementById('admin-login').style.display = 'none';
          document.getElementById('admin-panel').style.display = 'block';
          document.getElementById('admin-loading').style.display = 'block';
          document.getElementById('admin-feedback-list').innerHTML = '';
          fetch('/api/feedback?key=' + encodeURIComponent(savedKey), { cache: 'no-cache' }).then(function(r) { return r.json(); }).then(function(data) {
            document.getElementById('admin-loading').style.display = 'none';
            var items = data && data.items ? data.items : data;
            if (!items || !items.length) { document.getElementById('admin-feedback-list').innerHTML = '<p style="color:var(--text-secondary);">No feedback yet.</p>'; return; }
            var h = '';
            for (var i = items.length - 1; i >= 0; i--) {
              var it = items[i];
              h += '<div class="admin-feedback-item" style="padding:0.75rem;border-bottom:1px solid var(--border);font-size:0.8rem;" data-id="' + esc(it.id) + '"><div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.3rem;"><span>' + (it.type === 'bug' ? '🐛' : '💡') + '</span><strong>' + esc(it.title) + '</strong><span style="margin-left:auto;color:var(--text-secondary);font-size:0.7rem;">' + new Date(it.ts).toLocaleDateString() + '</span></div><p style="color:#aaa;margin:0 0 0.3rem 1.2rem;">' + esc(it.desc) + '</p>' + (it.email ? '<p style="color:var(--text-secondary);margin:0 0 0 1.2rem;font-size:0.7rem;">' + esc(it.email) + '</p>' : '') + '<button class="btn btn-sm btn-danger admin-del-btn" data-id="' + esc(it.id) + '" style="margin-top:0.3rem;font-size:0.7rem;">🗑️ Delete</button></div>';
            }
            document.getElementById('admin-feedback-list').innerHTML = h || '<p style="color:var(--text-secondary);">No feedback yet.</p>';
          }).catch(function() { document.getElementById('admin-loading').style.display = 'none'; document.getElementById('admin-feedback-list').innerHTML = '<p style="color:var(--text-secondary);">No feedback yet.</p>'; });
        }
        ao.classList.add('show');
      }
    }
  });
});

(function() {
  fetch('/api/count').then(function(r) { return r.json(); }).then(function(d) {
    var v = document.getElementById('view-count');
    if (v) v.textContent = (d.views || 0).toLocaleString();
    var p = document.getElementById('photo-count');
    if (p) p.textContent = (d.photos || 0).toLocaleString();
  }).catch(function() {});
  fetch('/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'views', amount: 1 }) }).catch(function() {});
})();

(function() {
  if (!localStorage.getItem('filmtag-disclaimer-acknowledged')) {
    var overlay = document.getElementById('disclaimer-overlay');
    if (overlay) {
      overlay.classList.add('show');
      var agreeBtn = document.getElementById('disclaimer-agree');
      var cbAi = document.getElementById('disclaimer-cb-ai');
      var cbNc = document.getElementById('disclaimer-cb-noncommercial');
      function toggleAgree() { agreeBtn.disabled = !(cbAi.checked && cbNc.checked); }
      if (cbAi) cbAi.addEventListener('change', toggleAgree);
      if (cbNc) cbNc.addEventListener('change', toggleAgree);
      agreeBtn.addEventListener('click', function() {
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
  S.currentPage = 1; S.pageSize = 5; S.prefetchTimer = null; S.sortAsc = true;
  S.summaryPage = 1; S.summaryPageSize = 5; S.processedFiles = [];
  S.contentSheetResolution = DATA.contentSheetResolution;
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
  var summaryPanel = $('summary-overlay'), summaryBody = $('summary-body'), summaryFooter = $('summary-footer');
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
  S.summaryPanel = summaryPanel; S.summaryBody = summaryBody; S.summaryFooter = summaryFooter;
  S.progressSec = progressSec; S.progBar = progBar; S.progText = progText;
  S.statusMsg = statusMsg; S.loadingEl = loadingEl; S.loadingText = loadingText;

  initGear(S); initGps(S); initUi(S); initDate(S); initUpload(S); initProcess(S);

  S.renderFileList = renderFileList; S.computeDateForFile = computeDateForFile;
  S.getFileDate = getFileDate; S.newFName = newFName;
  S.refreshSegments = refreshSegments;
  S.collect = collect; S.validate = validate;
  S.saveCustomOpts = saveCustomOpts; S.saveLastSession = saveLastSession;
  S.startZipProcess = startZipProcess; S.startSaveProcess = startSaveProcess; S.startContentSheet = startContentSheet;
  S.showStatus = showStatus; S.initMap = initMap;
  window.clearAll = clearAll; window.removeOne = removeOne; window.sortFiles = sortFiles; window.toggleSort = toggleSort;
  window.goToPage = goToPage; window.changePageSize = changePageSize;
  window.goToSummaryPage = goToSummaryPage; window.changeSummaryPageSize = changeSummaryPageSize;

  fillSelectWithCustom(artistSel, DATA.artists, 'artist');
  fillSelectWithCustom(cameraSel, DATA.cameras.map(function(c) { return c.model; }), 'cameraModel');
  fillSelectWithCustom(labSel, DATA.labs, 'lab');
  fillSelectWithCustom(scanSel, DATA.scanners, 'scanner');
  fillSelectWithCustom(ppSel, DATA.pushpulls, 'pushPull');
  fillSelectWithCustom(processSel, DATA.processes, 'process');
  var filmNames = DATA.films.map(function(f) { return f.name; });
  setDefaultItems('filmName', filmNames);
  (function() {
    filmSel.innerHTML = '';
    var hiddenFilms = JSON.parse(localStorage.getItem('filmtag-hidden-defaults') || '{}').filmName || [];
    for (var i = 0; i < DATA.films.length; i++) {
      if (hiddenFilms.indexOf(DATA.films[i].name) !== -1) continue;
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
    summaryPanel.classList.remove('show'); summaryBody.innerHTML = ''; summaryFooter.innerHTML = ''; S.summaryPage = 1;
    gallery.classList.remove('show'); galleryGrid.innerHTML = '';
    dateOverlay.classList.remove('show'); gpsOverlay.classList.remove('show');
    if (S.mapMarker) { S.map.removeLayer(S.mapMarker); S.mapMarker = null; }
    S.mapInitialized = false; progressSec.classList.remove('show'); progBar.style.width = '0%'; $('progress-next-btn').style.display = 'none'; $('progress-edit-btn').style.display = 'none'; $('progress-spinner').style.display = 'block'; $('progress-done').style.display = 'none';
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';
    var us = document.getElementById('upload-status'); if (us) { us.textContent = ''; us.className = 'upload-status-msg'; }
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
    summaryPanel.classList.remove('show'); summaryBody.innerHTML = ''; summaryFooter.innerHTML = ''; S.summaryPage = 1;
    gallery.classList.remove('show'); galleryGrid.innerHTML = '';
    dateOverlay.classList.remove('show'); gpsOverlay.classList.remove('show');
    refreshSegments(); S.renderFileList();
  });
  $('progress-edit-btn').addEventListener('click', function() { progressSec.classList.remove('show'); $('progress-next-btn').style.display = 'none'; $('progress-edit-btn').style.display = 'none'; $('progress-spinner').style.display = 'block'; $('progress-done').style.display = 'none'; window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('progress-next-btn').addEventListener('click', function() { progressSec.classList.remove('show'); progBar.style.width = '0%'; $('progress-next-btn').style.display = 'none'; $('progress-spinner').style.display = 'block'; $('progress-done').style.display = 'none'; location.reload(); });
  $('easter-egg-btn').addEventListener('click', function() { $('egg-overlay').classList.add('show'); });
  $('egg-close').addEventListener('click', function() { $('egg-overlay').classList.remove('show'); });
  $('egg-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  $('help-float-btn').addEventListener('click', showTutorial);
  $('feedback-float-btn').addEventListener('click', function() {
    $('feedback-title').value = ''; $('feedback-desc').value = ''; $('feedback-email').value = '';
    $('feedback-submit').disabled = true;
    $('feedback-overlay').classList.add('show');
  });
  $('feedback-cancel').addEventListener('click', function() { $('feedback-overlay').classList.remove('show'); });
  $('feedback-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  function toggleFeedbackSubmit() {
    var t = $('feedback-title').value.trim();
    var d = $('feedback-desc').value.trim();
    var e = $('feedback-email').value.trim();
    var validEmail = !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    $('feedback-email-error').style.display = e && !validEmail ? 'block' : 'none';
    $('feedback-submit').disabled = !t || !d || !validEmail;
  }
  $('feedback-title').addEventListener('input', toggleFeedbackSubmit);
  $('feedback-desc').addEventListener('input', toggleFeedbackSubmit);
  $('feedback-email').addEventListener('input', toggleFeedbackSubmit);
  $('feedback-submit').addEventListener('click', function() {
    fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      type: $('feedback-type').value, title: $('feedback-title').value.trim(), desc: $('feedback-desc').value.trim(), email: $('feedback-email').value.trim()
    }) }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.ok) {
        $('feedback-title').value = ''; $('feedback-desc').value = ''; $('feedback-email').value = '';
        $('feedback-overlay').classList.remove('show');
        $('feedback-success-overlay').classList.add('show');
      } else { S.showStatus(t('feedback_error'), 'error'); }
    }).catch(function() { S.showStatus(t('feedback_error'), 'error'); });
  });
  $('feedback-success-close').addEventListener('click', function() { $('feedback-success-overlay').classList.remove('show'); });
  $('feedback-success-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  $('admin-close').addEventListener('click', function() { $('admin-overlay').classList.remove('show'); $('admin-panel').style.display = 'none'; $('admin-login').style.display = 'block'; $('admin-error').style.display = 'none'; });
  function openManageOverlay(key) {
    renderManageOverlay(key);
    $('manage-overlay').classList.add('show');
  }
  $('manage-btn').addEventListener('click', function() { renderManageOverlay(); $('manage-overlay').classList.add('show'); });
  document.querySelectorAll('.manage-field-btn').forEach(function(el) {
    el.addEventListener('click', function() { openManageOverlay(this.getAttribute('data-manage')); });
  });
  $('manage-close-btn').addEventListener('click', function() { $('manage-overlay').classList.remove('show'); });
  $('manage-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  $('admin-unlock-btn').addEventListener('click', function() {
    var key = $('admin-key-input').value.trim();
    if (!key) { $('admin-error').textContent = 'Please enter an admin key.'; $('admin-error').style.display = 'block'; return; }
    $('admin-error').style.display = 'none';
    $('admin-login').style.display = 'none';
    $('admin-loading').style.display = 'block';
    $('admin-panel').style.display = 'block';
    fetch('/api/feedback?key=' + encodeURIComponent(key), { cache: 'no-cache' }).then(function(r) {
      if (r.status === 401) {
        $('admin-loading').style.display = 'none';
        $('admin-panel').style.display = 'none';
        $('admin-login').style.display = 'block';
        $('admin-error').textContent = 'Invalid admin key.';
        $('admin-error').style.display = 'block';
        return null;
      }
      return r.json();
    }).then(function(data) {
      $('admin-loading').style.display = 'none';
      if (!data) return;
      var items = data.items || data;
      if (!items || !items.length) {
        $('admin-feedback-list').innerHTML = '<p style="color:var(--text-secondary);">No feedback yet.</p>';
        return;
      }
      localStorage.setItem('filmtag-admin-key', key);
      var h = '';
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        h += '<div class="admin-feedback-item" style="padding:0.75rem;border-bottom:1px solid var(--border);font-size:0.8rem;" data-id="' + esc(it.id) + '">' +
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.3rem;">' +
          '<span>' + (it.type === 'bug' ? '🐛' : '💡') + '</span>' +
          '<strong>' + esc(it.title) + '</strong>' +
          '<span style="margin-left:auto;color:var(--text-secondary);font-size:0.7rem;">' + new Date(it.ts).toLocaleDateString() + '</span>' +
          '</div>' +
          '<p style="color:#aaa;margin:0 0 0.3rem 1.2rem;">' + esc(it.desc) + '</p>' +
          (it.email ? '<p style="color:var(--text-secondary);margin:0 0 0 1.2rem;font-size:0.7rem;">' + esc(it.email) + '</p>' : '') +
          '<button class="btn btn-sm btn-danger admin-del-btn" data-id="' + esc(it.id) + '" style="margin-top:0.3rem;font-size:0.7rem;">🗑️ Delete</button>' +
          '</div>';
      }
      $('admin-feedback-list').innerHTML = h || '<p style="color:var(--text-secondary);">No feedback yet.</p>';
    }).catch(function() {
      $('admin-loading').style.display = 'none';
      $('admin-panel').style.display = 'none';
      $('admin-login').style.display = 'block';
      $('admin-error').textContent = 'Failed to connect to server.';
      $('admin-error').style.display = 'block';
    });
  });
  $('admin-panel').addEventListener('click', function(e) {
    var btn = e.target.closest('.admin-del-btn');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var key = localStorage.getItem('filmtag-admin-key');
    if (!confirm('Delete this feedback?')) return;
    fetch('/api/feedback?key=' + encodeURIComponent(key) + '&id=' + encodeURIComponent(id), { method: 'DELETE', cache: 'no-cache' }).then(function(r) { return r.json(); }).then(function(d) {
      if (!d.ok) { S.showStatus('Delete failed', 'error'); return; }
      $('admin-loading').style.display = 'block';
      $('admin-feedback-list').innerHTML = '';
      fetch('/api/feedback?key=' + encodeURIComponent(key), { cache: 'no-cache' }).then(function(r) { return r.json(); }).then(function(data) {
        $('admin-loading').style.display = 'none';
        var items = data && data.items ? data.items : data;
        if (!items || !items.length) { $('admin-feedback-list').innerHTML = '<p style="color:var(--text-secondary);">No feedback yet.</p>'; return; }
        var h = '';
        for (var i = items.length - 1; i >= 0; i--) {
          var it = items[i];
          h += '<div class="admin-feedback-item" style="padding:0.75rem;border-bottom:1px solid var(--border);font-size:0.8rem;" data-id="' + esc(it.id) + '">' +
            '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.3rem;">' +
            '<span>' + (it.type === 'bug' ? '🐛' : '💡') + '</span>' +
            '<strong>' + esc(it.title) + '</strong>' +
            '<span style="margin-left:auto;color:var(--text-secondary);font-size:0.7rem;">' + new Date(it.ts).toLocaleDateString() + '</span>' +
            '</div>' +
            '<p style="color:#aaa;margin:0 0 0.3rem 1.2rem;">' + esc(it.desc) + '</p>' +
            (it.email ? '<p style="color:var(--text-secondary);margin:0 0 0 1.2rem;font-size:0.7rem;">' + esc(it.email) + '</p>' : '') +
            '<button class="btn btn-sm btn-danger admin-del-btn" data-id="' + esc(it.id) + '" style="margin-top:0.3rem;font-size:0.7rem;">🗑️ Delete</button>' +
            '</div>';
        }
        $('admin-feedback-list').innerHTML = h;
      }).catch(function() { $('admin-loading').style.display = 'none'; $('admin-feedback-list').innerHTML = '<p style="color:var(--text-secondary);">No feedback yet.</p>'; });
    }).catch(function() { S.showStatus('Delete failed', 'error'); });
  });
  $('tutorial-close').addEventListener('click', function() { $('tutorial-overlay').classList.remove('show'); });
  $('tutorial-got-it').addEventListener('click', function() { localStorage.setItem('filmtag-tutorial-seen', '1'); $('tutorial-overlay').classList.remove('show'); });
  $('tutorial-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
})();

function showTutorial() {
  var isZh = lang === 'zh';
  var aboutSteps = [
    { icon: '📖', t: 'Origin', tZh: '起源', d: "FilmTag started as a CLI tool for myself and a few friends — I'm a film photography beginner who happens to write code for a living, and I just wanted an easy way to tag my scans with proper metadata. Before a trip, I worried that a lab might send scans back while I was away, so I turned it into a web app I could use from anywhere.", dZh: '起初只係寫咗個命令行工具俾自己同朋友用——我本身係菲林攝影入門者，咁啱又係做程式開發，純粹想有個方便嘅方法幫掃描檔加返相片資訊。後尾準備去旅行，驚沖掃舖喺旅行期間傳返啲掃描檔過嚟冇得整理，就索性整咗個網站出嚟，自己喺外地都處理得到。' },
    { icon: '⚙️', t: 'Built-in Presets', tZh: '內建設定', d: 'The default equipment options (cameras, lenses, films, labs) are my personal presets. You can type anything custom — your entries are saved to your browser (localStorage) and show up next time.', dZh: '預設嘅設備選項（相機、鏡頭、菲林、沖掃）係我平時用開嘅設定。你可以隨意自訂任何選項，你嘅自訂資料會儲存喺你嘅瀏覽器 (localStorage)，下次會自動出現。' },
    { icon: '⚙️', t: 'Custom Options', tZh: '自訂選項', d: 'Each field (Artist, Camera, Lens, Film, Lab, etc.) has a ⚙️ icon next to its label. Click it to open Custom Options with that section expanded — hide presets you don\'t need, delete old custom entries, or restore all defaults. Changes save to your browser and dropdowns update instantly.', dZh: '每個欄位（Artist、Camera、Lens、Film、Lab 等）嘅 label 隔籬都有 ⚙️ 圖示。撳佢會打開自訂選項並展開對應嘅 section — 隱藏你用唔著嘅 preset、刪除舊自訂選項、或者一鍵顯示所有預設。改完即時更新下拉選單，唔使 reload。' },
    { icon: '🔒', t: 'Your Privacy', tZh: '你的私隱', d: 'Everything stays in your browser (localStorage). Your custom options, last-used settings, and photos — none of it is ever sent to any server. Even I cannot see your photos or settings.', dZh: '所有資料只會留喺你嘅瀏覽器 (localStorage)。你嘅自訂選項、上次嘅設定、同埋你啲相 — 全部唔會送去任何伺服器。連我（開發者）都睇唔到你嘅任何設定同相片。' },
    { icon: '🏷️', t: 'What EXIF Gets Written', tZh: '會寫入什麼 EXIF', d: 'Camera make/model · Lens name & specs · ISO · Focal length · Aperture · Shutter speed · Date & time · GPS coordinates & address · Artist · Copyright · Image description. XMP metadata is also injected: Label, Creator, Credit, DateCreated.', dZh: '相機品牌/型號 · 鏡頭名稱/規格 · ISO · 焦距 · 光圈 · 快門 · 攝影日期時間 · GPS 座標/地址 · 攝影師 · 版權 · 圖片說明。同時也會寫入 XMP 標籤：Label、Creator、Credit、DateCreated。', img: 'img/gphoto_web.png' },
    { icon: '🔍', t: 'Google Photos Ordering', tZh: 'Google Photos 排序', d: 'Google Photos sorts by the EXIF DateTimeOriginal tag. After processing, every photo has its correct shooting time written into EXIF. Your entire roll appears in the right order in Google Photos, Apple Photos, and any app that reads EXIF dates — no more messy ordering.', dZh: 'Google Photos 是依據 EXIF 裡的 DateTimeOriginal 來排序的。處理後，每張相都有正確的拍攝時間。整卷菲林在 Google Photos、Apple Photos 和所有支援 EXIF 的應用程式裡都會以正確的順序顯示，唔會再排到亂嗮。' }
  ];
  var guideSteps = [
    { icon: '📤', t: 'Upload Photos', tZh: '上傳相片', d: 'Click the upload area or drag & drop your JPEG files. Thumbnails and EXIF data are extracted automatically.', dZh: '點擊上傳區域或是直接 drag & drop JPEG 檔案，縮圖和 EXIF 資料會自動提取。' },
    { icon: '📍', t: 'Set GPS Location', tZh: '設定 GPS 位置', d: 'Select files, click "Set GPS Location", then search or drop a pin on the map. Coordinates and address are written into EXIF.', dZh: '選擇檔案，點擊「設定 GPS 位置」，然後搜尋地址或點擊地圖落針。座標和地址會寫入 EXIF。' },
    { icon: '🤚', t: 'Sort & Reorder', tZh: '排序與重新排列', d: 'Use the ▼ A→Z / ▲ Z→A button to toggle sort order. Or drag & drop files anywhere. Order matters: it controls the sequence number in filenames (_01, _02…) and the +1 minute timestamp increment.', dZh: '用 ▼ A→Z / ▲ Z→A 按鈕切換排序方向。也可以直接拖動檔案到任何位置。排列順序會控制檔案名的序列號 (_01、_02…) 和每張相的時間戳分配。' },
    { icon: '📷', t: 'Set Your Equipment', tZh: '設定你的設備', d: 'Choose Camera, Lens, Film Stock, Lab, Developing Process, Push/Pull, and Scanner from the dropdowns. Custom entries are saved to your browser (localStorage) and show up next time.', dZh: '從下拉選單選擇相機、鏡頭、菲林、沖掃、沖洗方式、Push/Pull、掃描器。自訂輸入會儲存喺你嘅瀏覽器 (localStorage)，下次會自動出現。' },
    { icon: '⚙️', t: 'Custom Options', tZh: '自訂選項', d: 'Each dropdown has a ⚙️ icon next to its label. Click it to manage that field\'s entries — hide built-in presets you don\'t use, or delete old custom ones. "Show all defaults" restores everything. This replaces the old global "Custom Options" button.', dZh: '每個下拉選單嘅 label 側邊都有 ⚙️ 圖示。撳佢可以管理該欄位嘅選項 — 隱藏你用唔著嘅內建 preset，或者刪除舊自訂選項。「顯示所有預設」一鍵恢復所有選項。' },
    { icon: '📅', t: 'Set Date & Time', tZh: '設定攝影日期時間', d: 'Select one or more files, click "Set Date & Time". Each file automatically gets +1 minute added. You can set up multiple time segments — even on the same day — so photos from different rolls or shooting sessions stay in the right order.', dZh: '選擇一個或多個檔案，點擊「設定日期時間」。每張相會自動加 +1 分鐘。你可以設定多個時間段，就算同一日唔同時間影嘅相都可以分開處理。' },
    { icon: '📋', t: 'Review & Process', tZh: '檢閱與處理', d: 'Click "Review Summary" to check all settings and preview new filenames. Then choose "Download ZIP" (downloads all files at once) or "Save to Album" (save individually on iOS).', dZh: '點擊「Review Summary」檢查所有設定和新檔案名。然後選擇「下載 ZIP」（一次下載全部檔案）或「儲存到相簿」（iOS 個別儲存）。' },
    { icon: '☑️', t: 'Content Sheet', tZh: '索引樣片', d: 'Toggle "Include Content Sheet" ON in Review Summary to auto-generate a content sheet JPEG in your ZIP or gallery. You can also download it standalone via "Download Content Sheet". It shows thumbnails, file numbers, and a footer with film, camera, lens, lab, and date range.', dZh: '喺 Review Summary toggle「包含索引樣片」，自動生成一張 content sheet JPEG 加入 ZIP 或 gallery。你亦可以獨立按「下載索引樣片」。張 content sheet 會顯示縮圖、編號、同 footer（菲林、相機、鏡頭、沖曬店、日期範圍）。' }
  ];
  function renderSteps(steps) {
    var html = '';
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var s = steps[i];
      var showTxt = isZh ? '📷 睇例子' : '📷 Show example';
      var hideTxt = isZh ? '📷 收起例子' : '📷 Hide example';
      html += '<div class="tutorial-step"><div class="ts-icon">' + s.icon + '</div><div><div class="ts-title">' + (isZh ? s.tZh : s.t) + '</div><div class="ts-desc">' + (isZh ? s.dZh : s.d) + '</div>' + (s.img ? '<button class="btn btn-sm btn-secondary tutorial-img-btn" onclick="var i=this.nextElementSibling;i.style.display=i.style.display===\'none\'?\'block\':\'none\';this.textContent=this.textContent===\'' + showTxt + '\'?\'' + hideTxt + '\':\'' + showTxt + '\'">' + showTxt + '</button><img src="' + s.img + '" class="tutorial-img" style="display:none;">' : '') + '</div></div>';
    }
    return html;
  }
  document.getElementById('tutorial-about').innerHTML = renderSteps(aboutSteps);
  document.getElementById('tutorial-guide').innerHTML = renderSteps(guideSteps);
  document.getElementById('tutorial-got-it').textContent = isZh ? '🎉 明白了！' : '🎉 Got it!';
  var tabBtns = document.querySelectorAll('.tutorial-tab');
  if (tabBtns.length >= 2) {
    tabBtns[0].textContent = isZh ? 'ℹ️ 關於' : 'ℹ️ About';
    tabBtns[1].textContent = isZh ? '📖 使用教學' : '📖 How to Use';
  }
  document.getElementById('tutorial-overlay').classList.add('show');
  var tabs = document.querySelectorAll('.tutorial-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
      document.querySelectorAll('.tutorial-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      document.querySelectorAll('.tutorial-panel').forEach(function(p) { p.style.display = 'none'; });
      document.getElementById('tutorial-' + this.getAttribute('data-tab')).style.display = 'block';
    });
  }
}
