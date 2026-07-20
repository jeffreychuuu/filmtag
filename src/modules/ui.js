import { t } from '../i18n.js';
import { esc, fmtSize, newFilmPrefix } from '../lib/utils.js';

var S;

export function init(refs) { S = refs; }

export function getTotalPages() {
  if (S.pageSize === 0) return 1;
  return Math.ceil(S.uploadedFiles.length / S.pageSize) || 1;
}

export function goToPage(p) {
  if (S.prefetchTimer) { clearTimeout(S.prefetchTimer); S.prefetchTimer = null; }
  S.currentPage = Math.max(1, Math.min(p, getTotalPages()));
  S.renderFileList();
}

export function changePageSize(s) {
  if (S.prefetchTimer) { clearTimeout(S.prefetchTimer); S.prefetchTimer = null; }
  S.pageSize = parseInt(s, 10);
  S.currentPage = 1;
  S.renderFileList();
}

export function getSummaryTotalPages() {
  if (S.summaryPageSize === 0) return 1;
  return Math.ceil(S.uploadedFiles.length / S.summaryPageSize) || 1;
}

export function goToSummaryPage(p) {
  S.summaryPage = Math.max(1, Math.min(p, getSummaryTotalPages()));
  rebuildSummaryBody();
}

export function changeSummaryPageSize(s) {
  S.summaryPageSize = parseInt(s, 10);
  S.summaryPage = 1;
  rebuildSummaryBody();
}

export function renderFileList(skipThumbs) {
  if (S.uploadedFiles.length === 0) {
    S.fileListEl.innerHTML = ''; S.reviewBtn.disabled = true;
    S.selectToolbar.style.display = 'none';
    S.fileActions.style.display = 'none';
    return;
  }
  S.selectToolbar.style.display = 'flex';
  var hasS = Object.keys(S.selectedSet).length > 0;
  S.fileActions.style.display = hasS ? 'flex' : 'none';
  var h = '<div class="file-list-header"><span>' + t('file_count', {n: S.uploadedFiles.length}) + '</span><div>' +
    '<button class="sort-btn" onclick="toggleSort()">' + (S.sortAsc ? '\u25BC A\u2192Z' : '\u25B2 Z\u2192A') + '</button> ' +
    '<button class="btn btn-sm btn-danger" onclick="clearAll()">' + t('clear_all') + '</button></div></div>';
  var start = S.pageSize === 0 ? 0 : (S.currentPage - 1) * S.pageSize;
  var end = S.pageSize === 0 ? S.uploadedFiles.length : Math.min(start + S.pageSize, S.uploadedFiles.length);
  for (var i = start; i < end; i++) {
    var f = S.uploadedFiles[i];
    var sel = S.selectedSet[i] ? ' selected' : '';
    var hasGps = S.gpsData[i];
    var addrTxt = hasGps && S.gpsData[i].addr ? ' <span class="gps-addr">' + esc(S.gpsData[i].addr) + '</span>' : '';
    var dot = hasGps ? '\uD83D\uDCCD' + addrTxt : '<img src="no_gps.png" class="no-gps-icon">';
    var dateInfo = S.computeDateForFile(i + 1);
    var dateDot = dateInfo ? '<span class="date-dot">\uD83D\uDCC5 ' + dateInfo.date + ' ' + dateInfo.time + '</span>' : '<img src="no_date.png" class="no-date-icon">';
    h += '<div class="file-item' + sel + '" data-idx="' + i + '" draggable="true">' +
      '<canvas class="file-thumb" data-idx="' + i + '" width="40" height="40"></canvas>' +
      '<div class="fidx">#' + String(i + 1).padStart(2, '0') + '</div>' +
      '<div class="fname">' + esc(f.file.name) + '</div>' +
      '<div class="fsize">' + fmtSize(f.file.size) + '</div>' +
      '<span class="file-gps-dot">' + dot + '</span>' +
      dateDot +
      '<button class="remove-btn" onclick="removeOne(' + i + ')">\u2715</button>' +
      '</div>';
  }
  h += '<div class="file-list-dropzone"></div>';
  var tp = getTotalPages();
  h += '<div class="pagination">' +
    '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(' + (S.currentPage - 1) + ')"' + (S.currentPage <= 1 ? ' disabled' : '') + '>\u25C0</button>' +
    '<span class="page-info">' + t('page_of', {current: S.currentPage, total: tp}) + '</span>' +
    '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(' + (S.currentPage + 1) + ')"' + (S.currentPage >= tp ? ' disabled' : '') + '>\u25B6</button>' +
    '<select onchange="changePageSize(this.value)">' +
      '<option value="5"' + (S.pageSize === 5 ? ' selected' : '') + '>5</option>' +
      '<option value="10"' + (S.pageSize === 10 ? ' selected' : '') + '>10</option>' +
      '<option value="25"' + (S.pageSize === 25 ? ' selected' : '') + '>25</option>' +
      '<option value="50"' + (S.pageSize === 50 ? ' selected' : '') + '>50</option>' +
      '<option value="0"' + (S.pageSize === 0 ? ' selected' : '') + '>' + t('all') + '</option>' +
    '</select></div>';
  S.fileListEl.innerHTML = h;
  if (!skipThumbs) {
    generateThumbnails(function() {
      S.loadingEl.classList.remove('show');
      startPrefetch(S.currentPage + 1);
    });
  }
  bindFileItemClicks();
  bindDragDrop();
  S.initMap();
  renderRanges();
  S.selectAllBtn.textContent = Object.keys(S.selectedSet).length > 0 ? t('unselect_all') : t('select_all');
  S.fileActions.style.display = hasS ? 'flex' : 'none';
}

