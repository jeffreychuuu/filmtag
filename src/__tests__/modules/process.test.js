import { describe, it, expect } from 'vitest';
import { resolveLensForFile } from '../../modules/process.js';

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
