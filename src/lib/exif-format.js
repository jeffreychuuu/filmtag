import { toUcs2Binary } from './utils.js';

// ---- Software (Scanner) ----

export var SOFTWARE_SUFFIX = ' (FilmTag by Jeffrey Chu)';

export function fmtSoftware(scanner) {
  return scanner + SOFTWARE_SUFFIX;
}

export function parseSoftware(sw) {
  if (!sw) return null;
  var idx = sw.indexOf(SOFTWARE_SUFFIX);
  return idx === -1 ? null : sw.slice(0, idx);
}

// ---- 0x828D Instructions (Process + PushPull) ----

export function fmtInstructions(process, pushpull) {
  return process + ' (' + pushpull + ')';
}

export function parseInstructions(str) {
  if (!str) return null;
  var m = str.match(/^(.+?)(?:\s*\((.+?)\))?$/);
  return m ? { process: m[1].trim(), pushpull: m[2] ? m[2].trim() : '' } : null;
}

// ---- Copyright (Lab + Process + Scanner) ----

export function fmtCopyright(lab, process, scanner) {
  return 'FilmTag by Jeffrey Chu | Processed by ' + lab + ' (' + process + ') | Scanned via ' + scanner;
}

export function parseCopyright(str) {
  if (!str) return {};
  return {
    lab: _m(str, /Processed by ([^(]+)/),
    process: _m(str, /Processed by [^(]+ \(([^)]+)\)/),
    scanner: _m(str, /Scanned via ([^|]+)$/)
  };
}

// ---- ImageDescription (all fields) ----

export function fmtImageDescription(p, publicDesc) {
  var parts = [];
  if (publicDesc) parts.push('FilmTag by Jeffrey Chu');
  parts.push('Photo by ' + p.artist);
  parts.push('Camera: ' + p.camera.model + ' (' + p.lens.name + ')');
  parts.push('Film: ' + p.film.name + ' (ISO ' + p.film.iso + ')');
  if (p.camera.shutter) parts.push('Shutter: ' + p.camera.shutter);
  parts.push('Lab: ' + p.lab);
  parts.push('Process: ' + p.process + ' (' + p.pushpull + ')');
  parts.push('Scanner: ' + p.scanner);
  return parts.join(' | ');
}

var DESC_RE = {
  artist: /Photo by ([^|]+)/,
  cameraModel: /Camera: ([^(]+)/,
  lensName: /Camera: [^(]+ \(([^)]+)\)/,
  film: /Film:\s*([^(]+)\s*\(ISO/,
  iso: /Film:\s*[^(]+\s*\(ISO\s*([^)]+)\)/,
  shutter: /Shutter: ([^|]+)/,
  lab: /Lab:\s*([^|]+)/,
  process: /Process:\s*([^|]+?)(?:\s*\([^)]+\))?\s*(?:\||$)/,
  pushpull: /Process:\s*[^(]+\(([^)]+)\)/,
  scanner: /Scanner:\s*([^|]+)/
};

export function parseImageDescription(str) {
  if (!str) return {};
  var r = {};
  for (var key in DESC_RE) {
    if (DESC_RE.hasOwnProperty(key)) {
      r[key] = _m(str, DESC_RE[key]);
    }
  }
  return r;
}

// ---- UserComment (Film + Process + PushPull + Scanner) ----

export function fmtUserComment(filmName, process, pushpull, scanner, shutter) {
  var s = 'Film Stock: ' + filmName + ' | Process: ' + process + ' | Exposure: ' + pushpull;
  if (shutter) s += ' | Shutter: ' + shutter;
  s += ' | Scanner: ' + scanner;
  return 'UNICODE\x00' + toUcs2Binary(s);
}

export function parseUserComment(str) {
  if (!str || str.indexOf('UNICODE') !== 0) return {};
  var raw = str.slice(8);
  var decoded = '';
  for (var i = 0; i < raw.length - 1; i += 2) {
    decoded += String.fromCharCode(raw.charCodeAt(i) | (raw.charCodeAt(i + 1) << 8));
  }
  return {
    film: _m(decoded, /Film Stock:\s*([^|]+)/),
    process: _m(decoded, /Process:\s*([^|]+)/),
    pushpull: _m(decoded, /Exposure:\s*([^|]+)/),
    scanner: _m(decoded, /Scanner:\s*([^|]+)/),
    shutter: _m(decoded, /Shutter:\s*([^|]+)/)
  };
}

// ---- internal ----

function _m(s, re) {
  var r = s.match(re);
  return r ? r[1].trim() : null;
}