function generateThumbnails(onDone) {
  var queue = [], concurrency = 6;
  for (var i = 0; i < S.uploadedFiles.length; i++) {
    (function(idx) {
      var c = document.querySelector('canvas.file-thumb[data-idx="' + idx + '"]');
      if (!c) return;
      c.removeEventListener('click', thumbnailClick);
      c.addEventListener('click', thumbnailClick);
      c._thumbFile = S.uploadedFiles[idx].file;
      if (S.thumbnailCache[idx]) {
        var img = new Image();
        img.onload = function() { c.getContext('2d').drawImage(img, 0, 0, 40, 40); };
        img.src = S.thumbnailCache[idx];
      } else {
        queue.push({ canvas: c, idx: idx, file: S.uploadedFiles[idx].file });
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
      S.thumbnailCache[item.idx] = tmp.toDataURL();
      URL.revokeObjectURL(img.src);
      processNext();
    };
    img.src = URL.createObjectURL(item.file);
  }
  for (var i = 0; i < Math.min(concurrency, queue.length); i++) processNext();
  if (queue.length === 0 && onDone) { var cb = onDone; onDone = null; cb(); }
}

function startPrefetch(fromPage) {
  if (S.prefetchTimer) { clearTimeout(S.prefetchTimer); S.prefetchTimer = null; }
  if (fromPage > getTotalPages() || S.pageSize === 0) return;
  var start = (fromPage - 1) * S.pageSize;
  var end = Math.min(start + S.pageSize, S.uploadedFiles.length);
  var allCached = true;
  for (var i = start; i < end; i++) { if (!S.thumbnailCache[i]) { allCached = false; break; } }
  if (allCached) { S.prefetchTimer = setTimeout(function() { startPrefetch(fromPage + 1); }, 50); return; }
  var active = 0, next = start, concurrency = 2;
  function pump() {
    while (active < concurrency && next < end) { var idx = next++; active++; processFile(idx); }
    if (active === 0 && next >= end) { S.prefetchTimer = setTimeout(function() { startPrefetch(fromPage + 1); }, 50); }
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
        S.thumbnailCache[idx] = tmp.toDataURL();
        URL.revokeObjectURL(img.src);
        active--; pump();
      };
      img.src = URL.createObjectURL(new Blob([e.target.result]));
    };
    reader.readAsArrayBuffer(S.uploadedFiles[idx].file);
  }
  pump();
}

