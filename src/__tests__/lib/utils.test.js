import { describe, it, expect } from 'vitest';
import { toDms, fmtSize, dmsToDecimal, newFilmPrefix, escXml, strToUtf8Binary, toUcs2Binary, injectXmp } from '../../lib/utils.js';

describe('toDms', () => {
  it('converts positive decimal degrees', () => {
    var result = toDms(22.3193);
    expect(result[0]).toEqual([22, 1]);
    expect(result[1]).toEqual([19, 1]);
    expect(result[2][0]).toBeGreaterThan(940);
    expect(result[2][1]).toBe(100);
  });

  it('converts negative decimal degrees', () => {
    var result = toDms(-33.8688);
    expect(result[0]).toEqual([33, 1]);
    expect(result[1]).toEqual([52, 1]);
    expect(result[2][0]).toBeGreaterThan(760);
  });

  it('handles zero', () => {
    var result = toDms(0);
    expect(result).toEqual([[0, 1], [0, 1], [0, 100]]);
  });

  it('handles integer degrees', () => {
    var result = toDms(45);
    expect(result).toEqual([[45, 1], [0, 1], [0, 100]]);
  });
});

describe('strToUtf8Binary', () => {
  it('passes ASCII through unchanged', () => {
    expect(strToUtf8Binary('hello')).toBe('hello');
  });

  it('encodes Chinese characters', () => {
    var result = strToUtf8Binary('菲林');
    expect(result.length).toBeGreaterThan(2);
    expect(typeof result).toBe('string');
  });

  it('handles empty string', () => {
    expect(strToUtf8Binary('')).toBe('');
  });
});

describe('toUcs2Binary', () => {
  it('encodes ASCII to UCS-2 little-endian', () => {
    var result = toUcs2Binary('AB');
    expect(result.charCodeAt(0)).toBe(65);
    expect(result.charCodeAt(1)).toBe(0);
    expect(result.charCodeAt(2)).toBe(66);
    expect(result.charCodeAt(3)).toBe(0);
  });
});

describe('escXml', () => {
  it('escapes ampersands', () => {
    expect(escXml('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(escXml('<test>')).toBe('&lt;test&gt;');
  });

  it('escapes double quotes', () => {
    expect(escXml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('passes plain text through', () => {
    expect(escXml('hello')).toBe('hello');
  });

  it('handles mixed special chars', () => {
    expect(escXml('A&B <C> "D"')).toBe('A&amp;B &lt;C&gt; &quot;D&quot;');
  });
});

describe('fmtSize', () => {
  it('formats bytes', () => {
    expect(fmtSize(500)).toBe('500 B');
  });

  it('formats KB', () => {
    expect(fmtSize(2048)).toBe('2.0 KB');
  });

  it('formats MB', () => {
    expect(fmtSize(3145728)).toBe('3.0 MB');
  });

  it('handles zero', () => {
    expect(fmtSize(0)).toBe('0 B');
  });

  it('edge case at 1 MB boundary', () => {
    expect(fmtSize(1048576)).toBe('1.0 MB');
  });
});

describe('dmsToDecimal', () => {
  it('converts N/S reference to positive', () => {
    expect(dmsToDecimal([[22, 1], [19, 1], [936, 100]], 'N')).toBeCloseTo(22.3193, 2);
  });

  it('converts S reference to negative', () => {
    expect(dmsToDecimal([[33, 1], [52, 1], [0, 100]], 'S')).toBeCloseTo(-33.867, 2);
  });

  it('converts W reference to negative', () => {
    expect(dmsToDecimal([[73, 1], [58, 1], [0, 100]], 'W')).toBeCloseTo(-73.967, 2);
  });

  it('returns null for null input', () => {
    expect(dmsToDecimal(null, 'N')).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(dmsToDecimal([], 'N')).toBeNull();
  });
});

describe('newFilmPrefix', () => {
  it('converts film name to PascalCase prefix', () => {
    expect(newFilmPrefix('Kodak Portra 400')).toBe('KodakPortra400');
  });

  it('handles single word', () => {
    expect(newFilmPrefix('Fujifilm')).toBe('Fujifilm');
  });

  it('handles special characters', () => {
    expect(newFilmPrefix('CineStill 50D')).toBe('Cinestill50d');
  });
});

describe('injectXmp', function() {
  it('inserts XMP segment into minimal JPEG', function() {
    var jpeg = '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00';
    var params = { film: { name: 'Portra', iso: '400' }, pushpull: '0', artist: 'Test', dateTime: '2026:06:14 14:30:00', publicDesc: false, camera: { model: 'MP', shutter: null }, lens: { name: '50mm', focal: '50', aperture: '1.4' } };
    var result = injectXmp(jpeg, params, 'Lab', 'Standard', 'Scanner');
    expect(result.length).toBeGreaterThan(jpeg.length);
    expect(result.charCodeAt(0)).toBe(0xFF);
    expect(result.charCodeAt(1)).toBe(0xD8);
  });
});
