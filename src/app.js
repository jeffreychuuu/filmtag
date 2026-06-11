import piexif from 'piexifjs';
import JSZip from 'jszip';
import DATA from '../data.json';
import { t, setLang, toggleLang, applyTranslations, lang } from './i18n.js';

function toDms(coord) {
  var abs = Math.abs(coord);
  var d = Math.floor(abs);
  var m = Math.floor((abs - d) * 60);
  var s = Math.round(((abs - d) * 60 - m) * 60 * 100);
  return [[d, 1], [m, 1], [s, 100]];
}

// Register custom EXIF tags used by exiftool -Instructions
piexif.TAGS.Exif[0x828D] = { name: 'Instructions', type: 'Ascii' };

function strToUtf8Binary(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c < 0x800) {
      out += String.fromCharCode(0xC0 | (c >> 6));
      out += String.fromCharCode(0x80 | (c & 0x3F));
    } else if (c >= 0xD800 && c < 0xE000) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
      out += String.fromCharCode(0xF0 | (cp >> 18));
      out += String.fromCharCode(0x80 | ((cp >> 12) & 0x3F));
      out += String.fromCharCode(0x80 | ((cp >> 6) & 0x3F));
      out += String.fromCharCode(0x80 | (cp & 0x3F));
      i++;
    } else {
      out += String.fromCharCode(0xE0 | (c >> 12));
      out += String.fromCharCode(0x80 | ((c >> 6) & 0x3F));
      out += String.fromCharCode(0x80 | (c & 0x3F));
    }
  }
  return out;
}

function toUcs2Binary(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    out += String.fromCharCode(c & 0xFF, (c >> 8) & 0xFF);
  }
  return out;
}

