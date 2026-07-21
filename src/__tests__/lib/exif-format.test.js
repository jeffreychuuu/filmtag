import { describe, it, expect } from 'vitest';
import { fmtSoftware, parseSoftware, fmtInstructions, parseInstructions, fmtCopyright, parseCopyright, fmtImageDescription, parseImageDescription, fmtUserComment, parseUserComment, tryFixUtf8 } from '../../lib/exif-format.js';

describe('fmtSoftware / parseSoftware', () => {
  it('formats software with suffix', () => {
    expect(fmtSoftware('Noritsu HS-1800')).toBe('Noritsu HS-1800 (FilmTag by Jeffrey Chu)');
  });

  it('round-trips software parsing', () => {
    expect(parseSoftware(fmtSoftware('Fuji SP3000'))).toBe('Fuji SP3000');
  });

  it('returns null for non-FilmTag software', () => {
    expect(parseSoftware('Adobe Lightroom')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseSoftware('')).toBeNull();
  });
});

describe('fmtInstructions / parseInstructions', () => {
  it('formats process and pushpull', () => {
    expect(fmtInstructions('C-41', 'Normal')).toBe('C-41 (Normal)');
  });

  it('round-trips instructions parsing', () => {
    expect(parseInstructions(fmtInstructions('ECN-2', 'Push +1'))).toEqual({ process: 'ECN-2', pushpull: 'Push +1' });
  });

  it('handles process without pushpull', () => {
    expect(parseInstructions('D-76')).toEqual({ process: 'D-76', pushpull: '' });
  });

  it('returns null for empty input', () => {
    expect(parseInstructions('')).toBeNull();
  });
});

describe('fmtCopyright / parseCopyright', () => {
  it('formats copyright string', () => {
    var result = fmtCopyright('Megatoni', 'C-41', 'Noritsu HS-1800');
    expect(result).toContain('Megatoni');
    expect(result).toContain('C-41');
    expect(result).toContain('Noritsu HS-1800');
  });

  it('round-trips copyright parsing', () => {
    var result = parseCopyright(fmtCopyright('DOT-WELL', 'ECN-2', 'Fuji SP3000'));
    expect(result.lab).toBe('DOT-WELL');
    expect(result.process).toBe('ECN-2');
    expect(result.scanner).toBe('Fuji SP3000');
  });

  it('returns empty object for null input', () => {
    expect(parseCopyright(null)).toEqual({});
  });
});

describe('fmtImageDescription / parseImageDescription', () => {
  var params = {
    artist: 'Jeffrey Chu',
    camera: { model: 'Leica MP' },
    lens: { name: 'Summilux 35mm F/1.4' },
    film: { name: 'Kodak Portra 400', iso: '400' },
    lab: 'Megatoni',
    process: 'C-41',
    pushpull: 'Normal',
    scanner: 'Noritsu HS-1800'
  };

  it('formats with public credit', () => {
    var result = fmtImageDescription(params, true);
    expect(result).toContain('FilmTag by Jeffrey Chu');
    expect(result).toContain('Photo by Jeffrey Chu');
    expect(result).toContain('Camera: Leica MP');
  });

  it('formats without public credit', () => {
    var result = fmtImageDescription(params, false);
    expect(result).not.toContain('FilmTag by Jeffrey Chu');
    expect(result).toContain('Photo by Jeffrey Chu');
  });

  it('includes shutter when provided', () => {
    var withShutter = { ...params, camera: { ...params.camera, shutter: '1/125' } };
    var result = fmtImageDescription(withShutter, false);
    expect(result).toContain('Shutter: 1/125');
  });

  it('round-trips parsing', () => {
    var result = parseImageDescription(fmtImageDescription(params, true));
    expect(result.artist).toBe('Jeffrey Chu');
    expect(result.cameraModel).toBe('Leica MP');
    expect(result.lensName).toBe('Summilux 35mm F/1.4');
    expect(result.film).toBe('Kodak Portra 400');
    expect(result.iso).toBe('400');
    expect(result.lab).toBe('Megatoni');
    expect(result.process).toBe('C-41');
    expect(result.pushpull).toBe('Normal');
    expect(result.scanner).toBe('Noritsu HS-1800');
  });

  it('returns empty object for null input', () => {
    expect(parseImageDescription(null)).toEqual({});
  });
});

describe('fmtUserComment / parseUserComment', () => {
  var params = {
    artist: 'Jeffrey Chu',
    camera: { model: 'Leica MP' },
    lens: { name: 'Summilux 35mm F/1.4' },
    film: { name: 'Kodak Portra 400', iso: '400' },
    lab: 'Megatoni',
    process: 'C-41',
    pushpull: 'Normal',
    scanner: 'Noritsu HS-1800'
  };

  it('formats with null prefix', () => {
    var result = fmtUserComment(params);
    expect(result.charCodeAt(0)).toBe(0);
    expect(result.charCodeAt(7)).toBe(0);
    expect(result).toContain('Artist: Jeffrey Chu');
    expect(result).toContain('Camera: Leica MP');
  });

  it('includes shutter when provided', () => {
    var withShutter = { ...params, camera: { ...params.camera, shutter: '1/125' } };
    var result = fmtUserComment(withShutter);
    expect(result).toContain('Shutter: 1/125');
  });

  it('round-trips parsing', () => {
    var formatted = fmtUserComment(params);
    var result = parseUserComment(formatted);
    expect(result.artist).toBe('Jeffrey Chu');
    expect(result.cameraModel).toBe('Leica MP');
    expect(result.lensName).toBe('Summilux 35mm F/1.4');
    expect(result.film).toBe('Kodak Portra 400');
    expect(result.iso).toBe('400');
    expect(result.lab).toBe('Megatoni');
    expect(result.process).toBe('C-41');
    expect(result.pushpull).toBe('Normal');
    expect(result.scanner).toBe('Noritsu HS-1800');
  });

  it('returns empty object for null input', () => {
    expect(parseUserComment(null)).toEqual({});
  });
});

describe('tryFixUtf8', () => {
  it('passes through clean ASCII', () => {
    expect(tryFixUtf8('hello')).toBe('hello');
  });

  it('fixes garbled UTF-8', () => {
    var garbled = '';
    var bytes = new TextEncoder().encode('攝影');
    for (var i = 0; i < bytes.length; i++) garbled += String.fromCharCode(bytes[i]);
    expect(tryFixUtf8(garbled)).toBe('攝影');
  });

  it('returns empty string for empty input', () => {
    expect(tryFixUtf8('')).toBe('');
  });
});
