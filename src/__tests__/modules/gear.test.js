import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGear, fillSelect, fillSelectWithCustom, collect, validate } from '../../modules/gear.js';

var S;
var selectEl, customEl, customInput;

beforeEach(function() {
  selectEl = document.createElement('select');
  customEl = document.createElement('div');
  customInput = document.createElement('input');
  customInput.type = 'text';
  customEl.appendChild(customInput);

  S = {
    $: function(id) { return document.getElementById(id); },
    CAMERAS: [{ make: 'Leica', model: 'MP', shutter: null, lenses: [{ name: '50mm f/1.4', focal: '50', aperture: '1.4' }] }],
    artistSel: selectEl,
    artistCust: customEl,
    cameraSel: document.createElement('select'),
    cameraCust: document.createElement('div'),
    lensSel: document.createElement('select'),
    lensCust: document.createElement('div'),
    lensDrop: document.createElement('div'),
    filmSel: document.createElement('select'),
    filmCust: document.createElement('div'),
    labSel: document.createElement('select'),
    labCust: document.createElement('div'),
    ppSel: document.createElement('select'),
    ppCust: document.createElement('div'),
    scanSel: document.createElement('select'),
    scanCust: document.createElement('div'),
    selectedSet: {},
    gpsData: {}
  };
  // Append to document so querySelector works
  selectEl.id = 'artist-select';
  customInput.id = 'artist-custom-input';
  document.body.appendChild(selectEl);
  document.body.appendChild(customInput);
  document.body.appendChild(S.cameraSel);
  document.body.appendChild(S.labSel);
  document.body.appendChild(S.ppSel);
  document.body.appendChild(S.scanSel);
  document.body.appendChild(S.filmSel);

  initGear(S);
});

afterEach(function() {
  document.body.innerHTML = '';
});

describe('validate', function() {
  it('returns null when all fields are filled', function() {
    var p = { artist: 'Jeff', lens: { name: '50mm' }, film: { name: 'Portra' }, lab: 'Lab', scanner: 'Scanner' };
    expect(validate(p)).toBeNull();
  });

  it('returns error when artist is missing', function() {
    var p = { artist: '', lens: { name: '50mm' }, film: { name: 'Portra' }, lab: 'Lab', scanner: 'Scanner' };
    expect(validate(p)).toBeTruthy();
  });

  it('returns error when lens is missing', function() {
    var p = { artist: 'Jeff', lens: { name: '' }, film: { name: 'Portra' }, lab: 'Lab', scanner: 'Scanner' };
    expect(validate(p)).toBeTruthy();
  });

  it('returns error when film is missing', function() {
    var p = { artist: 'Jeff', lens: { name: '50mm' }, film: { name: '' }, lab: 'Lab', scanner: 'Scanner' };
    expect(validate(p)).toBeTruthy();
  });

  it('returns error when lab is missing', function() {
    var p = { artist: 'Jeff', lens: { name: '50mm' }, film: { name: 'Portra' }, lab: '', scanner: 'Scanner' };
    expect(validate(p)).toBeTruthy();
  });

  it('returns error when scanner is missing', function() {
    var p = { artist: 'Jeff', lens: { name: '50mm' }, film: { name: 'Portra' }, lab: 'Lab', scanner: '' };
    expect(validate(p)).toBeTruthy();
  });
});

describe('fillSelect', function() {
  it('adds options to an empty select', function() {
    var sel = document.createElement('select');
    fillSelect(sel, ['Option A', 'Option B']);
    expect(sel.children.length).toBe(2);
    expect(sel.children[0].textContent).toBe('Option A');
    expect(sel.children[1].textContent).toBe('Option B');
  });

  it('handles empty items array', function() {
    var sel = document.createElement('select');
    fillSelect(sel, []);
    expect(sel.children.length).toBe(0);
  });
});

describe('fillSelectWithCustom', function() {
  it('adds items plus custom option', function() {
    var sel = document.createElement('select');
    fillSelectWithCustom(sel, ['A', 'B'], null);
    // Should have A, B, and custom option (when key is null, no saved items loaded)
    expect(sel.children.length).toBe(3);
    expect(sel.children[2].value).toBe('__custom__');
  });
});