// Inject XMP Label, Credit, and Description into JPEG binary string
function injectXmp(jpegStr, params, lab, process, scanner) {
  var xmpXML = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about=""' +
    ' xmlns:xmp="http://ns.adobe.com/xap/1.0/"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"' +
    ' xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">' +
    '<xmp:Label>' + escXml(params.film.name + ' (' + params.pushpull + ')') + '</xmp:Label>' +
    '<xmp:Creator>' + escXml(params.author) + '</xmp:Creator>' +
    '<photoshop:Credit>' + escXml('Processed by ' + lab + ' (' + process + ') | Scanned via ' + scanner) + '</photoshop:Credit>' +
    '<xmp:DateCreated>' + escXml(params.dateTime) + '</xmp:DateCreated>' +
    '<dc:creator>' + escXml(params.author) + '</dc:creator>' +
    (params.publicDesc ? '<dc:description>' + escXml('FilmTag by Jeffrey Chu | Photo by ' + params.author + ' | Camera: ' + params.camera.model + ' (' + params.lens.name + ') | Film: ' + params.film.name + ' (ISO ' + params.film.iso + ')' + (params.camera.shutter ? ' | Shutter: ' + params.camera.shutter : '') + ' | Lab: ' + lab + ' | Process: ' + process + ' (' + params.pushpull + ') | Scanner: ' + scanner) + '</dc:description>' : '<dc:description>' + escXml('Photo by ' + params.author + ' | Camera: ' + params.camera.model + ' (' + params.lens.name + ') | Film: ' + params.film.name + ' (ISO ' + params.film.iso + ')' + (params.camera.shutter ? ' | Shutter: ' + params.camera.shutter : '') + ' | Lab: ' + lab + ' | Process: ' + process + ' (' + params.pushpull + ') | Scanner: ' + scanner) + '</dc:description>') +
    '</rdf:Description>' +
    '</rdf:RDF>' +
    '</x:xmpmeta>' +
    '<?xpacket end="w"?>';

  var xmpUtf8 = strToUtf8Binary(xmpXML);
  var xmpData = 'http://ns.adobe.com/xap/1.0/\x00' + xmpUtf8;
  var segLen = xmpData.length + 2;
  var xmpSegment = '\xFF\xE1' +
    String.fromCharCode(segLen >> 8, segLen & 0xFF) +
    xmpData;

  // Remove existing XMP APP1 segments
  var cleaned = '';
  var pos = 0;
  while (pos < jpegStr.length) {
    if (jpegStr.charCodeAt(pos) === 0xFF && jpegStr.charCodeAt(pos + 1) === 0xE1 &&
        jpegStr.slice(pos + 4, pos + 33) === 'http://ns.adobe.com/xap/1.0/\x00') {
      var segLen2 = (jpegStr.charCodeAt(pos + 2) << 8) | jpegStr.charCodeAt(pos + 3);
      pos += 2 + segLen2;
    } else {
      cleaned += jpegStr.charAt(pos);
      pos++;
    }
  }

  if (cleaned.charCodeAt(0) === 0xFF && cleaned.charCodeAt(1) === 0xD8) {
    return cleaned.slice(0, 2) + xmpSegment + cleaned.slice(2);
  }
  return cleaned;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
  var gpsData = {}, selectedSet = {}, thumbnailCache = {}, geocodeCache = {}, geocodeQueue = [], geocodeBusy = false, map = null, mapMarker = null, mapInitialized = false;
  var isIPhone = /iPhone|iPad/.test(navigator.userAgent);

  var currentPage = 1, pageSize = 5, prefetchTimer = null;
  var summaryPage = 1, summaryPageSize = 5;

  function getTotalPages() {
    if (pageSize === 0) return 1;
    return Math.ceil(uploadedFiles.length / pageSize) || 1;
  }
  function goToPage(p) {
    if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
    currentPage = Math.max(1, Math.min(p, getTotalPages()));
    renderFileList();
  }
  function changePageSize(s) {
    if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
    pageSize = parseInt(s, 10);
    currentPage = 1;
    renderFileList();
  }

  function getSummaryTotalPages() {
    if (summaryPageSize === 0) return 1;
    return Math.ceil(uploadedFiles.length / summaryPageSize) || 1;
  }
  function goToSummaryPage(p) {
    summaryPage = Math.max(1, Math.min(p, getSummaryTotalPages()));
    rebuildSummaryBody();
  }
  function changeSummaryPageSize(s) {
    summaryPageSize = parseInt(s, 10);
    summaryPage = 1;
    rebuildSummaryBody();
  }

  var summaryPanel = $('summary-overlay'), summaryBody = $('summary-body');
  var progressSec = $('progress-overlay'), progBar = $('progress-bar'), progText = $('progress-text');
  var statusMsg = $('status-msg');
  var loadingEl = $('loading-overlay'), loadingText = $('loading-text');

  // Populate all select elements from DATA
  function fillSelect(sel, items) {
    for (var i = 0; i < items.length; i++) {
      var o = document.createElement('option');
      o.textContent = items[i];
      sel.appendChild(o);
    }
  }
  function fillSelectWithCustom(sel, items, key) {
    fillSelect(sel, items);
    if (key) {
      var saved = loadSavedOpt(key);
      for (var i = 0; i < saved.length; i++) {
        var o = document.createElement('option');
        o.textContent = saved[i]; sel.appendChild(o);
      }
    }
    var oo = document.createElement('option');
    oo.value = '__custom__'; oo.textContent = t('other_free_text'); sel.appendChild(oo);
  }

  function loadSavedOpt(key) {
    try {
      var data = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}');
      return data[key] || [];
    } catch(_) { return []; }
  }
  function loadSavedLensesForCamera(cameraModel) {
    try {
      var data = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}');
      if (data.lensByCamera && data.lensByCamera[cameraModel]) return data.lensByCamera[cameraModel];
      return data.lensName || [];
    } catch(_) { return []; }
  }
  function currentCameraModel() {
    if (cameraSel.value === '__custom__') return $('camera-model-custom').value.trim();
    if (cameraSel.selectedIndex < CAMERAS.length) return CAMERAS[cameraSel.selectedIndex].model;
    return cameraSel.value;
  }

  function saveCustomOpts() {
    var data = {};
    try { data = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}'); } catch(_) {}
    var fields = [
      {sel: authorSel, inp: $('author-custom-input'), key: 'author'},
      {sel: cameraSel, inp: $('camera-model-custom'), key: 'cameraModel'},
      {sel: lensSel, inp: $('lens-name-custom'), key: 'lensName'},
      {sel: filmSel, inp: $('film-name-custom'), key: 'filmName'},
      {sel: labSel, inp: $('lab-custom-input'), key: 'lab'},
      {sel: scanSel, inp: $('scanner-custom-input'), key: 'scanner'},
      {sel: ppSel, inp: $('pushpull-custom-input'), key: 'pushPull'}
    ];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].sel.value === '__custom__' && fields[i].inp.value.trim()) {
        var v = fields[i].inp.value.trim();
        if (!data[fields[i].key]) data[fields[i].key] = [];
        if (fields[i].key === 'lensName') {
          var cameraModel = currentCameraModel();
          if (!cameraModel) continue;
          if (!data.lensByCamera) data.lensByCamera = {};
          if (!data.lensByCamera[cameraModel]) data.lensByCamera[cameraModel] = [];
          data.lensByCamera[cameraModel] = data.lensByCamera[cameraModel].filter(function(x) { return x.name !== v; });
          data.lensByCamera[cameraModel].unshift({ name: v, focal: $('lens-focal').value.trim(), aperture: $('lens-aperture').value.trim() });
          data.lensByCamera[cameraModel] = data.lensByCamera[cameraModel].slice(0, 5);
        } else {
          if (!data[fields[i].key]) data[fields[i].key] = [];
          data[fields[i].key] = data[fields[i].key].filter(function(x) { return x !== v; });
          data[fields[i].key].unshift(v);
          data[fields[i].key] = data[fields[i].key].slice(0, 5);
        }
      }
    }
    localStorage.setItem('filmtag-custom-opts', JSON.stringify(data));
  }
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
    var savedFilms = loadSavedOpt('filmName');
    for (var si = 0; si < savedFilms.length; si++) {
      var o2 = document.createElement('option');
      o2.textContent = savedFilms[si]; filmSel.appendChild(o2);
    }
    var oo = document.createElement('option');
    oo.value = '__custom__'; oo.textContent = t('other_free_text'); filmSel.appendChild(oo);
  })();

  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function setupCustom(sel, cust) {
    function toggle() { cust.classList.toggle('show', sel.value === '__custom__'); }
    sel.addEventListener('change', toggle);
    toggle();
  }
  setupCustom(authorSel, authorCust);
  setupCustom(cameraSel, cameraCust);
  setupCustom(labSel, labCust);
  setupCustom(ppSel, ppCust);
  setupCustom(scanSel, scanCust);
  setupCustom(filmSel, filmCust);

  function populateLenses(idx) {
    lensSel.innerHTML = '';
    CAMERAS[idx].lenses.forEach(function(l, i) {
      var o = document.createElement('option'); o.value = i; o.textContent = l.name; lensSel.appendChild(o);
    });
    var savedLenses = loadSavedLensesForCamera(CAMERAS[idx].model);
    for (var si = 0; si < savedLenses.length; si++) {
      var o2 = document.createElement('option');
      if (typeof savedLenses[si] === 'object') {
        o2.textContent = savedLenses[si].name;
        if (savedLenses[si].focal) o2.setAttribute('data-focal', savedLenses[si].focal);
        if (savedLenses[si].aperture) o2.setAttribute('data-aperture', savedLenses[si].aperture);
      } else {
        o2.textContent = savedLenses[si];
      }
      lensSel.appendChild(o2);
    }
    var oo = document.createElement('option');
    oo.value = '__custom__'; oo.textContent = t('other_free_text'); lensSel.appendChild(oo);
  }
  function updateLensUI() {
    if (cameraSel.value === '__custom__') {
      lensDrop.style.display = 'none'; lensCust.classList.add('show'); lensSel.value = '__custom__';
    } else if (cameraSel.selectedIndex >= CAMERAS.length) {
      lensDrop.style.display = 'block';
      lensSel.innerHTML = '';
      var savedLenses = loadSavedLensesForCamera(cameraSel.value);
      for (var si = 0; si < savedLenses.length; si++) {
        var o = document.createElement('option');
        if (typeof savedLenses[si] === 'object') {
          o.textContent = savedLenses[si].name;
          if (savedLenses[si].focal) o.setAttribute('data-focal', savedLenses[si].focal);
          if (savedLenses[si].aperture) o.setAttribute('data-aperture', savedLenses[si].aperture);
        } else {
          o.textContent = savedLenses[si];
        }
        lensSel.appendChild(o);
      }
      var oo = document.createElement('option');
      oo.value = '__custom__'; oo.textContent = t('other_free_text'); lensSel.appendChild(oo);
      lensCust.classList.remove('show');
    } else {
      lensDrop.style.display = 'block'; populateLenses(cameraSel.selectedIndex);
      lensCust.classList.toggle('show', lensSel.value === '__custom__');
    }
  }
  cameraSel.addEventListener('change', updateLensUI);
  lensSel.addEventListener('change', function() {
    if (cameraSel.value === '__custom__') return;
    lensCust.classList.toggle('show', lensSel.value === '__custom__');
  });

  singleDateInp.valueAsDate = new Date();
  singleTimeInp.value = '12:00';

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

  function refreshSegments() {
    renderFileList();
    reviewBtn.disabled = uploadedFiles.length === 0;
  }

  fileInp.addEventListener('change', function(e) { handleFiles(e.target.files); fileInp.value = ''; });
  uploadWrap.addEventListener('dragover', function(e) { e.preventDefault(); uploadWrap.classList.add('dragover'); });
  uploadWrap.addEventListener('dragleave', function() { uploadWrap.classList.remove('dragover'); });
  uploadWrap.addEventListener('drop', function(e) { e.preventDefault(); uploadWrap.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

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

  function dmsToDecimal(dms, ref) {
    if (!dms || dms.length < 3) return null;
    var deg = dms[0][0] / dms[0][1];
    var min = dms[1][0] / dms[1][1];
    var sec = dms[2][0] / dms[2][1];
    var dec = deg + min / 60 + sec / 3600;
    if (ref === 'S' || ref === 'W') dec = -dec;
    return dec;
  }

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

  function computeDateForFile(idx) {
    if (clearedDates[idx - 1]) return null;
    var fd = fileDates[idx - 1];
    if (fd) {
      var ds = fd.fileDate;
      return { date: ds.slice(0,4) + '/' + ds.slice(4,6) + '/' + ds.slice(6,8), time: String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') };
    }
    var now = new Date();
    var d = now.getFullYear().toString() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    return { date: d.slice(0,4) + '/' + d.slice(4,6) + '/' + d.slice(6,8), time: '12:00' };
  }

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
    function pump() {
      while (active < concurrency && next < end) {
        var idx = next++; active++;
        processFile(idx);
      }
      if (active === 0 && next >= end) {
        prefetchTimer = setTimeout(function() { startPrefetch(fromPage + 1); }, 50);
      }
    }
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

  function thumbnailClick(e) {
    e.stopPropagation();
    var url = URL.createObjectURL(e.target._thumbFile);
    imgOverlayImg.src = url;
    imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
    imgOverlay.classList.add('show');
  }

  function bindFileItemClicks() {
    var items = document.querySelectorAll('.file-item');
    for (var k = 0; k < items.length; k++) {
      items[k].removeEventListener('click', fileItemClick);
      items[k].addEventListener('click', fileItemClick);
    }
  }

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

  function clearAll() {
    uploadedFiles = [];
    gpsData = {}; selectedSet = {}; thumbnailCache = {}; geocodeCache = {}; fileDates = {}; clearedDates = {};
    currentPage = 1;
    if (mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
    refreshSegments();
  }
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

  function buildOptions(max, selected, excludeSet) {
    var h = '';
    for (var i = 1; i <= max; i++) {
      if (excludeSet && excludeSet[i]) continue;
      var sel = i === selected ? ' selected' : '';
      h += '<option value="' + i + '"' + sel + '>' + i + '</option>';
    }
    return h;
  }

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

  function selText(sel) { return sel.options[sel.selectedIndex].text; }
  function getVal(sel, inp) { return sel.value === '__custom__' ? inp.value.trim() : selText(sel); }
  function camInfo() {
    if (cameraSel.value === '__custom__' || cameraSel.selectedIndex >= CAMERAS.length) {
      var model = cameraSel.value === '__custom__' ? ($('camera-model-custom').value.trim() || t('unknown')) : cameraSel.value;
      return { make: $('camera-make-custom').value.trim() || t('unknown'), model: model, shutter: null };
    }
    var c = CAMERAS[cameraSel.selectedIndex]; return { make: c.make, model: c.model, shutter: c.shutter };
  }
  function lensInfo() {
    if (cameraSel.value === '__custom__' || lensSel.value === '__custom__')
      return { name: $('lens-name-custom').value.trim(), focal: $('lens-focal').value.trim(), aperture: $('lens-aperture').value.trim() };
    if (cameraSel.selectedIndex >= CAMERAS.length || lensSel.selectedIndex >= CAMERAS[cameraSel.selectedIndex].lenses.length) {
      var o = lensSel.options[lensSel.selectedIndex];
      return { name: selText(lensSel), focal: o.getAttribute('data-focal') || '', aperture: o.getAttribute('data-aperture') || '' };
    }
    var l = CAMERAS[cameraSel.selectedIndex].lenses[lensSel.selectedIndex];
    return { name: l.name, focal: l.focal, aperture: l.aperture };
  }
  function filmInfo() {
    if (filmSel.value === '__custom__') return { name: $('film-name-custom').value.trim(), iso: $('film-iso-custom').value.trim() };
    var o = filmSel.options[filmSel.selectedIndex];
    return { name: o.textContent, iso: o.getAttribute('data-iso') };
  }
  function collect() {
    return {
      author: getVal(authorSel, $('author-custom-input')), camera: camInfo(), lens: lensInfo(),
      film: filmInfo(), lab: getVal(labSel, $('lab-custom-input')), process: selText($('process-select')),
      pushpull: getVal(ppSel, $('pushpull-custom-input')), scanner: getVal(scanSel, $('scanner-custom-input'))
    };
  }
  function validate(p) {
    if (!p.author) return t('author_required'); if (!p.lens.name) return t('lens_required');
    if (!p.film.name) return t('film_required'); if (!p.lab) return t('lab_required');
    if (!p.scanner) return t('scanner_required'); return null;
  }

  function getFileDate(i) {
    var fd = fileDates[i];
    if (fd) return fd;
    var now = new Date();
    var d = now.getFullYear().toString() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    return { fileDate: d, exifDate: d.slice(0,4) + ':' + d.slice(4,6) + ':' + d.slice(6,8), hr: (12 + Math.floor(i / 60)) % 24, min: i % 60 };
  }

  function newFilmPrefix(film) {
    return film
      .split(/[^a-zA-Z0-9]+/)
      .filter(function(w) { return w.length > 0; })
      .map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
      .join('');
  }

  function newFName(film, ext, i) {
    var fd = getFileDate(i);
    var c = newFilmPrefix(film);
    return c + '_' + fd.fileDate + String(fd.hr).padStart(2,'0') + String(fd.min).padStart(2,'0') + '_' + String(i + 1).padStart(2,'0') + '.' + ext;
  }

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

  function updateGpsDots() {
    var items = document.querySelectorAll('.file-item');
    for (var j = 0; j < items.length; j++) {
      var i = parseInt(items[j].getAttribute('data-idx'), 10);
      var dot = items[j].querySelector('.file-gps-dot');
      var hasDotGps = gpsData[i];
      if (dot) dot.innerHTML = hasDotGps ? '📍' + (gpsData[i].addr ? ' <span class="gps-addr">' + esc(gpsData[i].addr) + '</span>' : '') : '<img src="no_gps.png" class="no-gps-icon">';
    }
  }

  function setGpsForSelected(lat, lng) {
    var keys = Object.keys(selectedSet);
    if (!keys.length) return;
    for (var k = 0; k < keys.length; k++) {
      gpsData[keys[k]] = { lat: lat, lng: lng, addr: '' };
    }
    updateGpsDots();
    reverseGeocode(lat, lng, keys);
    mapInfoEl.textContent = keys.length + ' photo(s) location set';
  }

  function reverseGeocode(lat, lng, indices) {
    var key = lat.toFixed(5) + ',' + lng.toFixed(5);
    if (geocodeCache[key]) {
      var addr = geocodeCache[key];
      for (var k = 0; k < indices.length; k++) {
        if (gpsData[indices[k]]) gpsData[indices[k]].addr = addr;
      }
      updateGpsDots();
      return;
    }
    for (var q = 0; q < geocodeQueue.length; q++) {
      if (geocodeQueue[q].key === key) {
        for (var k2 = 0; k2 < indices.length; k2++) {
          if (geocodeQueue[q].indices.indexOf(indices[k2]) === -1) {
            geocodeQueue[q].indices.push(indices[k2]);
          }
        }
        return;
      }
    }
    geocodeQueue.push({ key: key, lat: lat, lng: lng, indices: indices.slice() });
    processGeocodeQueue();
  }

  function processGeocodeQueue() {
    if (geocodeBusy || !geocodeQueue.length) return;
    geocodeBusy = true;
    var item = geocodeQueue.shift();
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + item.lat + '&lon=' + item.lng)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var addr = '';
        if (data.address) {
          var p = [];
          if (data.address.road) p.push(data.address.road);
          if (data.address.suburb) p.push(data.address.suburb);
          else if (data.address.city || data.address.town) p.push(data.address.city || data.address.town);
          if (!p.length) addr = data.name || data.display_name || '';
          else addr = p.join(', ');
        }
        geocodeCache[item.key] = addr;
        for (var k = 0; k < item.indices.length; k++) {
          if (gpsData[item.indices[k]]) gpsData[item.indices[k]].addr = addr;
        }
        updateGpsDots();
        geocodeBusy = false;
        setTimeout(processGeocodeQueue, 1000);
      })
      .catch(function() {
        geocodeBusy = false;
        setTimeout(processGeocodeQueue, 1000);
      });
  }

  function initMap() {
    if (!gpsOverlay || !gpsOverlay.classList.contains('show')) return;
    if (mapInitialized) { map.invalidateSize(); return; }
    mapInitialized = true;
    var defPos = [22.3193, 114.1694];
    map = L.map('map').setView(defPos, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        map.setView([pos.coords.latitude, pos.coords.longitude], 13);
      }, function() {});
    }
    map.on('click', function(e) {
      var lat = e.latlng.lat, lng = e.latlng.lng;
      if (mapMarker) mapMarker.setLatLng([lat, lng]);
      else mapMarker = L.marker([lat, lng]).addTo(map);
      setGpsForSelected(lat, lng);
    });
  }

  imgOverlayClose.addEventListener('click', function() { imgOverlay.classList.remove('show'); });
  imgOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });

  clearLocBtn.addEventListener('click', function() {
    var keys = Object.keys(selectedSet);
    for (var k = 0; k < keys.length; k++) delete gpsData[keys[k]];
    if (mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
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
    setTimeout(function() { mapEl.style.height = '280px'; initMap(); }, 100);
  });
  dateCancelBtn.addEventListener('click', function() { dateOverlay.classList.remove('show'); });
  gpsCancelBtn.addEventListener('click', function() { gpsOverlay.classList.remove('show'); });
  dateSaveBtn.addEventListener('click', function() { applyDateToSelected(); dateOverlay.classList.remove('show'); });
  gpsSaveBtn.addEventListener('click', function() { gpsOverlay.classList.remove('show'); });
  gpsOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });

  mapSearchBtn.addEventListener('click', function() {
    var q = mapSearchInput.value.trim();
    if (!q || !map) return;
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q))
      .then(function(r) { return r.json(); })
      .then(function(results) {
        if (!results.length) return;
        var lat = parseFloat(results[0].lat), lng = parseFloat(results[0].lon);
        map.setView([lat, lng], 15);
        if (mapMarker) mapMarker.setLatLng([lat, lng]);
        else mapMarker = L.marker([lat, lng]).addTo(map);
        setGpsForSelected(lat, lng);
      })
      .catch(function() {});
  });
  mapSearchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') mapSearchBtn.click();
  });

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
    if (mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
    mapInitialized = false;
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
