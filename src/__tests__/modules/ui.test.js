import { describe, it, expect, beforeEach } from 'vitest';
import { init, getTotalPages, getSummaryTotalPages, buildOptions, clearAll, removeOne } from '../../modules/ui.js';

var S;

beforeEach(function() {
  S = {
    uploadedFiles: [],
    pageSize: 5,
    currentPage: 1,
    prefetchTimer: null,
    summaryPage: 1,
    summaryPageSize: 5,
    selectedSet: {},
    gpsData: {},
    thumbnailCache: {},
    geocodeCache: {},
    fileDates: {},
    clearedDates: {},
    mapMarker: null,
    map: null,
    renderFileList: function() {},
    refreshSegments: function() {},
    rangeRowsEl: { innerHTML: '', querySelectorAll: function() { return []; }, appendChild: function() {} },
    addRangeBtn: { disabled: false }
  };
  init(S);
});

describe('getTotalPages', function() {
  it('returns 1 for empty files', function() {
    expect(getTotalPages()).toBe(1);
  });

  it('calculates correct page count', function() {
    S.uploadedFiles = new Array(10).fill({ file: {} });
    S.pageSize = 5;
    expect(getTotalPages()).toBe(2);
  });

  it('rounds up partial pages', function() {
    S.uploadedFiles = new Array(11).fill({ file: {} });
    S.pageSize = 5;
    expect(getTotalPages()).toBe(3);
  });

  it('returns 1 when pageSize is 0 (all)', function() {
    S.uploadedFiles = new Array(50).fill({ file: {} });
    S.pageSize = 0;
    expect(getTotalPages()).toBe(1);
  });
});

describe('getSummaryTotalPages', function() {
  it('returns 1 for empty files', function() {
    expect(getSummaryTotalPages()).toBe(1);
  });

  it('calculates summary page count', function() {
    S.uploadedFiles = new Array(10).fill({ file: {} });
    S.summaryPageSize = 5;
    expect(getSummaryTotalPages()).toBe(2);
  });
});

describe('buildOptions', function() {
  it('generates options with correct selection', function() {
    var html = buildOptions(3, 2, {});
    expect(html).toContain('<option value="1">1</option>');
    expect(html).toContain('<option value="2" selected>2</option>');
    expect(html).toContain('<option value="3">3</option>');
  });

  it('excludes specified indices', function() {
    var html = buildOptions(3, 2, { 1: true, 3: true });
    expect(html).not.toContain('value="1"');
    expect(html).toContain('value="2"');
    expect(html).not.toContain('value="3"');
  });

  it('handles empty excludeSet', function() {
    var html = buildOptions(3, 1, {});
    expect(html.match(/<option/g).length).toBe(3);
  });
});

describe('clearAll', function() {
  it('resets all state', function() {
    S.uploadedFiles = [{ file: { name: 'test.jpg' } }];
    S.gpsData = { 0: { lat: 22, lng: 114 } };
    S.selectedSet = { 0: true };
    S.thumbnailCache = { 0: 'data:...' };
    S.fileDates = { 0: { fileDate: '20260614' } };
    clearAll();
    expect(S.uploadedFiles.length).toBe(0);
    expect(Object.keys(S.gpsData).length).toBe(0);
    expect(Object.keys(S.selectedSet).length).toBe(0);
  });
});

describe('removeOne', function() {
  it('removes file and reindexes state', function() {
    S.uploadedFiles = [{ file: {} }, { file: {} }, { file: {} }];
    S.gpsData = { 0: { lat: 22 }, 2: { lat: 33 } };
    S.selectedSet = { 0: true };
    S.thumbnailCache = { 1: 'data:1' };
    removeOne(1);
    expect(S.uploadedFiles.length).toBe(2);
    expect(S.gpsData[0]).toBeDefined();
    expect(S.gpsData[1]).toBeDefined();
    expect(S.selectedSet[0]).toBe(true);
    expect(S.thumbnailCache[1]).toBeUndefined();
  });
});
