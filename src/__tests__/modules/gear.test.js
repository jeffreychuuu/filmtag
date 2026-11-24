import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGear, fillSelect, fillSelectWithCustom, collect, validate, applyLensToSelected, buildLensLegend, updateLensSummary, countAssignedLensNames, filmMatchesFormat, refreshFilmSelect, refreshCameraSelect, renderManageOverlay, setDefaultItems } from '../../modules/gear.js';

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
  localStorage.clear();
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
  it('applyLensToSelected writes exceptions for selected files', function() {
    S.selectedSet = { 0: true, 2: true };
    applyLensToSelected({ name: '28mm', focal: '28', aperture: '2.8' });
    expect(S.lensByFile[0].name).toBe('28mm');
    expect(S.lensByFile[2].name).toBe('28mm');
    expect(S.lensByFile[1]).toBeUndefined();
  });

  it('applyLensToSelected stores the last-picked lens as the per-camera default', function() {
    var opt = document.createElement('option');
    opt.value = 'MP'; opt.textContent = 'MP';
    S.cameraSel.appendChild(opt);
    S.cameraSel.value = 'MP';
    S.selectedSet = { 0: true };
    applyLensToSelected({ name: '35mm', focal: '35', aperture: '2' });
    var byCam = JSON.parse(localStorage.getItem('filmtag-default-lens-by-camera') || '{}');
    expect(byCam.MP.name).toBe('35mm');
  });
});

describe('countAssignedLensNames', function() {
  it('counts multiple distinct per-file overrides', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }, { file: {} }];
    S.defaultLens = null;
    S.lensByFile = { 0: { name: '28mm' }, 2: { name: '50mm' } };
    expect(countAssignedLensNames()).toEqual(['28mm', '50mm']);
  });

  it('counts the roll default lens even when no file is overridden', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }];
    S.defaultLens = { name: '50mm' };
    S.lensByFile = {};
    expect(countAssignedLensNames()).toEqual(['50mm']);
  });

  it('counts roll default plus a different per-file override as two lenses', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }, { file: {} }];
    S.defaultLens = { name: '50mm' };
    S.lensByFile = { 1: { name: '35mm' } };
    expect(countAssignedLensNames()).toEqual(['50mm', '35mm']);
  });

  it('returns [] when no lens is assigned anywhere', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }];
    S.defaultLens = null;
    S.lensByFile = {};
    expect(countAssignedLensNames()).toEqual([]);
  });
});

