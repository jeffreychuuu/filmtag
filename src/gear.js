import { t } from './i18n.js';
import { esc } from './utils.js';

var CAMERAS, $, authorSel, authorCust, cameraSel, cameraCust, lensDrop, lensSel, lensCust;
var filmSel, filmCust, labSel, labCust, ppSel, ppCust, scanSel, scanCust;
var selectedSet, gpsData;

export function initGear(refs) {
  CAMERAS = refs.CAMERAS;
  $ = refs.$;
  authorSel = refs.authorSel; authorCust = refs.authorCust;
  cameraSel = refs.cameraSel; cameraCust = refs.cameraCust;
  lensDrop = refs.lensDrop; lensSel = refs.lensSel; lensCust = refs.lensCust;
  filmSel = refs.filmSel; filmCust = refs.filmCust;
  labSel = refs.labSel; labCust = refs.labCust;
  ppSel = refs.ppSel; ppCust = refs.ppCust;
  scanSel = refs.scanSel; scanCust = refs.scanCust;
  selectedSet = refs.selectedSet;
  gpsData = refs.gpsData;
}

// Populate a <select> with option strings
export function fillSelect(sel, items) {
  for (var i = 0; i < items.length; i++) {
    var o = document.createElement('option');
    o.textContent = items[i];
    sel.appendChild(o);
  }
}

// Populate <select> with items + saved custom entries + __custom__ option
export function fillSelectWithCustom(sel, items, key) {
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
  if (cameraSel.selectedIndex < CAMERAS.length) return CAMERAS[cameraSel.selectedIndex].model;
  return cameraSel.value;
}

// Persist custom gear/field values to localStorage for next session
export function saveCustomOpts() {
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

// Show/hide custom input field when __custom__ is selected in a dropdown
export function setupCustom(sel, cust) {
  function toggle() { cust.classList.toggle('show', sel.value === '__custom__'); }
  sel.addEventListener('change', toggle);
  toggle();
}

// Populate lens dropdown for a built-in camera preset
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

// Show/hide lens section and populate based on camera selection
export function updateLensUI() {
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

// Get selected option text from a <select>
function selText(sel) { return sel.options[sel.selectedIndex].text; }

// Get value from select or fallback to custom input
function getVal(sel, inp) { return sel.value === '__custom__' ? inp.value.trim() : selText(sel); }

// Collect camera info (make, model, shutter) from dropdown or custom inputs
function camInfo() {
  if (cameraSel.value === '__custom__' || cameraSel.selectedIndex >= CAMERAS.length) {
    var model = cameraSel.value === '__custom__' ? ($('camera-model-custom').value.trim() || t('unknown')) : cameraSel.value;
    return { make: $('camera-make-custom').value.trim() || t('unknown'), model: model, shutter: null };
  }
  var c = CAMERAS[cameraSel.selectedIndex]; return { make: c.make, model: c.model, shutter: c.shutter };
}

// Collect lens info (name, focal, aperture) from dropdown or custom inputs
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

// Collect film info (name, iso) from dropdown or custom inputs
function filmInfo() {
  if (filmSel.value === '__custom__') return { name: $('film-name-custom').value.trim(), iso: $('film-iso-custom').value.trim() };
  var o = filmSel.options[filmSel.selectedIndex];
  return { name: o.textContent, iso: o.getAttribute('data-iso') };
}

// Collect all gear/params into a single params object for processing
export function collect() {
  return {
    author: getVal(authorSel, $('author-custom-input')), camera: camInfo(), lens: lensInfo(),
    film: filmInfo(), lab: getVal(labSel, $('lab-custom-input')), process: selText($('process-select')),
    pushpull: getVal(ppSel, $('pushpull-custom-input')), scanner: getVal(scanSel, $('scanner-custom-input'))
  };
}

// Validate that all required fields are filled, return error message or null
export function validate(p) {
  if (!p.author) return t('author_required'); if (!p.lens.name) return t('lens_required');
  if (!p.film.name) return t('film_required'); if (!p.lab) return t('lab_required');
  if (!p.scanner) return t('scanner_required'); return null;
}
