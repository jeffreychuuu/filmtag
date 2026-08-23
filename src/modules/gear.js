import { t } from '../i18n.js';
import { esc } from '../lib/utils.js';

var CAMERAS, $, artistSel, artistCust, cameraSel, cameraCust, lensDrop, lensSel, lensCust;
var filmSel, filmCust, labSel, labCust, ppSel, ppCust, scanSel, scanCust, processSel, processCust;
var DEFAULT_ITEMS = {};
var HIDDEN_KEY = 'filmtag-hidden-defaults';
var LENS_HIDDEN_KEY = 'filmtag-hidden-lenses';
var LENS_BY_CAMERA_KEY = 'filmtag-default-lens-by-camera';
var S;

function loadDefaultLensByCamera() {
  try { return JSON.parse(localStorage.getItem(LENS_BY_CAMERA_KEY) || '{}'); } catch(_) { return {}; }
}

function saveDefaultLensByCamera(data) {
  try { localStorage.setItem(LENS_BY_CAMERA_KEY, JSON.stringify(data)); } catch(_) {}
}

// The default lens for a camera: last-used for that camera, else first preset lens, else first saved custom
function getCameraDefaultLens(model) {
  var byCam = loadDefaultLensByCamera();
  if (byCam[model] && byCam[model].name) return byCam[model];
  var idx = findCameraByModel(model);
  if (idx !== -1) {
    var hidden = loadHiddenLenses()[model] || [];
    for (var i = 0; i < CAMERAS[idx].lenses.length; i++) {
      var l = CAMERAS[idx].lenses[i];
      if (hidden.indexOf(l.name) === -1) return { name: l.name, focal: l.focal, aperture: l.aperture };
    }
  }
  var saved = loadSavedLensesForCamera(model);
  if (saved.length) {
    var s = saved[0];
    return typeof s === 'object' ? { name: s.name, focal: s.focal, aperture: s.aperture } : { name: s, focal: '', aperture: '' };
  }
  return null;
}

function setCameraDefaultLens(model, lens) {
  if (!model || !lens || !lens.name) return;
  var byCam = loadDefaultLensByCamera();
  byCam[model] = { name: lens.name, focal: lens.focal || '', aperture: lens.aperture || '' };
  saveDefaultLensByCamera(byCam);
}

export function initGear(refs) {
  S = refs;
  CAMERAS = refs.CAMERAS;
  $ = refs.$;
  artistSel = refs.artistSel; artistCust = refs.artistCust;
  cameraSel = refs.cameraSel; cameraCust = refs.cameraCust;
  lensDrop = refs.lensDrop; lensSel = refs.lensSel; lensCust = refs.lensCust;
  filmSel = refs.filmSel; filmCust = refs.filmCust;
  labSel = refs.labSel; labCust = refs.labCust;
  ppSel = refs.ppSel; ppCust = refs.ppCust;
  scanSel = refs.scanSel; scanCust = refs.scanCust;
  processSel = refs.processSel; processCust = refs.processCust;
}

// Populate a <select> with option strings
export function fillSelect(sel, items) {
  for (var i = 0; i < items.length; i++) {
    var o = document.createElement('option');
    o.textContent = items[i];
    sel.appendChild(o);
  }
}

function loadHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '{}'); } catch(_) { return {}; }
}

function saveHidden(data) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(data));
}

function loadHiddenLenses() {
  try { return JSON.parse(localStorage.getItem(LENS_HIDDEN_KEY) || '{}'); } catch(_) { return {}; }
}

function saveHiddenLenses(data) {
  localStorage.setItem(LENS_HIDDEN_KEY, JSON.stringify(data));
}

// Populate <select> with items + saved custom entries + __custom__ option
export function fillSelectWithCustom(sel, items, key) {
  if (key && !DEFAULT_ITEMS[key]) DEFAULT_ITEMS[key] = items;
  var hidden = key ? (loadHidden()[key] || []) : [];
  var filtered = items.filter(function(v) { return hidden.indexOf(v) === -1; });
  fillSelect(sel, filtered);
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

// Load saved custom option values from localStorage
function loadSavedOpt(key) {
  try {
    var data = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}');
    return data[key] || [];
  } catch(_) { return []; }
}