function thumbnailClick(e) {
  e.stopPropagation();
  var url = URL.createObjectURL(e.target._thumbFile);
  S.imgOverlayImg.src = url;
  S.imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
  S.imgOverlay.classList.add('show');
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
  if (S.selectedSet[i]) { delete S.selectedSet[i]; item.classList.remove('selected'); }
  else { S.selectedSet[i] = true; item.classList.add('selected'); }
  S.selectAllBtn.textContent = Object.keys(S.selectedSet).length > 0 ? t('unselect_all') : t('select_all');
  var ct = Object.keys(S.selectedSet).length;
  S.fileActions.style.display = ct ? 'flex' : 'none';
  renderRanges();
}

export function clearAll() {
  S.uploadedFiles = [];
  S.gpsData = {}; S.selectedSet = {}; S.thumbnailCache = {}; S.geocodeCache = {}; S.fileDates = {}; S.clearedDates = {};
  S.currentPage = 1;
  if (S.mapMarker) { S.map.removeLayer(S.mapMarker); S.mapMarker = null; }
  S.refreshSegments();
}

export function removeOne(i) {
  S.uploadedFiles.splice(i, 1);
  var newGps = {}, newSel = {}, newCache = {};
  for (var j = 0; j < S.uploadedFiles.length; j++) {
    var oldIdx = j < i ? j : j + 1;
    if (S.gpsData[oldIdx]) newGps[j] = S.gpsData[oldIdx];
    if (S.selectedSet[oldIdx]) newSel[j] = true;
    if (S.thumbnailCache[oldIdx]) newCache[j] = S.thumbnailCache[oldIdx];
  }
  S.gpsData = newGps; S.selectedSet = newSel; S.thumbnailCache = newCache;
  if (S.currentPage > getTotalPages()) S.currentPage = getTotalPages();
  S.refreshSegments();
  renderRanges();
}

function rekeyDict(dict, a, b) {
  var nd = {};
  for (var k in dict) {
    if (dict.hasOwnProperty(k)) {
      var kk = parseInt(k, 10);
      if (kk === a) nd[b] = dict[k];
      else if (kk === b) nd[a] = dict[k];
      else nd[kk] = dict[k];
    }
  }
  return nd;
}

export function sortFiles(asc) {
  var indices = S.uploadedFiles.map(function(f, i) { return i; });
  indices.sort(function(a, b) {
    return asc ? S.uploadedFiles[a].file.name.localeCompare(S.uploadedFiles[b].file.name) : S.uploadedFiles[b].file.name.localeCompare(S.uploadedFiles[a].file.name);
  });
  var newFiles = [], newGps = {}, newSel = {}, newCache = {}, newFileDates = {}, newClearedDates = {};
  for (var ni = 0; ni < indices.length; ni++) {
    var oi = indices[ni];
    newFiles.push(S.uploadedFiles[oi]);
    if (S.gpsData[oi]) newGps[ni] = S.gpsData[oi];
    if (S.selectedSet[oi]) newSel[ni] = true;
    if (S.thumbnailCache[oi]) newCache[ni] = S.thumbnailCache[oi];
    if (S.fileDates[oi]) newFileDates[ni] = S.fileDates[oi];
    if (S.clearedDates[oi]) newClearedDates[ni] = S.clearedDates[oi];
  }
  S.uploadedFiles = newFiles;
  S.gpsData = newGps; S.selectedSet = newSel; S.thumbnailCache = newCache;
  S.fileDates = newFileDates; S.clearedDates = newClearedDates;
  S.refreshSegments();
  renderRanges();
  S.renderFileList();
}

export function toggleSort() {
  S.sortAsc = !S.sortAsc;
  sortFiles(S.sortAsc);
}