describe('film format filtering', function() {
  it('matches both and treats missing format as universal', function() {
    expect(filmMatchesFormat('both', '135')).toBe(true);
    expect(filmMatchesFormat('both', '120')).toBe(true);
    expect(filmMatchesFormat('135', '135')).toBe(true);
    expect(filmMatchesFormat('135', '120')).toBe(false);
    expect(filmMatchesFormat('120', '135')).toBe(false);
    expect(filmMatchesFormat(undefined, '120')).toBe(true);
    expect(filmMatchesFormat('120', null)).toBe(true);
  });

  it('filters by camera format, groups by category and sorts A-Z', function() {
    S.CAMERAS = [
      { make: 'Leica', model: 'MP', format: '135', lenses: [] },
      { make: 'Hasselblad', model: '500CM', format: '120', lenses: [] }
    ];
    S.films = [
      { name: 'Kodak Portra 400', iso: '400', format: 'both', category: 'negative' },
      { name: 'Ilford Pan 400', iso: '400', format: '135', category: 'bw' },
      { name: 'Reflx Lab 5219 500T', iso: '500', format: '120', category: 'cine' },
      { name: 'Alien 5207 250D', iso: '250', format: '120', category: 'cine' }
    ];
    initGear(S);

    var mpOpt = document.createElement('option');
    mpOpt.value = 'MP'; mpOpt.textContent = 'MP';
    S.cameraSel.appendChild(mpOpt);
    var hbOpt = document.createElement('option');
    hbOpt.value = '500CM'; hbOpt.textContent = '500CM';
    S.cameraSel.appendChild(hbOpt);

    S.cameraSel.value = 'MP';
    refreshFilmSelect();
    var texts135 = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts135).toEqual(['Kodak Portra 400', 'Ilford Pan 400', 'Other (free text)']);
    var labels135 = Array.prototype.map.call(S.filmSel.querySelectorAll('optgroup'), function(g) { return g.label; });
    expect(labels135).toEqual(['Negative Film', 'Black & White']);

    S.cameraSel.value = '500CM';
    refreshFilmSelect();
    var texts120 = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts120).toEqual(['Kodak Portra 400', 'Alien 5207 250D', 'Reflx Lab 5219 500T', 'Other (free text)']);
    var labels120 = Array.prototype.map.call(S.filmSel.querySelectorAll('optgroup'), function(g) { return g.label; });
    expect(labels120).toEqual(['Negative Film', 'Cine Film']);
  });

  it('shows all films for a custom camera', function() {
    S.CAMERAS = [{ make: 'Leica', model: 'MP', format: '135', lenses: [] }];
    S.films = [
      { name: 'Portra 400', iso: '400', format: 'both', category: 'negative' },
      { name: 'Ilford Pan 400', iso: '400', format: '135', category: 'bw' },
      { name: 'Reflx Lab 5219 500T', iso: '500', format: '120', category: 'cine' }
    ];
    initGear(S);
    var customOpt = document.createElement('option');
    customOpt.value = '__custom__'; customOpt.textContent = 'Other';
    S.cameraSel.appendChild(customOpt);
    S.cameraSel.value = '__custom__';
    refreshFilmSelect();
    var texts = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts).toEqual(['Portra 400', 'Reflx Lab 5219 500T', 'Ilford Pan 400', 'Other (free text)']);
  });
  it('sorts embedded numbers numerically (50D before 400D)', function() {
    S.CAMERAS = [{ make: 'Leica', model: 'Leica MP', format: '135', lenses: [] }];
    S.films = [
      { name: 'CineStill 400D', iso: '400', format: 'both', category: 'cine' },
      { name: 'CineStill 50D', iso: '50', format: 'both', category: 'cine' },
      { name: 'CineStill 800T', iso: '800', format: 'both', category: 'cine' }
    ];
    initGear(S);
    var mpOpt = document.createElement('option');
    mpOpt.value = 'Leica MP'; mpOpt.textContent = 'Leica MP';
    S.cameraSel.appendChild(mpOpt);
    S.cameraSel.value = 'Leica MP';
    refreshFilmSelect();
    var texts = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts).toEqual(['CineStill 50D', 'CineStill 400D', 'CineStill 800T', 'Other (free text)']);
  });

  it('drops a saved custom film that duplicates a preset name', function() {
    localStorage.setItem('filmtag-custom-opts', JSON.stringify({
      filmName: [{ name: 'HARMAN PHOENIX II 200', iso: '200', format: 'both', category: 'negative' }]
    }));
    S.CAMERAS = [{ make: 'Leica', model: 'Leica MP', format: '135', lenses: [] }];
    S.films = [
      { name: 'Harman Phoenix II 200', iso: '200', format: 'both', category: 'negative' }
    ];
    initGear(S);
    var mpOpt = document.createElement('option');
    mpOpt.value = 'Leica MP'; mpOpt.textContent = 'Leica MP';
    S.cameraSel.appendChild(mpOpt);
    S.cameraSel.value = 'Leica MP';
    refreshFilmSelect();
    var texts = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts).toEqual(['Harman Phoenix II 200', 'Other (free text)']);
  });

  it('uses the chosen format for a custom camera', function() {
    S.CAMERAS = [{ make: 'Leica', model: 'Leica MP', format: '135', lenses: [] }];
    S.films = [
      { name: 'Portra 400', iso: '400', format: 'both', category: 'negative' },
      { name: 'Ilford Pan 400', iso: '400', format: '135', category: 'bw' },
      { name: 'Reflx Lab 5219 500T', iso: '500', format: '120', category: 'cine' }
    ];
    var fmt = document.createElement('select');
    fmt.id = 'camera-format-custom';
    fmt.innerHTML = '<option value="135">135</option><option value="120">120</option>';
    document.body.appendChild(fmt);
    initGear(S);
    var customOpt = document.createElement('option');
    customOpt.value = '__custom__'; customOpt.textContent = 'Other';
    S.cameraSel.appendChild(customOpt);
    S.cameraSel.value = '__custom__';

    fmt.value = '120';
    refreshFilmSelect();
    var texts120 = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts120).toEqual(['Portra 400', 'Reflx Lab 5219 500T', 'Other (free text)']);

    fmt.value = '135';
    refreshFilmSelect();
    var texts135 = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts135).toEqual(['Portra 400', 'Ilford Pan 400', 'Other (free text)']);
  });

  it('limits the custom film format choices to the camera format or both', function() {
    S.CAMERAS = [
      { make: 'Leica', model: 'MP', format: '135', lenses: [] },
      { make: 'Hasselblad', model: '500CM', format: '120', lenses: [] }
    ];
    S.films = [];
    var fmtSel = document.createElement('select');
    fmtSel.id = 'film-format-custom';
    fmtSel.innerHTML = '<option value="135">135</option><option value="120">120</option><option value="both">both</option>';
    document.body.appendChild(fmtSel);
    initGear(S);
    var mpOpt = document.createElement('option');
    mpOpt.value = 'MP'; mpOpt.textContent = 'MP';
    S.cameraSel.appendChild(mpOpt);
    var hbOpt = document.createElement('option');
    hbOpt.value = '500CM'; hbOpt.textContent = '500CM';
    S.cameraSel.appendChild(hbOpt);

    S.cameraSel.value = 'MP';
    refreshFilmSelect();
    var values135 = Array.prototype.map.call(fmtSel.options, function(o) { return o.value; });
    expect(values135).toEqual(['135', 'both']);

    S.cameraSel.value = '500CM';
    refreshFilmSelect();
    var values120 = Array.prototype.map.call(fmtSel.options, function(o) { return o.value; });
    expect(values120).toEqual(['120', 'both']);
  });

  it('places saved custom films in their chosen category and filters by format', function() {
    localStorage.setItem('filmtag-custom-opts', JSON.stringify({
      filmName: [
        { name: 'My 120 Stock', iso: '400', format: '120', category: 'bw' },
        { name: 'My Both Stock', iso: '200', format: 'both', category: 'negative' },
        'Legacy Stock'
      ]
    }));
    S.CAMERAS = [
      { make: 'Leica', model: 'MP', format: '135', lenses: [] },
      { make: 'Hasselblad', model: '500CM', format: '120', lenses: [] }
    ];
    S.films = [];
    initGear(S);
    var mpOpt = document.createElement('option');
    mpOpt.value = 'MP'; mpOpt.textContent = 'MP';
    S.cameraSel.appendChild(mpOpt);
    var hbOpt = document.createElement('option');
    hbOpt.value = '500CM'; hbOpt.textContent = '500CM';
    S.cameraSel.appendChild(hbOpt);

    S.cameraSel.value = 'MP';
    refreshFilmSelect();
    var texts135 = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts135).toEqual(['Legacy Stock', 'My Both Stock', 'Other (free text)']);
    var labels135 = Array.prototype.map.call(S.filmSel.querySelectorAll('optgroup'), function(g) { return g.label; });
    expect(labels135).toEqual(['Negative Film']);

    S.cameraSel.value = '500CM';
    refreshFilmSelect();
    var texts120 = Array.prototype.map.call(S.filmSel.options, function(o) { return o.textContent; });
    expect(texts120).toEqual(['Legacy Stock', 'My Both Stock', 'My 120 Stock', 'Other (free text)']);
    var labels120 = Array.prototype.map.call(S.filmSel.querySelectorAll('optgroup'), function(g) { return g.label; });
    expect(labels120).toEqual(['Negative Film', 'Black & White']);
  });
});

