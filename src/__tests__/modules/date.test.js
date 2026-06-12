import { describe, it, expect, beforeEach } from 'vitest';
import { init, applyDateToSelected, getFileDate, computeDateForFile, newFName } from '../../modules/date.js';

var S;
beforeEach(function() {
  S = {
    selectedSet: {},
    singleDateInp: { value: '2026-06-14' },
    singleTimeInp: { value: '14:30' },
    fileDates: {},
    clearedDates: {},
    uploadedFiles: [{ file: { name: 'test.jpg', lastModified: 1718000000000 } }],
    renderFileList: function() {}
  };
  init(S);
});

describe('applyDateToSelected', function() {
  it('sets date on a single selected file', function() {
    S.selectedSet = { 0: true };
    applyDateToSelected();
    expect(S.fileDates[0]).toBeDefined();
    expect(S.fileDates[0].fileDate).toBe('20260614');
    expect(S.fileDates[0].hr).toBe(14);
    expect(S.fileDates[0].min).toBe(30);
  });

  it('auto-increments minutes for multiple files', function() {
    S.selectedSet = { 0: true, 1: true, 2: true };
    applyDateToSelected();
    expect(S.fileDates[0].min).toBe(30);
    expect(S.fileDates[1].min).toBe(31);
    expect(S.fileDates[2].min).toBe(32);
  });

  it('does nothing with empty selection', function() {
    S.selectedSet = {};
    applyDateToSelected();
    expect(Object.keys(S.fileDates).length).toBe(0);
  });

  it('does nothing with empty date input', function() {
    S.selectedSet = { 0: true };
    S.singleDateInp.value = '';
    applyDateToSelected();
    expect(Object.keys(S.fileDates).length).toBe(0);
  });
});

describe('getFileDate', function() {
  it('returns custom date when set', function() {
    S.fileDates = { 0: { fileDate: '20260614', exifDate: '2026:06:14', hr: 14, min: 30 } };
    var result = getFileDate(0);
    expect(result.fileDate).toBe('20260614');
    expect(result.hr).toBe(14);
  });

  it('falls back to lastModified when no custom date', function() {
    S.uploadedFiles = [{ file: { name: 'test.jpg', lastModified: 1718000000000 } }];
    var result = getFileDate(0);
    expect(result.fileDate).toBeDefined();
    expect(typeof result.hr).toBe('number');
  });
});

describe('computeDateForFile', function() {
  it('formats date info for display', function() {
    S.fileDates = { 0: { fileDate: '20260614', exifDate: '2026:06:14', hr: 14, min: 30 } };
    var result = computeDateForFile(1);
    expect(result.date).toBe('2026/06/14');
    expect(result.time).toBe('14:30');
  });

  it('returns null for cleared date', function() {
    S.clearedDates[0] = true;
    expect(computeDateForFile(1)).toBeNull();
  });
});

describe('newFName', function() {
  it('generates correct filename', function() {
    S.fileDates = { 0: { fileDate: '20260614', exifDate: '2026:06:14', hr: 14, min: 30 } };
    var result = newFName('Kodak Portra 400', 'jpg', 0);
    expect(result).toMatch(/KodakPortra400_20260614/);
    expect(result).toMatch(/\.jpg$/);
    expect(result).toMatch(/_01\.jpg$/);
  });

  it('handles double-digit index', function() {
    S.fileDates = { 9: { fileDate: '20260614', exifDate: '2026:06:14', hr: 14, min: 30 } };
    var result = newFName('Tri-X', 'jpg', 9);
    expect(result).toMatch(/_10\.jpg$/);
  });
});