function moveItem(fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  var item = S.uploadedFiles.splice(fromIdx, 1)[0];
  var adjTo = fromIdx < toIdx ? toIdx - 1 : toIdx;
  S.uploadedFiles.splice(adjTo, 0, item);
  function rebuildDict(dict) {
    var nd = {};
    for (var k in dict) {
      if (!dict.hasOwnProperty(k)) continue;
      var oi = parseInt(k, 10);
      if (fromIdx < toIdx) {
        if (oi === fromIdx) nd[adjTo] = dict[k];
        else if (oi > fromIdx && oi <= toIdx - 1) nd[oi - 1] = dict[k];
        else nd[oi] = dict[k];
      } else {
        if (oi === fromIdx) nd[adjTo] = dict[k];
        else if (oi >= toIdx && oi < fromIdx) nd[oi + 1] = dict[k];
        else nd[oi] = dict[k];
      }
    }
    return nd;
  }
  S.gpsData = rebuildDict(S.gpsData);
  S.selectedSet = rebuildDict(S.selectedSet);
  S.thumbnailCache = rebuildDict(S.thumbnailCache);
  S.fileDates = rebuildDict(S.fileDates);
  S.clearedDates = rebuildDict(S.clearedDates);
  S.refreshSegments();
  renderRanges();
  S.renderFileList();
}


var _dragFrom = -1;

function fileDragStart(e) {
  var item = e.target.closest('.file-item');
  if (!item || e.target.closest('.remove-btn')) { e.preventDefault(); return; }
  _dragFrom = parseInt(item.getAttribute('data-idx'), 10);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(_dragFrom));
  item.classList.add('dragging');
}

function fileDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var item = findFileItem(e.target);
  var dz = S.fileListEl.querySelector('.file-list-dropzone');
  if (dz) dz.classList.toggle('show', !item && S.fileListEl.contains(e.target));
}

function findFileItem(el) {
  while (el && !el.classList.contains('file-item')) el = el.parentElement;
  return el;
}

function fileDragEnter(e) {
  var item = findFileItem(e.target);
  if (!item || item.classList.contains('dragging')) return;
  item.classList.add('drag-over');
}

function fileDragLeave(e) {
  var item = findFileItem(e.target);
  if (!item) return;
  item.classList.remove('drag-over');
}

function fileDrop(e) {
  e.preventDefault();
  var dz = S.fileListEl.querySelector('.file-list-dropzone');
  if (dz) dz.classList.remove('show');
  var item = findFileItem(e.target);
  var toIdx = item ? parseInt(item.getAttribute('data-idx'), 10) : -1;
  if (isNaN(_dragFrom) || _dragFrom < 0) return;
  if (toIdx >= 0) {
    item.classList.remove('drag-over');
    moveItem(_dragFrom, toIdx);
  } else if (S.fileListEl.contains(e.target)) {
    var to = S.pageSize === 0 ? S.uploadedFiles.length : Math.min(S.currentPage * S.pageSize, S.uploadedFiles.length);
    moveItem(_dragFrom, to);
  }
}

function fileDragEnd(e) {
  document.querySelectorAll('.file-item.dragging, .file-item.drag-over').forEach(function(el) {
    el.classList.remove('dragging', 'drag-over');
  });
  var dz = S.fileListEl.querySelector('.file-list-dropzone');
  if (dz) dz.classList.remove('show');
  _dragFrom = -1;
}

function bindDragDrop() {
  var list = S.fileListEl;
  list.addEventListener('dragstart', fileDragStart);
  list.addEventListener('dragover', fileDragOver);
  list.addEventListener('dragenter', fileDragEnter);
  list.addEventListener('dragleave', fileDragLeave);
  list.addEventListener('drop', fileDrop);
  list.addEventListener('dragend', fileDragEnd);
}

export function buildSelectedFromRanges() {
  var set = {}, max = S.uploadedFiles.length;
  var rows = S.rangeRowsEl.querySelectorAll('.range-row');
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
  S.rangeRowsEl.innerHTML = '';
  S.addRangeBtn.disabled = !S.uploadedFiles.length || Object.keys(S.selectedSet).length >= S.uploadedFiles.length;
  if (!S.uploadedFiles.length) return;
  var max = S.uploadedFiles.length;
  var keys = Object.keys(S.selectedSet).map(Number).sort(function(a, b) { return a - b; });
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
    for (var j = 0; j < max; j++) { if (S.selectedSet[j] && !rangeSet[j + 1]) otherSet[j + 1] = true; }
    var removeBtnHtml = ranges.length > 1 ? ' <button class="btn btn-sm btn-danger remove-range-btn">\u2715</button>' : '';
    row.innerHTML = 'Start: <select class="range-start">' + buildOptions(max, ranges[r][0], otherSet) + '</select> End: <select class="range-end">' + buildOptions(max, ranges[r][1], otherSet) + '</select>' + removeBtnHtml;
    if (ranges.length > 1) {
      row.querySelector('.remove-range-btn').addEventListener('click', function() { this.parentElement.remove(); syncRange(); });
    }
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
  }
}