// Load saved lenses for a specific camera model
function loadSavedLensesForCamera(cameraModel) {
  try {
    var data = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}');
    if (data.lensByCamera && data.lensByCamera[cameraModel]) return data.lensByCamera[cameraModel];
    return data.lensName || [];
  } catch(_) { return []; }
}

// Get current camera model string from dropdown or custom input
function currentCameraModel() {
  if (cameraSel.value === '__custom__') return $('camera-model-custom').value.trim();
  var idx = findCameraByModel(cameraSel.value);
  if (idx !== -1) return CAMERAS[idx].model;
  return cameraSel.value;
}

// Persist custom gear/field values to localStorage for next session
export function saveCustomOpts() {
  var data = {};
  try { data = JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}'); } catch(_) {}
  var fields = [
    {sel: artistSel, inp: $('artist-custom-input'), key: 'artist'},
    {sel: cameraSel, inp: $('camera-model-custom'), key: 'cameraModel'},
    {sel: lensSel, inp: $('lens-name-custom'), key: 'lensName'},
    {sel: filmSel, inp: $('film-name-custom'), key: 'filmName'},
    {sel: labSel, inp: $('lab-custom-input'), key: 'lab'},
    {sel: scanSel, inp: $('scanner-custom-input'), key: 'scanner'},
    {sel: ppSel, inp: $('pushpull-custom-input'), key: 'pushPull'},
    {sel: processSel, inp: $('process-custom-input'), key: 'process'}
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

export function saveLastSession() {
  function fv(sel, inp) { return sel.value === '__custom__' ? inp.value.trim() : selText(sel); }
  var session = {
    artist: fv(artistSel, $('artist-custom-input')),
    camera: fv(cameraSel, $('camera-model-custom')), cameraMake: $('camera-make-custom').value.trim(),
    film: fv(filmSel, $('film-name-custom')), filmIso: $('film-iso-custom').value.trim(),
    lab: fv(labSel, $('lab-custom-input')), process: fv(processSel, $('process-custom-input')),
    pushpull: fv(ppSel, $('pushpull-custom-input')), scanner: fv(scanSel, $('scanner-custom-input')),
    publicDesc: $('public-checkbox').checked
  };
  localStorage.setItem('filmtag-last-session', JSON.stringify(session));
}

export function selByText(sel, text) {
  for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].textContent === text) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); return true; } }
  return false;
}
export function setCust(sel, inp, val) { if (!val) return; sel.value = '__custom__'; sel.dispatchEvent(new Event('change')); inp.value = val; }

export function restoreLastSession() {
  var data;
  try { data = JSON.parse(localStorage.getItem('filmtag-last-session')); } catch(_) {}
  if (!data) return;
  if (data.camera && !selByText(cameraSel, data.camera)) { setCust(cameraSel, $('camera-model-custom'), data.camera); if (data.cameraMake) $('camera-make-custom').value = data.cameraMake; }
  [{sel:artistSel,inp:$('artist-custom-input'),val:data.artist},{sel:labSel,inp:$('lab-custom-input'),val:data.lab},{sel:processSel,inp:$('process-custom-input'),val:data.process},{sel:ppSel,inp:$('pushpull-custom-input'),val:data.pushpull},{sel:scanSel,inp:$('scanner-custom-input'),val:data.scanner}].forEach(function(f) { if (f.val && !selByText(f.sel, f.val)) setCust(f.sel, f.inp, f.val); });
  if (data.film && !selByText(filmSel, data.film)) { setCust(filmSel, $('film-name-custom'), data.film); if (data.filmIso) $('film-iso-custom').value = data.filmIso; }
  if (data.publicDesc !== undefined) $('public-checkbox').checked = data.publicDesc;
}

// Show/hide custom input field when __custom__ is selected in a dropdown
export function setupCustom(sel, cust) {
  function toggle() { cust.classList.toggle('show', sel.value === '__custom__'); }
  sel.addEventListener('change', toggle);
  toggle();
}

function findCameraByModel(modelName) {
  for (var i = 0; i < CAMERAS.length; i++) {
    if (CAMERAS[i].model === modelName) return i;
  }
  return -1;
}