describe('camera format grouping', function() {
  it('groups cameras by format (135 then 120), A-Z inside each group', function() {
    S.CAMERAS = [
      { make: 'Hasselblad', model: 'Hasselblad 500CM', format: '120', lenses: [] },
      { make: 'Nikon', model: 'Nikon FM2', format: '135', lenses: [] },
      { make: 'Leica', model: 'Leica MP', format: '135', lenses: [] }
    ];
    initGear(S);
    refreshCameraSelect();

    var texts = Array.prototype.map.call(S.cameraSel.options, function(o) { return o.textContent; });
    expect(texts).toEqual(['Leica MP', 'Nikon FM2', 'Hasselblad 500CM', 'Other (free text)']);
    var labels = Array.prototype.map.call(S.cameraSel.querySelectorAll('optgroup'), function(g) { return g.label; });
    expect(labels).toEqual(['135 Format', '120 Format']);
  });

  it('sorts saved custom cameras A-Z under the Custom group', function() {
    localStorage.setItem('filmtag-custom-opts', JSON.stringify({
      cameraModel: ['Zenit 12', 'Agfa Isolette']
    }));
    S.CAMERAS = [{ make: 'Leica', model: 'Leica MP', format: '135', lenses: [] }];
    initGear(S);
    refreshCameraSelect();

    var texts = Array.prototype.map.call(S.cameraSel.options, function(o) { return o.textContent; });
    expect(texts).toEqual(['Leica MP', 'Agfa Isolette', 'Zenit 12', 'Other (free text)']);
    var labels = Array.prototype.map.call(S.cameraSel.querySelectorAll('optgroup'), function(g) { return g.label; });
    expect(labels).toEqual(['135 Format', 'Custom']);
  });

  it('keeps the current camera selected after a rebuild', function() {
    S.CAMERAS = [
      { make: 'Leica', model: 'Leica MP', format: '135', lenses: [] },
      { make: 'Hasselblad', model: 'Hasselblad 500CM', format: '120', lenses: [] }
    ];
    initGear(S);
    refreshCameraSelect();
    S.cameraSel.value = 'Hasselblad 500CM';
    refreshCameraSelect();
    expect(S.cameraSel.value).toBe('Hasselblad 500CM');
  });
});