export function buildOptions(max, selected, excludeSet) {
  var h = '';
  for (var i = 1; i <= max; i++) {
    if (excludeSet && excludeSet[i]) continue;
    var sel = i === selected ? ' selected' : '';
    h += '<option value="' + i + '"' + sel + '>' + i + '</option>';
  }
  return h;
}

export function syncRange() {
  S.selectedSet = buildSelectedFromRanges();
  S.renderFileList();
}

export function buildSummaryHtml(p) {
  var html = '';
  html += '<div class="summary-section"><h3>' + t('settings') + '</h3>';
  var rows = [
    [t('artist'), p.artist], [t('camera'), p.camera.make + ' ' + p.camera.model],
    [t('lens'), p.lens.name + (p.lens.focal ? ' (' + p.lens.focal + 'mm)' : '') + (p.lens.aperture ? ' F/' + p.lens.aperture : '')],
    [t('film_stock'), p.film.name + ' (ISO ' + p.film.iso + ')'], [t('lab'), p.lab],
    [t('process'), p.process + ' (' + p.pushpull + ')'], [t('scanner'), p.scanner]
  ];
  if (p.camera.shutter) rows.push([t('shutter'), p.camera.shutter]);
  for (var i = 0; i < rows.length; i++) html += '<div class="summary-row"><span class="k">' + rows[i][0] + '</span><span class="v">' + esc(rows[i][1]) + '</span></div>';
  html += '</div>';
  html += '<div class="summary-section"><h3>' + t('files_header', {n: S.uploadedFiles.length}) + '</h3>';
  html += '<table class="rename-table"><tr><th></th><th>' + t('col_index') + '</th><th>' + t('col_original') + '</th><th>' + t('col_new_name') + '</th><th>\uD83D\uDCCD ' + t('col_location') + '</th><th>\uD83D\uDCC5 ' + t('col_date') + '</th></tr>';
  var start = S.summaryPageSize === 0 ? 0 : (S.summaryPage - 1) * S.summaryPageSize;
  var end = S.summaryPageSize === 0 ? S.uploadedFiles.length : Math.min(start + S.summaryPageSize, S.uploadedFiles.length);
  for (var j = start; j < end; j++) {
    var ext = S.uploadedFiles[j].file.name.split('.').pop().toLowerCase();
    var nn = S.newFName(p.film.name, ext, j);
    var gpsLoc = S.gpsData[j] && S.gpsData[j].addr ? '\uD83D\uDCCD ' + esc(S.gpsData[j].addr) : '<img src="no_gps.png" class="no-gps-icon">';
    var dateInfo2 = S.computeDateForFile(j + 1);
    var dateCell2 = dateInfo2 ? '<span class="date-dot">\uD83D\uDCC5 ' + dateInfo2.date + ' ' + dateInfo2.time + '</span>' : '<img src="no_date.png" class="no-date-icon">';
    html += '<tr><td><canvas class="summary-thumb" width="40" height="40" data-idx="' + j + '"></canvas></td><td style="color:#555;">' + (j + 1) + '</td><td class="old-name">' + esc(S.uploadedFiles[j].file.name) + '</td><td class="new-name">' + esc(nn) + '</td><td style="text-align:center;font-size:0.65rem;">' + gpsLoc + '</td><td style="text-align:center;font-size:0.65rem;">' + dateCell2 + '</td></tr>';
  }
  html += '</table>';
  var tp = getSummaryTotalPages();
  html += '<div class="pagination" style="padding:0.75rem 0;">' +
    '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToSummaryPage(' + (S.summaryPage - 1) + ')"' + (S.summaryPage <= 1 ? ' disabled' : '') + '>\u25C0</button>' +
    '<span class="page-info">' + t('page_of', {current: S.summaryPage, total: tp}) + '</span>' +
    '<button class="btn btn-sm btn-secondary pagination-btn" onclick="goToSummaryPage(' + (S.summaryPage + 1) + ')"' + (S.summaryPage >= tp ? ' disabled' : '') + '>\u25B6</button>' +
    '<select onchange="changeSummaryPageSize(this.value)">' +
      '<option value="5"' + (S.summaryPageSize === 5 ? ' selected' : '') + '>5</option>' +
      '<option value="10"' + (S.summaryPageSize === 10 ? ' selected' : '') + '>10</option>' +
      '<option value="25"' + (S.summaryPageSize === 25 ? ' selected' : '') + '>25</option>' +
      '<option value="50"' + (S.summaryPageSize === 50 ? ' selected' : '') + '>50</option>' +
      '<option value="0"' + (S.summaryPageSize === 0 ? ' selected' : '') + '>' + t('all') + '</option>' +
    '</select></div>';
  html += '</div>';
  return html;
}

