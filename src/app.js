import piexif from 'piexifjs';
import JSZip from 'jszip';
import DATA from '../data.json';
import { t, setLang, toggleLang, applyTranslations, lang } from './i18n.js';
import { toDms, strToUtf8Binary, toUcs2Binary, injectXmp, escXml, esc, fmtSize, dmsToDecimal, newFilmPrefix } from './lib/utils.js';
import { initGear, fillSelect, fillSelectWithCustom, saveCustomOpts, setupCustom, updateLensUI, collect, validate } from './modules/gear.js';
import { initGps, initMap, updateGpsDots, updateGpsSaveBtn, setGpsForSelected, reverseGeocode } from './modules/gps.js';
import { init as initUi, renderFileList, goToPage, changePageSize, goToSummaryPage, changeSummaryPageSize, clearAll, removeOne, getTotalPages, buildSummaryHtml, generateSummaryThumbnails, rebuildSummaryBody, buildOptions, syncRange, buildSelectedFromRanges } from './modules/ui.js';
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
  S.saveCustomOpts = saveCustomOpts;
  S.startZipProcess = startZipProcess; S.startSaveProcess = startSaveProcess;
  S.showStatus = showStatus; S.initMap = initMap;
  window.clearAll = clearAll; window.removeOne = removeOne;
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
    S.mapInitialized = false; progressSec.classList.remove('show'); progBar.style.width = '0%';
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';
    updateLensUI(); refreshSegments();
  });

  updateLensUI();
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
  $('easter-egg-btn').addEventListener('click', function() { $('egg-overlay').classList.add('show'); });
  $('egg-close').addEventListener('click', function() { $('egg-overlay').classList.remove('show'); });
  $('egg-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
})();
