import { describe, it, expect } from 'vitest';
import { resolveLensForFile, zipFileName, init } from '../../modules/process.js';

describe('zipFileName', function() {
  function setDates(dates) {
    init({
      uploadedFiles: dates.map(function() { return {}; }),
      getFileDate: function(i) { return { fileDate: dates[i] }; }
    });
  }

  it('uses the roll date range and a hyphenated film name', function() {
    setDates(['20260105', '20260101', '20260103']);
    expect(zipFileName({ film: { name: 'Kodak Portra 400' } }))
      .toBe('filmtag_20260101_20260105_Kodak-Portra-400.zip');
  });

  it('uses a single date when the whole roll was shot on one day', function() {
    setDates(['20260201', '20260201']);
    expect(zipFileName({ film: { name: 'CineStill 800T' } }))
      .toBe('filmtag_20260201_CineStill-800T.zip');
  });

  it('omits the film name when it is missing', function() {
    setDates(['20260301']);
    expect(zipFileName({ film: { name: '' } })).toBe('filmtag_20260301.zip');
  });
});

describe('resolveLensForFile', function() {
  var defaultLens = { name: '50mm', focal: '50', aperture: '1.4' };

  it('uses the per-file exception when present', function() {
    var lensByFile = { 1: { name: '35mm', focal: '35', aperture: '2' } };
    expect(resolveLensForFile(1, lensByFile, defaultLens).name).toBe('35mm');
  });

  it('falls back to the roll default when no exception exists', function() {
    var lensByFile = { 1: { name: '35mm' } };
    expect(resolveLensForFile(0, lensByFile, defaultLens).name).toBe('50mm');
  });

  it('handles a missing lens map', function() {
    expect(resolveLensForFile(0, null, defaultLens).name).toBe('50mm');
  });
});