export function rebuildSummaryBody() {
  var p = S.collect();
  var tp = getSummaryTotalPages();
  S.summaryPage = Math.max(1, Math.min(S.summaryPage, tp));
  S.summaryBody.innerHTML = buildSummaryHtml(p);
  var csChecked = localStorage.getItem('filmtag-content-sheet') !== '0';
  S.summaryFooter.innerHTML =
    '<div class="summary-footer-row">' +
      '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.8rem;">' +
        '<input type="checkbox" class="toggle-switch" id="content-sheet-toggle"' + (csChecked ? ' checked' : '') + '>' +
        '<span>' + t('content_sheet') + '</span></label>' +
      '<button class="btn btn-sm btn-secondary" id="content-sheet-btn" style="display:none">📋 ' + t('content_sheet_generate') + '</button>' +
    '</div>' +
    '<div class="summary-footer-row">' +
      '<button class="btn btn-secondary" id="summary-close-btn">✕ ' + t('close') + '</button>' +
      '<button class="btn btn-primary" id="confirm-save-btn">💾 ' + t('save_to_album') + '</button>' +
      '<button class="btn btn-primary" id="confirm-zip-btn">⬇ ' + t('download_zip') + '</button>' +
    '</div>';
  generateSummaryThumbnails();
  S._('confirm-zip-btn').addEventListener('click', S.startZipProcess);
  S._('confirm-save-btn').addEventListener('click', S.startSaveProcess);
  S._('content-sheet-btn').addEventListener('click', S.startContentSheet);
  var toggleCs = S._('content-sheet-toggle');
  if (toggleCs) {
    var genBtn = S._('content-sheet-btn');
    if (genBtn) genBtn.style.display = toggleCs.checked ? '' : 'none';
    toggleCs.addEventListener('change', function() {
      localStorage.setItem('filmtag-content-sheet', this.checked ? '1' : '0');
      if (genBtn) genBtn.style.display = this.checked ? '' : 'none';
    });
  }
  var closeBtn = S._('summary-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', function() { S.summaryPanel.classList.remove('show'); S.summaryPage = 1; });
}

export function generateSummaryThumbnails() {
  var queue = [], concurrency = 6;
  var canvases = document.querySelectorAll('canvas.summary-thumb');
  for (var ti = 0; ti < canvases.length; ti++) {
    (function(canvas) {
      var idx = parseInt(canvas.getAttribute('data-idx'), 10);
      var file = S.uploadedFiles[idx].file;
      if (S.thumbnailCache[idx]) {
        var img = new Image();
        img.onload = function() { canvas.getContext('2d').drawImage(img, 0, 0, 40, 40); };
        img.src = S.thumbnailCache[idx];
      } else {
        queue.push({ canvas: canvas, idx: idx, file: file });
      }
      canvas.addEventListener('click', function(e) {
        e.stopPropagation();
        var url = URL.createObjectURL(file);
        S.imgOverlayImg.src = url;
        S.imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
        S.imgOverlay.classList.add('show');
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
      S.thumbnailCache[item.idx] = tmp.toDataURL();
      URL.revokeObjectURL(img.src);
      processNext();
    };
    img.src = URL.createObjectURL(item.file);
  }
  for (var i = 0; i < Math.min(concurrency, queue.length); i++) processNext();
}
