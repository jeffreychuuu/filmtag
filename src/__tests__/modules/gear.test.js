import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGear, fillSelect, fillSelectWithCustom, collect, validate, applyLensToAll, applyLensToSelected, clearLensForSelected, buildLensLegend, updateLensSummary } from '../../modules/gear.js';

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
    gpsData: {},
    uploadedFiles: [],
    lensByFile: {},
    defaultLens: null,
  };
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

describe('validate lens coverage', function() {
  function baseP() {
    return { artist: 'Jeff', lens: { name: '50mm' }, film: { name: 'Portra' }, lab: 'Lab', scanner: 'Scanner' };
  }

  it('passes when a roll default lens is set', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }];
    S.defaultLens = { name: '50mm', focal: '50', aperture: '1.4' };
    S.lensByFile = {};
    expect(validate(baseP())).toBeNull();
  });

  it('passes when every file has a lens exception and no default is set', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }];
    S.defaultLens = null;
    S.lensByFile = { 0: { name: 'A' }, 1: { name: 'B' } };
    expect(validate(baseP())).toBeNull();
  });

  it('errors when a file has neither an exception nor a default lens', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }];
    S.defaultLens = null;
    S.lensByFile = { 0: { name: 'A' } };
    expect(validate(baseP())).toBeTruthy();
  });
});

describe('lens apply functions', function() {
  it('applyLensToAll sets the roll default and clears exceptions', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }];
    S.defaultLens = null;
    S.lensByFile = { 0: { name: 'A' } };
    applyLensToAll({ name: '50mm', focal: '50', aperture: '1.4' });
    expect(S.defaultLens.name).toBe('50mm');
    expect(Object.keys(S.lensByFile).length).toBe(0);
  });

  it('applyLensToSelected writes exceptions for selected files', function() {
    S.selectedSet = { 0: true, 2: true };
    applyLensToSelected({ name: '28mm', focal: '28', aperture: '2.8' });
    expect(S.lensByFile[0].name).toBe('28mm');
    expect(S.lensByFile[2].name).toBe('28mm');
    expect(S.lensByFile[1]).toBeUndefined();
  });

  it('clearLensForSelected removes exceptions for selected files', function() {
    S.selectedSet = { 0: true };
    S.lensByFile = { 0: { name: 'A' }, 1: { name: 'B' } };
    clearLensForSelected();
    expect(S.lensByFile[0]).toBeUndefined();
    expect(S.lensByFile[1].name).toBe('B');
  });
});

describe('lens legend', function() {
  it('assigns A/B letters in order of first occurrence', function() {
    S.uploadedFiles = [{}, {}, {}, {}];
    S.defaultLens = { name: '50mm' };
    S.lensByFile = { 1: { name: '35mm' }, 3: { name: '28mm' } };
    var legend = buildLensLegend();
    expect(legend.count).toBe(3);
    expect(legend.letterByName['50mm']).toBe('A');
    expect(legend.letterByName['35mm']).toBe('B');
    expect(legend.letterByName['28mm']).toBe('C');
    expect(legend.unset).toBe(0);
  });

  it('counts unset files', function() {
    S.uploadedFiles = [{}, {}];
    S.defaultLens = null;
    S.lensByFile = { 0: { name: '50mm' } };
    var legend = buildLensLegend();
    expect(legend.count).toBe(1);
    expect(legend.unset).toBe(1);
  });

  it('updateLensSummary renders the letter + full-name legend', function() {
    var el = document.createElement('span');
    el.id = 'lens-status';
    document.body.appendChild(el);
    S.uploadedFiles = [{}, {}, {}];
    S.defaultLens = { name: '50mm' };
    S.lensByFile = { 1: { name: '35mm' } };
    updateLensSummary();
    expect(el.innerHTML).toContain('🔭 A · 50mm<br>🔭 B · 35mm');
    document.body.innerHTML = '';
  });
});