describe('manage overlay grouping', function() {
  it('groups film stocks by category in the settings overlay', function() {
    var body = document.createElement('div');
    body.id = 'manage-body';
    document.body.appendChild(body);
    S.films = [
      { name: 'Kodak Portra 400', category: 'negative' },
      { name: 'CineStill 800T', category: 'cine' },
      { name: 'Kodak Ektachrome E100', category: 'slide' },
      { name: 'Ilford Pan 400', category: 'bw' }
    ];
    setDefaultItems('filmName', ['Kodak Portra 400', 'CineStill 800T', 'Kodak Ektachrome E100', 'Ilford Pan 400']);
    initGear(S);
    renderManageOverlay('filmName');

    var text = body.textContent;
    var positions = ['Negative Film', 'Cine Film', 'Slide Film', 'Black & White'].map(function(label) {
      return text.indexOf(label);
    });
    expect(positions[0]).toBeGreaterThan(-1);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(positions[2]).toBeLessThan(positions[3]);
  });

  it('collapses a category group when its header is clicked', function() {
    var body = document.createElement('div');
    body.id = 'manage-body';
    document.body.appendChild(body);
    S.films = [
      { name: 'Kodak Portra 400', category: 'negative' },
      { name: 'CineStill 800T', category: 'cine' }
    ];
    setDefaultItems('filmName', ['Kodak Portra 400', 'CineStill 800T']);
    initGear(S);
    renderManageOverlay('filmName');

    var header = document.querySelector('.manage-group-header[data-group="filmName:cine"]');
    header.dispatchEvent(new Event('click'));

    var groupBody = document.querySelector('.manage-group-body[data-group="filmName:cine"]');
    expect(groupBody.style.display).toBe('none');

    // restore state for other tests
    document.querySelector('.manage-group-header[data-group="filmName:cine"]').dispatchEvent(new Event('click'));
  });

  it('groups cameras by format in the settings overlay', function() {
    var body = document.createElement('div');
    body.id = 'manage-body';
    document.body.appendChild(body);
    S.CAMERAS = [
      { make: 'Leica', model: 'Leica MP', format: '135', lenses: [] },
      { make: 'Hasselblad', model: 'Hasselblad 500CM', format: '120', lenses: [] }
    ];
    setDefaultItems('cameraModel', ['Leica MP', 'Hasselblad 500CM']);
    initGear(S);
    renderManageOverlay('cameraModel');

    var text = body.textContent;
    expect(text.indexOf('135 Format')).toBeLessThan(text.indexOf('120 Format'));
    expect(text.indexOf('135 Format')).toBeGreaterThan(-1);
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
