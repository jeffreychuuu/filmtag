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
    (params.publicDesc ? '<dc:description>' + escXml('FilmTag by Jeffrey Chu — Photo by ' + params.author + ' | Camera: ' + params.camera.model + ' (' + params.lens.name + ') | Film: ' + params.film.name + ' (ISO ' + params.film.iso + ')' + (params.camera.shutter ? ' | Shutter: ' + params.camera.shutter : '') + ' | Lab: ' + lab + ' | Process: ' + process + ' (' + params.pushpull + ') | Scanner: ' + scanner) + '</dc:description>' : '<dc:description>' + escXml('Photo by ' + params.author + ' | Camera: ' + params.camera.model + ' (' + params.lens.name + ') | Film: ' + params.film.name + ' (ISO ' + params.film.iso + ')' + (params.camera.shutter ? ' | Shutter: ' + params.camera.shutter : '') + ' | Lab: ' + lab + ' | Process: ' + process + ' (' + params.pushpull + ') | Scanner: ' + scanner) + '</dc:description>') +
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
  var sameDateSel = $('same-date-select');
  var singleDG = $('single-date-group'), multiDG = $('multi-date-group');
  var segContainer = $('seg-container'), segCount = $('seg-file-count'), addSegBtn = $('add-seg-btn');
  var singleDateInp = $('single-date-input'), singleTimeInp = $('single-time-input');
  var fileInp = $('file-input'), uploadWrap = $('upload-wrap');
  var fileListEl = $('file-list'), reviewBtn = $('review-btn');
  var gallery = $('gallery'), galleryGrid = $('gallery-grid'), galleryTitle = $('gallery-title');
  var galleryZipBtn = $('gallery-zip-btn');
  var gpsSection = $('gps-section'), mapEl = $('map'), mapInfoEl = $('map-info'), clearLocBtn = $('clear-location-btn');
  var gpsModeSelect = $('gps-mode-select'), selectAllBtn = $('select-all-btn');
  var gpsControls = $('gps-controls');
  var mapSearchInput = $('map-search-input'), mapSearchBtn = $('map-search-btn');
  var imgOverlay = $('img-overlay'), imgOverlayImg = $('img-overlay-img'), imgOverlayClose = $('img-overlay-close');
  var gpsData = {}, selectedSet = {}, map = null, mapMarker = null, mapInitialized = false;
  var isIPhone = /iPhone|iPad/.test(navigator.userAgent);

  function branding() {
    return $('branding-checkbox').checked ? 'FilmTag by Jeffrey Chu' : '';
  }
  var summaryPanel = $('summary-panel'), summaryBody = $('summary-body');
  var progressSec = $('progress-section'), progBar = $('progress-bar'), progText = $('progress-text');
  var statusMsg = $('status-msg');

  // Populate all select elements from DATA
  function fillSelect(sel, items) {
    for (var i = 0; i < items.length; i++) {
      var o = document.createElement('option');
      o.textContent = items[i];
      sel.appendChild(o);
    }
  }
  function fillSelectWithCustom(sel, items) {
    fillSelect(sel, items);
    var oo = document.createElement('option');
    oo.value = '__custom__'; oo.textContent = t('other_free_text'); sel.appendChild(oo);
  }
  fillSelectWithCustom(authorSel, DATA.authors);

  fillSelectWithCustom(cameraSel, DATA.cameras.map(function(c) { return c.model; }));
  fillSelectWithCustom(labSel, DATA.labs);
  fillSelectWithCustom(scanSel, DATA.scanners);
  fillSelectWithCustom(ppSel, DATA.pushpulls);
  fillSelect($('process-select'), DATA.processes);

  (function() {
    filmSel.innerHTML = '';
    for (var i = 0; i < DATA.films.length; i++) {
      var o = document.createElement('option');
      o.textContent = DATA.films[i].name;
      o.setAttribute('data-iso', DATA.films[i].iso);
      filmSel.appendChild(o);
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
    var oo = document.createElement('option');
    oo.value = '__custom__'; oo.textContent = t('other_free_text'); lensSel.appendChild(oo);
  }
  function updateLensUI() {
    if (cameraSel.value === '__custom__') {
      lensDrop.style.display = 'none'; lensCust.classList.add('show');
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

  sameDateSel.addEventListener('change', function() {
    if (sameDateSel.value === 'yes') { singleDG.style.display = 'block'; multiDG.style.display = 'none'; }
    else {
      singleDG.style.display = 'none'; multiDG.style.display = 'block';
      if (segContainer.children.length === 0) addSegment();
      refreshSegments();
    }
  });

  function makeSegCard(start) {
    var total = uploadedFiles.length || 36;
    var defEnd = Math.min(start + 35, total);
    var card = document.createElement('div');
    card.className = 'segment-card';
    card.innerHTML =
      '<div class="seg-label">' + t('files_range', {s: start, e: defEnd}) + '</div>' +
      '<div style="margin-bottom:0.5rem;"><label>' + t('end_file_index') + '</label>' +
      '<input type="number" class="seg-end" min="' + start + '" max="' + total + '" value="' + defEnd + '"></div>' +
      '<div class="field-group">' +
      '<div><label>' + t('shoot_date') + '</label><input type="date" class="seg-date"></div>' +
      '<div><label>' + t('start_time') + '</label><input type="time" class="seg-time" value="12:00"></div>' +
      '</div>' +
      '<button class="btn btn-danger" style="margin-top:0.5rem;" type="button">' + t('remove') + '</button>';
    card.querySelector('.seg-end').addEventListener('change', refreshSegments);
    card.querySelector('button').addEventListener('click', function() { card.remove(); refreshSegments(); });
    return card;
  }

  function refreshSegments() {
    var total = uploadedFiles.length || 36;
    var cards = segContainer.querySelectorAll('.segment-card');
    var cum = 0;
    for (var i = 0; i < cards.length; i++) {
      var se = cards[i].querySelector('.seg-end');
      var ev = parseInt(se.value, 10);
      if (isNaN(ev) || ev <= 0) ev = total;
      var st = cum + 1; if (ev < st) ev = st; if (ev > total) ev = total;
      se.value = ev; se.min = st; se.max = total;
      cards[i].querySelector('.s1').textContent = st;
      cards[i].querySelector('.s2').textContent = ev;
      cards[i].querySelector('.seg-label').textContent = t('files_range', {s: st, e: ev});
      cum = ev;
    }
    segCount.textContent = uploadedFiles.length > 0 ? t('total_uploaded', {n: uploadedFiles.length}) : '';
    renderFileList();
    reviewBtn.disabled = uploadedFiles.length === 0;
  }

  function addSegment() {
    var cards = segContainer.querySelectorAll('.segment-card');
    var st = cards.length === 0 ? 1 : (parseInt(cards[cards.length - 1].querySelector('.seg-end').value, 10) || (uploadedFiles.length || 36)) + 1;
    segContainer.appendChild(makeSegCard(st));
    refreshSegments();
  }
  addSegBtn.addEventListener('click', addSegment);
  singleDateInp.valueAsDate = new Date();

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
    refreshSegments();
  }

  function renderFileList() {
    if (uploadedFiles.length === 0) {
      fileListEl.innerHTML = ''; reviewBtn.disabled = true;
      segCount.textContent = '';
    gpsSection.style.display = 'none';
    gpsControls.style.display = 'none';
    gpsModeSelect.value = 'off';

      return;
    }
    segCount.textContent = t('total_uploaded', {n: uploadedFiles.length});
    var h = '<div class="file-list-header"><span>' + t('file_count', {n: uploadedFiles.length}) + '</span>' +
      '<button class="btn btn-sm btn-danger" onclick="clearAll()">' + t('clear_all') + '</button></div>';
    for (var i = 0; i < uploadedFiles.length; i++) {
      var f = uploadedFiles[i];
      var sel = selectedSet[i] ? ' selected' : '';
      var hasGps = gpsModeSelect.value === 'on' && gpsData[i];
      var addrTxt = hasGps && gpsData[i].addr ? ' <span class="gps-addr">' + esc(gpsData[i].addr) + '</span>' : '';
      var dot = hasGps ? '📍' + addrTxt : '<img src="no_gps.png" class="no-gps-icon">';
      h += '<div class="file-item' + sel + '" data-idx="' + i + '">' +
        '<canvas class="file-thumb" data-idx="' + i + '" width="40" height="40"></canvas>' +
        '<div class="fidx">#' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="fname">' + esc(f.file.name) + '</div>' +
        '<div class="fsize">' + fmtSize(f.file.size) + '</div>' +
        '<span class="file-gps-dot">' + dot + '</span>' +
        '<button class="remove-btn" onclick="removeOne(' + i + ')">✕</button>' +
        '</div>';
    }
    fileListEl.innerHTML = h;
    generateThumbnails();
    bindFileItemClicks();
    gpsSection.style.display = 'block';
    initMap();
  }

  function generateThumbnails() {
    for (var i = 0; i < uploadedFiles.length; i++) {
      var c = document.querySelector('canvas.file-thumb[data-idx="' + i + '"]');
      if (!c) continue;
      (function(canvas, file) {
        var img = new Image();
        img.onload = function() {
          var s = Math.min(40 / img.width, 40 / img.height);
          var w = img.width * s, h = img.height * s;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, (40 - w) / 2, (40 - h) / 2, w, h);
        };
        img.src = URL.createObjectURL(file);
        canvas.removeEventListener('click', thumbnailClick);
        canvas.addEventListener('click', thumbnailClick);
        canvas._thumbFile = file;
      })(c, uploadedFiles[i].file);
    }
  }

  function thumbnailClick(e) {
    e.stopPropagation();
    imgOverlayImg.src = URL.createObjectURL(e.target._thumbFile);
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
    var keys = Object.keys(selectedSet);
    selectAllBtn.textContent = keys.length === uploadedFiles.length ? t('select_all') + ' (All)' : t('select_all');
  }

  function clearAll() {
    uploadedFiles = [];
    gpsData = {}; selectedSet = {};
    if (mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
    refreshSegments();
  }
  function removeOne(i) {
    uploadedFiles.splice(i, 1);
    var newGps = {}, newSel = {};
    for (var j = 0; j < uploadedFiles.length; j++) {
      var oldIdx = j < i ? j : j + 1;
      if (gpsData[oldIdx]) newGps[j] = gpsData[oldIdx];
      if (selectedSet[oldIdx]) newSel[j] = true;
    }
    gpsData = newGps; selectedSet = newSel;
    refreshSegments();
  }
  window.clearAll = clearAll; window.removeOne = removeOne;

  function selText(sel) { return sel.options[sel.selectedIndex].text; }
  function getVal(sel, inp) { return sel.value === '__custom__' ? inp.value.trim() : selText(sel); }
  function camInfo() {
    if (cameraSel.value === '__custom__') return { make: $('camera-make-custom').value.trim() || t('unknown'), model: $('camera-model-custom').value.trim() || t('unknown'), shutter: null };
    var c = CAMERAS[cameraSel.selectedIndex]; return { make: c.make, model: c.model, shutter: c.shutter };
  }
  function lensInfo() {
    if (cameraSel.value === '__custom__' || lensSel.value === '__custom__')
      return { name: $('lens-name-custom').value.trim(), focal: $('lens-focal').value.trim(), aperture: $('lens-aperture').value.trim() };
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
  function getSegments(total) {
    if (sameDateSel.value === 'yes') {
      var dv = singleDateInp.value, tv = singleTimeInp.value;
      if (!dv) return null;
      var ed = dv.replace(/-/g, ':'), fd = dv.replace(/-/g, '');
      var p = tv.split(':'), h = parseInt(p[0], 10) || 0, m = parseInt(p[1], 10) || 0;
      return [{ start: 1, end: total > 0 ? total : 36, fileDate: fd, exifDate: ed, startHour: h, startMin: m }];
    }
    var cards = segContainer.querySelectorAll('.segment-card');
    if (!cards.length) return null;
    var sgs = [];
    for (var i = 0; i < cards.length; i++) {
      var de = cards[i].querySelector('.seg-date'), te = cards[i].querySelector('.seg-time');
      if (!de.value || !te.value) return null;
      var ed2 = de.value.replace(/-/g, ':'), fd2 = de.value.replace(/-/g, '');
      var p2 = te.value.split(':'), h2 = parseInt(p2[0], 10) || 0, m2 = parseInt(p2[1], 10) || 0;
      sgs.push({ start: sgs.length ? sgs[sgs.length - 1].end + 1 : 1, end: parseInt(cards[i].querySelector('.seg-end').value, 10) || total,
        fileDate: fd2, exifDate: ed2, startHour: h2, startMin: m2 });
    }
    return sgs.length ? sgs : null;
  }
  function segForIdx(sgs, idx) { for (var i = 0; i < sgs.length; i++) { if (idx >= sgs[i].start && idx <= sgs[i].end) return sgs[i]; } return sgs[0]; }
  function calcTS(seg, idx) {
    var off = idx - seg.start, min = seg.startMin + off, hr = seg.startHour + Math.floor(min / 60);
    min %= 60; hr %= 24;
    return { hr: hr, min: min, str: String(hr).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00' };
  }
  function newFName(film, seg, idx, hr, min, ext) {
    var c = film
      .split(/[^a-zA-Z0-9]+/)
      .filter(function(w) { return w.length > 0; })
      .map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
      .join('');
    return c + '_' + seg.fileDate + String(hr).padStart(2, '0') + String(min).padStart(2, '0') + '_' + String(idx).padStart(2, '0') + '.' + ext;
  }

  reviewBtn.addEventListener('click', function() {
    var p = collect();
    var err = validate(p); if (err) { showStatus(err, 'error'); return; }
    var sgs = getSegments(uploadedFiles.length);
    if (!sgs) { showStatus(t('date_required'), 'error'); return; }

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
    html += '<table class="rename-table"><tr><th>' + t('col_index') + '</th><th>' + t('col_original') + '</th><th>' + t('col_new_name') + '</th></tr>';
    for (var j = 0; j < uploadedFiles.length; j++) {
      var idx = j + 1, seg2 = segForIdx(sgs, idx), ts = calcTS(seg2, idx);
      var ext = uploadedFiles[j].file.name.split('.').pop().toLowerCase();
      var nn = newFName(p.film.name, seg2, idx, ts.hr, ts.min, ext);
      html += '<tr><td style="color:#555;">' + idx + '</td><td class="old-name">' + esc(uploadedFiles[j].file.name) + '</td><td class="new-name">' + esc(nn) + '</td></tr>';
    }
    html += '</table></div>';
    html += '<div class="actions" style="margin-top:1rem;">' +
      '<button class="btn btn-primary" id="confirm-save-btn">' + t('save_to_album') + '</button>' +
      '<button class="btn btn-primary" id="confirm-zip-btn">' + t('download_zip') + '</button></div>';

    summaryBody.innerHTML = html;
    summaryPanel.classList.add('show');
    summaryPanel.scrollIntoView({ behavior: 'smooth' });
    $('confirm-zip-btn').addEventListener('click', startZipProcess);
    $('confirm-save-btn').addEventListener('click', startSaveProcess);
  });

  $('summary-close-btn').addEventListener('click', function() { summaryPanel.classList.remove('show'); });

  function startZipProcess() {
    summaryPanel.classList.remove('show');
    var p = collect(), sgs = getSegments(uploadedFiles.length);
    if (!sgs) return showStatus(t('date_error'), 'error');

    reviewBtn.disabled = true;
    progressSec.style.display = 'block';
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';

    var total = uploadedFiles.length, zip = new JSZip();

    function doOne(i) {
      if (i >= total) {
        progText.textContent = t('creating_zip');
        zip.generateAsync({ type: 'blob' }).then(function(blob) {
          var url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url;
          a.download = 'filmtag_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip';          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          progBar.style.width = '100%'; progText.textContent = t('done_processed', {n: total});
          showStatus(t('processed_success', {n: total}), 'success');
          reviewBtn.disabled = false;
          setTimeout(function() { progressSec.style.display = 'none'; progBar.style.width = '0%'; }, 3000);
        });
        return;
      }
      var entry = uploadedFiles[i], idx = i + 1, seg = segForIdx(sgs, idx);
      var ts = calcTS(seg, idx), ext = entry.file.name.split('.').pop().toLowerCase();
      var nn = newFName(p.film.name, seg, idx, ts.hr, ts.min, ext);

      progBar.style.width = Math.round(((i + 1) / total) * 100) + '%';
      progText.textContent = t('processing_of', {i: i + 1, n: total});

      var reader = new FileReader();
      reader.onload = function(e) {
        var bytes = new Uint8Array(e.target.result);

        if (ext === 'jpg' || ext === 'jpeg') {
          try {
            var jpegStr = '';
            for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]);

            var exifObj;
            try { exifObj = piexif.load(jpegStr); } catch(_) {
              exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null };
            }

            exifObj['0th'][piexif.ImageIFD.Make] = p.camera.make;
            exifObj['0th'][piexif.ImageIFD.Model] = p.camera.model;
            exifObj['0th'][piexif.ImageIFD.Artist] = p.author;
            var brand = branding();
            exifObj['0th'][piexif.ImageIFD.Software] = brand ? p.scanner + ' (FilmTag by Jeffrey Chu)' : p.scanner;
            exifObj['Exif'][0x828D] = p.process + ' (' + p.pushpull + ')';

            var dateTimeStr = seg.exifDate + ' ' + ts.str + '+08:00';
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
              (brand ? 'FilmTag by Jeffrey Chu — ' : '') +
              'Photo by ' + p.author + ' | Camera: ' + p.camera.model + ' (' + p.lens.name + ') | Film: ' + p.film.name +
              ' (ISO ' + p.film.iso + ')' + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') +
              ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' (' + p.pushpull + ') | Scanner: ' + p.scanner;
            exifObj['0th'][piexif.ImageIFD.Copyright] =
              (brand ? 'FilmTag by Jeffrey Chu | ' : '') +
              'Processed by ' + p.lab + ' (' + p.process + ') | Scanned via ' + p.scanner;

            var gps = gpsModeSelect.value === 'on' ? gpsData[i] : null;
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
        doOne(i + 1);
      };
      reader.readAsArrayBuffer(entry.file);
    }
    doOne(0);
  }

  var processedFiles = [];

  function startSaveProcess() {
    summaryPanel.classList.remove('show');
    var p = collect(), sgs = getSegments(uploadedFiles.length);
    if (!sgs) return showStatus(t('date_error'), 'error');

    reviewBtn.disabled = true;
    progressSec.style.display = 'block';
    statusMsg.className = 'status-msg'; statusMsg.style.display = 'none';
    processedFiles = [];

    var total = uploadedFiles.length, zip = new JSZip();

    function doOne(i) {
      if (i >= total) {
        progText.textContent = t('done_processed', {n: total});
        progressSec.style.display = 'none';
        reviewBtn.disabled = false;
        showGallery(processedFiles, p, zip);
        return;
      }
      var entry = uploadedFiles[i], idx = i + 1, seg = segForIdx(sgs, idx);
      var ts = calcTS(seg, idx), ext = entry.file.name.split('.').pop().toLowerCase();
      var nn = newFName(p.film.name, seg, idx, ts.hr, ts.min, ext);

      progBar.style.width = Math.round(((i + 1) / total) * 100) + '%';
      progText.textContent = t('processing_of', {i: i + 1, n: total});

      var reader = new FileReader();
      reader.onload = function(e) {
        var bytes = new Uint8Array(e.target.result);

        if (ext === 'jpg' || ext === 'jpeg') {
          try {
            var jpegStr = '';
            for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]);
            var exifObj;
            try { exifObj = piexif.load(jpegStr); } catch(_) {
              exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null };
            }
            exifObj['0th'][piexif.ImageIFD.Make] = p.camera.make;
            exifObj['0th'][piexif.ImageIFD.Model] = p.camera.model;
            exifObj['0th'][piexif.ImageIFD.Artist] = p.author;
            var brand = branding();
            exifObj['0th'][piexif.ImageIFD.Software] = brand ? p.scanner + ' (FilmTag by Jeffrey Chu)' : p.scanner;
            var dt = seg.exifDate + ' ' + ts.str + '+08:00';
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
              (brand ? 'FilmTag by Jeffrey Chu — ' : '') +
              'Photo by ' + p.author + ' | Camera: ' + p.camera.model + ' (' + p.lens.name + ') | Film: ' + p.film.name + ' (ISO ' + p.film.iso + ')' + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' (' + p.pushpull + ') | Scanner: ' + p.scanner;
            exifObj['0th'][piexif.ImageIFD.Copyright] = (brand ? 'FilmTag by Jeffrey Chu | ' : '') + 'Processed by ' + p.lab + ' (' + p.process + ') | Scanned via ' + p.scanner;
            var gps2 = gpsModeSelect.value === 'on' ? gpsData[i] : null;
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
            newStr = injectXmp(newStr, p, p.lab, p.process, p.scanner);
            bytes = new Uint8Array(newStr.length);
            for (var b2 = 0; b2 < newStr.length; b2++) bytes[b2] = newStr.charCodeAt(b2) & 0xFF;
          } catch(err) { console.warn('EXIF write failed', err); }
        }

        zip.file(nn, bytes, { binary: true });
        processedFiles.push({ name: nn, blob: new Blob([bytes], { type: entry.file.type || 'image/jpeg' }) });
        doOne(i + 1);
      };
      reader.readAsArrayBuffer(entry.file);
    }
    doOne(0);
  }

  function updateGpsDots() {
    var items = document.querySelectorAll('.file-item');
    for (var j = 0; j < items.length; j++) {
      var i = parseInt(items[j].getAttribute('data-idx'), 10);
      var dot = items[j].querySelector('.file-gps-dot');
      var hasDotGps = gpsModeSelect.value === 'on' && gpsData[i];
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
    mapInfoEl.textContent = keys.length + ' file(s) location set';
    var items = document.querySelectorAll('.file-item');
    for (var j = 0; j < items.length; j++) items[j].classList.remove('selected');
    selectedSet = {};

    selectAllBtn.textContent = t('select_all');
  }

  function reverseGeocode(lat, lng, indices) {
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng)
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
        for (var k = 0; k < indices.length; k++) {
          if (gpsData[indices[k]]) gpsData[indices[k]].addr = addr;
        }
        updateGpsDots();
      })
      .catch(function() {});
  }

  function initMap() {
    if (!gpsSection || gpsSection.style.display === 'none' || gpsControls.style.display === 'none') return;
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

  gpsModeSelect.addEventListener('change', function() {
    if (this.value === 'on') {
      gpsControls.style.display = 'block';
      selectAllBtn.style.display = '';
      updateGpsDots();
      initMap();
    } else {
      gpsControls.style.display = 'none';
      selectAllBtn.style.display = 'none';
      updateGpsDots();
    }
  });

  imgOverlayClose.addEventListener('click', function() { imgOverlay.classList.remove('show'); });
  imgOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });

  clearLocBtn.addEventListener('click', function() {
    var keys = Object.keys(selectedSet);
    for (var k = 0; k < keys.length; k++) delete gpsData[keys[k]];
    if (mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
    updateGpsDots();
    applyTranslations();
  });

  selectAllBtn.addEventListener('click', function() {
    var count = Object.keys(selectedSet).length;
    if (count === uploadedFiles.length) {
      selectedSet = {};
    } else {
      for (var i = 0; i < uploadedFiles.length; i++) selectedSet[i] = true;
    }
    var items = document.querySelectorAll('.file-item');
    for (var j = 0; j < items.length; j++) {
      var idx = parseInt(items[j].getAttribute('data-idx'), 10);
      if (selectedSet[idx]) items[j].classList.add('selected');
      else items[j].classList.remove('selected');
    }
    selectAllBtn.textContent = Object.keys(selectedSet).length === uploadedFiles.length ? t('select_all') + ' (All)' : t('select_all');

  });

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
        };
        img.src = URL.createObjectURL(f.blob);
        item.appendChild(canvas);

        var nameEl = document.createElement('div');
        nameEl.className = 'g-name'; nameEl.textContent = f.name;
        item.appendChild(nameEl);

        var saveBtn2 = document.createElement('button');
        saveBtn2.className = 'g-save-btn'; saveBtn2.textContent = t('save');
        saveBtn2.addEventListener('click', function() {
          var file = new File([f.blob], f.name, { type: 'image/jpeg' });
          if (navigator.share) {
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
    gallery.scrollIntoView({ behavior: 'smooth' });

    galleryZipBtn.onclick = function() {
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'filmtag_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      });
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
    sameDateSel.value = 'yes'; sameDateSel.dispatchEvent(new Event('change'));
    segContainer.innerHTML = ''; uploadedFiles = [];
    summaryPanel.classList.remove('show'); summaryBody.innerHTML = '';
    gallery.classList.remove('show'); galleryGrid.innerHTML = '';
    gpsSection.style.display = 'none';
    gpsControls.style.display = 'none';
    gpsModeSelect.value = 'off';
    selectAllBtn.style.display = 'none';
    gpsData = {}; selectedSet = {};
    if (mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
    mapInitialized = false;
    progressSec.style.display = 'none'; progBar.style.width = '0%';
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

  applyTranslations();

  $('lang-float-btn').addEventListener('click', function() {
    toggleLang();
    document.querySelectorAll('select option[value="__custom__"]').forEach(function(opt) {
      opt.textContent = t('other_free_text');
    });
    summaryPanel.classList.remove('show');
    summaryBody.innerHTML = '';
    gallery.classList.remove('show');
    galleryGrid.innerHTML = '';
    gpsSection.style.display = 'none';
    gpsControls.style.display = 'none';
    gpsModeSelect.value = 'off';
    selectAllBtn.style.display = 'none';
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