function isCustomCamera() {
  var model = cameraSel.value;
  if (model === '__custom__') return true;
  return findCameraByModel(model) === -1;
}

// Populate lens dropdown for a built-in camera preset
function populateLenses(modelName) {
  var idx = findCameraByModel(modelName);
  if (idx === -1) return;
  var hiddenLenses = loadHiddenLenses()[modelName] || [];
  lensSel.innerHTML = '';
  CAMERAS[idx].lenses.forEach(function(l, i) {
    if (hiddenLenses.indexOf(l.name) !== -1) return;
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

// Show/hide lens section and populate based on camera selection
export function updateLensUI() {
  if (cameraSel.value === '__custom__') {
    lensDrop.style.display = 'none'; lensCust.classList.add('show'); lensSel.value = '__custom__';
  } else if (isCustomCamera()) {
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
    lensDrop.style.display = 'block'; populateLenses(cameraSel.value);
    lensCust.classList.toggle('show', lensSel.value === '__custom__');
  }
}

// Read the lens currently selected in the lens overlay (used for apply)
export function readLens() { return lensInfo(); }

// Record + persist the roll default lens for the current camera (= last used as base)
export function setDefaultLens(lens) {
  if (!lens || !lens.name) return;
  S.defaultLens = { name: lens.name, focal: lens.focal || '', aperture: lens.aperture || '' };
  setCameraDefaultLens(currentCameraModel(), S.defaultLens);
  updateLensSummary();
}

// Set the roll default lens (per-camera, persisted) and clear per-file exceptions
export function applyLensToAll(lens) {
  if (!lens || !lens.name) return;
  setDefaultLens(lens);
  S.lensByFile = {};
  updateLensSummary();
}

// Sync the roll default lens to the currently selected camera's default lens
export function syncDefaultLensToCamera() {
  S.defaultLens = getCameraDefaultLens(currentCameraModel());
  S.lensByFile = {};
  updateLensSummary();
}

// Set a per-file lens exception for all currently selected files
export function applyLensToSelected(lens) {
  if (!lens || !lens.name) return;
  var keys = Object.keys(S.selectedSet || {});
  for (var i = 0; i < keys.length; i++) S.lensByFile[keys[i]] = { name: lens.name, focal: lens.focal || '', aperture: lens.aperture || '' };
  updateLensSummary();
}

// Remove per-file lens exceptions (revert to default) for selected files
export function clearLensForSelected() {
  var keys = Object.keys(S.selectedSet || {});
  for (var i = 0; i < keys.length; i++) delete S.lensByFile[keys[i]];
  updateLensSummary();
}

// Build the lens legend for the current roll: letter (A, B, C…) per distinct lens
export function buildLensLegend() {
  var files = S.uploadedFiles || [];
  var letterByName = {}, names = [], unset = 0;
  for (var i = 0; i < files.length; i++) {
    var l = S.lensByFile[i] || S.defaultLens;
    if (l && l.name) {
      if (letterByName[l.name] === undefined) {
        letterByName[l.name] = String.fromCharCode(65 + names.length);
        names.push(l.name);
      }
    } else unset++;
  }
  return { letterByName: letterByName, names: names, count: names.length, unset: unset };
}

// Update the lens legend line in the file list header
export function updateLensSummary() {
  var el = S.$ && S.$('lens-status');
  if (!el) return;
  var files = S.uploadedFiles || [];
  if (!files.length) { el.textContent = ''; return; }
  var legend = buildLensLegend();
  if (legend.unset > 0) { el.textContent = '⚠️ ' + t('lens_unset_count', { n: legend.unset }); return; }
  if (legend.count <= 1) { el.textContent = '🔭 ' + legend.names[0]; return; }
  var html = '🔭 ';
  for (var n = 0; n < legend.names.length; n++) {
    html += esc(legend.letterByName[legend.names[n]] + ' = ' + legend.names[n]);
    if (n < legend.names.length - 1) html += '<br>';
  }
  el.innerHTML = html;
}

// Get selected option text from a <select>
function selText(sel) { return sel.options[sel.selectedIndex].text; }

// Get value from select or fallback to custom input
function getVal(sel, inp) { return sel.value === '__custom__' ? inp.value.trim() : selText(sel); }

// Collect camera info (make, model, shutter) from dropdown or custom inputs
function camInfo() {
  if (cameraSel.value === '__custom__' || isCustomCamera()) {
    var model = cameraSel.value === '__custom__' ? ($('camera-model-custom').value.trim() || t('unknown')) : cameraSel.value;
    return { make: $('camera-make-custom').value.trim() || t('unknown'), model: model, shutter: null };
  }
  var idx = findCameraByModel(cameraSel.value);
  if (idx === -1) return { make: t('unknown'), model: cameraSel.value, shutter: null };
  var c = CAMERAS[idx]; return { make: c.make, model: c.model, shutter: c.shutter };
}

// Collect lens info (name, focal, aperture) from dropdown or custom inputs
function lensInfo() {
  if (cameraSel.value === '__custom__' || lensSel.value === '__custom__')
    return { name: $('lens-name-custom').value.trim(), focal: $('lens-focal').value.trim(), aperture: $('lens-aperture').value.trim() };
  if (isCustomCamera()) {
    var o = lensSel.options[lensSel.selectedIndex];
    return { name: selText(lensSel), focal: o.getAttribute('data-focal') || '', aperture: o.getAttribute('data-aperture') || '' };
  }
  var idx = findCameraByModel(cameraSel.value);
  if (idx === -1) {
    var o = lensSel.options[lensSel.selectedIndex];
    return { name: selText(lensSel), focal: o.getAttribute('data-focal') || '', aperture: o.getAttribute('data-aperture') || '' };
  }
  if (lensSel.selectedIndex >= CAMERAS[idx].lenses.length) {
    var o = lensSel.options[lensSel.selectedIndex];
    return { name: selText(lensSel), focal: o.getAttribute('data-focal') || '', aperture: o.getAttribute('data-aperture') || '' };
  }
  var l = CAMERAS[idx].lenses[lensSel.selectedIndex];
  return { name: l.name, focal: l.focal, aperture: l.aperture };
}

// Collect film info (name, iso) from dropdown or custom inputs
function filmInfo() {
  if (filmSel.value === '__custom__') return { name: $('film-name-custom').value.trim(), iso: $('film-iso-custom').value.trim() };
  var o = filmSel.options[filmSel.selectedIndex];
  return { name: o.textContent, iso: o.getAttribute('data-iso') };
}

// Collect all gear/params into a single params object for processing
export function collect() {
  return {
    artist: getVal(artistSel, $('artist-custom-input')), camera: camInfo(), lens: S.defaultLens || { name: '', focal: '', aperture: '' },
    film: filmInfo(), lab: getVal(labSel, $('lab-custom-input')),     process: getVal(processSel, $('process-custom-input')),
    pushpull: getVal(ppSel, $('pushpull-custom-input')), scanner: getVal(scanSel, $('scanner-custom-input'))
  };
}

// Validate that all required fields are filled, return error message or null
export function validate(p) {
  if (!p.artist) return t('artist_required');
  if (!p.film.name) return t('film_required');
  if (!p.lab) return t('lab_required');
  if (!p.scanner) return t('scanner_required');
  var files = S.uploadedFiles || [];
  if (files.length > 0) {
    for (var i = 0; i < files.length; i++) {
      if (!S.lensByFile[i] && (!S.defaultLens || !S.defaultLens.name)) {
        return t('lens_coverage');
      }
    }
  }
  return null;
}

function loadAllOpts() {
  try { return JSON.parse(localStorage.getItem('filmtag-custom-opts') || '{}'); } catch(_) { return {}; }
}

function saveAllOpts(data) {
  localStorage.setItem('filmtag-custom-opts', JSON.stringify(data));
}

export function setDefaultItems(key, items) {
  DEFAULT_ITEMS[key] = items;
}

function refreshGearDropdowns() {
  [artistSel, cameraSel, labSel, processSel, ppSel, scanSel].forEach(function(sel) {
    sel.innerHTML = '';
  });
  fillSelectWithCustom(artistSel, DEFAULT_ITEMS.artist || [], 'artist');
  fillSelectWithCustom(cameraSel, DEFAULT_ITEMS.cameraModel || [], 'cameraModel');
  fillSelectWithCustom(labSel, DEFAULT_ITEMS.lab || [], 'lab');
  fillSelectWithCustom(processSel, DEFAULT_ITEMS.process || [], 'process');
  fillSelectWithCustom(ppSel, DEFAULT_ITEMS.pushPull || [], 'pushPull');
  fillSelectWithCustom(scanSel, DEFAULT_ITEMS.scanner || [], 'scanner');
  updateLensUI();
  filmSel.innerHTML = '';
  var hiddenFilms = (loadHidden().filmName || []);
  var filmDefaults = DEFAULT_ITEMS.filmName || [];
  for (var fi = 0; fi < filmDefaults.length; fi++) {
    if (hiddenFilms.indexOf(filmDefaults[fi]) === -1) {
      var fo = document.createElement('option'); fo.textContent = filmDefaults[fi]; filmSel.appendChild(fo);
    }
  }
  var savedFilms = loadSavedOpt('filmName');
  for (var si = 0; si < savedFilms.length; si++) {
    var o = document.createElement('option'); o.textContent = savedFilms[si]; filmSel.appendChild(o);
  }
  var oo = document.createElement('option'); oo.value = '__custom__'; oo.textContent = t('other_free_text'); filmSel.appendChild(oo);
  [artistSel, cameraSel, labSel, processSel, ppSel, scanSel, filmSel].forEach(function(sel) {
    sel.dispatchEvent(new Event('change'));
  });
}

export function toggleHiddenDefault(key, value) {
  var hidden = loadHidden();
  if (!hidden[key]) hidden[key] = [];
  var idx = hidden[key].indexOf(value);
  if (idx === -1) {
    hidden[key].push(value);
  } else {
    hidden[key].splice(idx, 1);
    if (hidden[key].length === 0) delete hidden[key];
  }
  if (Object.keys(hidden).length === 0) localStorage.removeItem(HIDDEN_KEY);
  else saveHidden(hidden);
  refreshGearDropdowns();
  renderManageOverlay();
}

export function resetHiddenDefaults() {
  localStorage.removeItem(HIDDEN_KEY);
  refreshGearDropdowns();
  renderManageOverlay();
}

export function toggleHiddenLens(camera, lensName) {
  var hidden = loadHiddenLenses();
  if (!hidden[camera]) hidden[camera] = [];
  var idx = hidden[camera].indexOf(lensName);
  if (idx === -1) {
    hidden[camera].push(lensName);
  } else {
    hidden[camera].splice(idx, 1);
    if (hidden[camera].length === 0) delete hidden[camera];
  }
  if (Object.keys(hidden).length === 0) localStorage.removeItem(LENS_HIDDEN_KEY);
  else saveHiddenLenses(hidden);
  refreshGearDropdowns();
  renderManageOverlay();
}

export function resetHiddenLenses() {
  localStorage.removeItem(LENS_HIDDEN_KEY);
  refreshGearDropdowns();
  renderManageOverlay();
}

export function resetHiddenDefaultsForField(key) {
  var hidden = loadHidden();
  if (hidden[key]) {
    delete hidden[key];
    if (Object.keys(hidden).length === 0) localStorage.removeItem(HIDDEN_KEY);
    else saveHidden(hidden);
  }
  refreshGearDropdowns();
  renderManageOverlay();
}

export function deleteCustomOpt(key, value) {
  var data = loadAllOpts();
  if (key === 'lensByCamera' && typeof value === 'object') {
    if (data.lensByCamera && data.lensByCamera[value.camera]) {
      data.lensByCamera[value.camera] = data.lensByCamera[value.camera].filter(function(l) { return l.name !== value.name; });
      if (data.lensByCamera[value.camera].length === 0) delete data.lensByCamera[value.camera];
      if (Object.keys(data.lensByCamera).length === 0) delete data.lensByCamera;
    }
  } else {
    if (data[key]) {
      data[key] = data[key].filter(function(v) { return v !== value; });
      if (data[key].length === 0) delete data[key];
    }
  }
  saveAllOpts(data);
  refreshGearDropdowns();
  renderManageOverlay();
}

var _manageKey = null;

function getLabelForManageKey(key) {
  var map = {artist:'artist', cameraModel:'camera', filmName:'film_stock', lab:'lab', process:'process', pushPull:'push_pull', scanner:'scanner', lensByCamera:'lens', filmStock:'film_stock'};
  return map[key] || 'manage_opts_title';
}

export function renderManageOverlay(key) {
  if (key !== undefined) _manageKey = key;
  key = _manageKey;
  var data = loadAllOpts();
  var hidden = loadHidden();
  var body = document.getElementById('manage-body');
  if (!body) return;

  // Update overlay title
  var overlay = body.closest('.overlay-content');
  if (overlay) {
    var titleEl = overlay.querySelector('h3');
    if (titleEl) titleEl.innerHTML = '⚙️ ' + t(getLabelForManageKey(key));
  }

  var keys = [
    {key: 'artist', label: t('artist')},
    {key: 'cameraModel', label: t('camera')},
    {key: 'filmName', label: t('film_stock')},
    {key: 'lab', label: t('lab')},
    {key: 'process', label: t('process')},
    {key: 'pushPull', label: t('push_pull')},
    {key: 'scanner', label: t('scanner')}
  ];
  var h = '';
  var any = false;

  for (var ki = 0; ki < keys.length; ki++) {
    if (keys[ki].key !== key) continue;
    var defaults = DEFAULT_ITEMS[keys[ki].key];
    var customItems = data[keys[ki].key];
    var hiddenForField = hidden[keys[ki].key] || [];
    var hasDefaults = defaults && defaults.length > 0;
    var hasCustom = customItems && customItems.length > 0;
    if (!hasDefaults && !hasCustom) continue;
    any = true;

    h += '<div class="manage-section" style="margin-bottom:0.5rem;">';
    h += '<div style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);padding:0.3rem 0;">▼ ' + esc(keys[ki].label) + '</div>';
    h += '<div style="margin-left:1.2rem;border-left:1px solid var(--border);padding-left:0.75rem;">';

    if (hasDefaults) {
      h += '<div style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:0.2rem;">' + t('default') + '</div>';
      for (var di = 0; di < defaults.length; di++) {
        var isHidden = hiddenForField.indexOf(defaults[di]) !== -1;
        h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;font-size:0.8rem;">';
        h += '<span style="flex:1;' + (isHidden ? 'color:var(--text-secondary);text-decoration:line-through;' : '') + '">' + esc(defaults[di]) + '</span>';
        h += '<button class="manage-toggle-btn" data-key="' + keys[ki].key + '" data-value="' + esc(defaults[di]) + '" style="background:none;border:1px solid ' + (isHidden ? 'var(--accent)' : 'var(--border)') + ';border-radius:4px;color:' + (isHidden ? 'var(--accent)' : 'var(--text)') + ';cursor:pointer;font-size:0.65rem;padding:0.1rem 0.35rem;">' + (isHidden ? t('show') : t('hide')) + '</button>';
        h += '</div>';
      }
    }

    if (hasCustom) {
      h += '<div style="font-size:0.65rem;color:var(--text-secondary);margin-top:0.3rem;margin-bottom:0.2rem;">' + t('custom') + '</div>';
      for (var ii = 0; ii < customItems.length; ii++) {
        h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;font-size:0.8rem;">';
        h += '<span style="flex:1;">' + esc(customItems[ii]) + '</span>';
        h += '<button class="manage-del-btn" data-key="' + keys[ki].key + '" data-value="' + esc(customItems[ii]) + '" style="background:#c0392b;color:#fff;border:1px solid #c0392b;border-radius:4px;cursor:pointer;font-size:0.7rem;padding:0.1rem 0.4rem;">' + t('remove') + '</button>';
        h += '</div>';
      }
    }

    h += '</div></div>';
  }

  // Lens overlay: show all cameras with default lenses + custom lenses
  if (key === 'lensByCamera') {
    var hiddenCams = loadHidden().cameraModel || [];
    var hiddenLenses = loadHiddenLenses();

    for (var ci2 = 0; ci2 < CAMERAS.length; ci2++) {
      var cam = CAMERAS[ci2];
      if (hiddenCams.indexOf(cam.model) !== -1) continue;

      // Default lenses
      var defLenses = cam.lenses;
      // Custom lenses
      var custLenses = [];
      if (data.lensByCamera && data.lensByCamera[cam.model]) {
        custLenses = data.lensByCamera[cam.model];
      }

      if (defLenses.length === 0 && custLenses.length === 0) continue;
      any = true;

      h += '<div style="margin-bottom:0.5rem;">';
      h += '<div style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);padding:0.3rem 0;">▼ ' + esc(cam.model) + '</div>';
      h += '<div style="margin-left:1.2rem;border-left:1px solid var(--border);padding-left:0.75rem;">';

      if (defLenses.length > 0) {
        h += '<div style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:0.2rem;">' + t('default') + '</div>';
        var hiddenForCam = hiddenLenses[cam.model] || [];
        for (var dli = 0; dli < defLenses.length; dli++) {
          var lensIsHidden = hiddenForCam.indexOf(defLenses[dli].name) !== -1;
          h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;font-size:0.8rem;">';
          h += '<span style="flex:1;' + (lensIsHidden ? 'color:var(--text-secondary);text-decoration:line-through;' : '') + '">' + esc(defLenses[dli].name) + '</span>';
          h += '<button class="manage-toggle-lens-btn" data-camera="' + esc(cam.model) + '" data-value="' + esc(defLenses[dli].name) + '" style="background:none;border:1px solid ' + (lensIsHidden ? 'var(--accent)' : 'var(--border)') + ';border-radius:4px;color:' + (lensIsHidden ? 'var(--accent)' : 'var(--text)') + ';cursor:pointer;font-size:0.65rem;padding:0.1rem 0.35rem;">' + (lensIsHidden ? t('show') : t('hide')) + '</button>';
          h += '</div>';
        }
      }

      if (custLenses.length > 0) {
        h += '<div style="font-size:0.65rem;color:var(--text-secondary);margin-top:0.3rem;margin-bottom:0.2rem;">' + t('custom') + '</div>';
        for (var ccli = 0; ccli < custLenses.length; ccli++) {
          var clName = typeof custLenses[ccli] === 'object' ? custLenses[ccli].name : custLenses[ccli];
          h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;font-size:0.8rem;">';
          h += '<span style="flex:1;">' + esc(clName) + '</span>';
          h += '<button class="manage-del-btn" data-key="lensByCamera" data-value=\'' + esc(JSON.stringify({camera: cam.model, name: clName})) + '\' style="background:#c0392b;color:#fff;border:1px solid #c0392b;border-radius:4px;cursor:pointer;font-size:0.7rem;padding:0.1rem 0.4rem;">' + t('remove') + '</button>';
          h += '</div>';
        }
      }

      h += '</div></div>';
    }
  }

  // Show all defaults button
  var hasHidden = key === 'lensByCamera'
    ? Object.keys(loadHiddenLenses()).length > 0
    : Object.keys(hidden).length > 0;
  h += '<div style="text-align:center;margin-top:0.75rem;">';
  h += '<button class="btn btn-sm btn-primary" id="reset-defaults-btn" style="visibility:' + (hasHidden ? 'visible' : 'hidden') + ';">' + t('reset_defaults') + '</button>';
  h += '</div>';

  if (!any) {
    h = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:2rem 0;">' + t('manage_opts_none') + '</p>';
  }

  body.innerHTML = h;

  body.querySelectorAll('.manage-del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var k = this.getAttribute('data-key');
      var raw = this.getAttribute('data-value');
      var value = k === 'lensByCamera' ? JSON.parse(raw) : raw;
      deleteCustomOpt(k, value);
    });
  });
  body.querySelectorAll('.manage-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      toggleHiddenDefault(this.getAttribute('data-key'), this.getAttribute('data-value'));
    });
  });
  body.querySelectorAll('.manage-toggle-lens-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      toggleHiddenLens(this.getAttribute('data-camera'), this.getAttribute('data-value'));
    });
  });
  var resetBtn = document.getElementById('reset-defaults-btn');
  if (resetBtn) resetBtn.addEventListener('click', function() {
    if (key === 'lensByCamera') resetHiddenLenses();
    else resetHiddenDefaultsForField(key);
  });
}
