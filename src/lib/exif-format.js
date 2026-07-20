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

// ---- UserComment (all fields, UTF-8 encoded) ----
// Format: 8 null bytes + UTF-8 encoded key|val pairs
// Backward compat: also handles old UNICODE\x00 + UCS-2 LE format

export function fmtUserComment(p) {
  var s = 'Artist: ' + p.artist + ' | Camera: ' + p.camera.model + ' | Lens: ' + p.lens.name;
  s += ' | Film Stock: ' + p.film.name + ' (ISO ' + p.film.iso + ')';
  s += ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' | Exposure: ' + p.pushpull;
  if (p.camera.shutter) s += ' | Shutter: ' + p.camera.shutter;
  s += ' | Scanner: ' + p.scanner;
  var encoder = new TextEncoder();
  var utf8 = encoder.encode(s);
  var raw = '';
  for (var i = 0; i < utf8.length; i++) raw += String.fromCharCode(utf8[i]);
  return '\x00\x00\x00\x00\x00\x00\x00\x00' + raw;
}

export function parseUserComment(str) {
  if (!str) return {};
  var decoded = _decodeUc(str);
  if (!decoded) return {};
  return {
    artist: _m(decoded, /Artist:\s*([^|]+)/),
    cameraModel: _m(decoded, /Camera:\s*([^|]+)/),
    lensName: _m(decoded, /Lens:\s*([^|]+)/),
    film: _m(decoded, /Film Stock:\s*([^(]+)\s*\(ISO/),
    iso: _m(decoded, /Film Stock:\s*[^(]+\s*\(ISO\s*([^)]+)\)/),
    lab: _m(decoded, /Lab:\s*([^|]+)/),
    process: _m(decoded, /Process:\s*([^|]+)/),
    pushpull: _m(decoded, /Exposure:\s*([^|]+)/),
    scanner: _m(decoded, /Scanner:\s*([^|]+)/),
    shutter: _m(decoded, /Shutter:\s*([^|]+)/)
  };
}

function _decodeUc(str) {
  // New UTF-8 format: 8 null bytes prefix
  if (str.charCodeAt(0) === 0 && str.charCodeAt(1) === 0 && str.charCodeAt(2) === 0 && str.charCodeAt(3) === 0 &&
      str.charCodeAt(4) === 0 && str.charCodeAt(5) === 0 && str.charCodeAt(6) === 0 && str.charCodeAt(7) === 0) {
    var raw = str.slice(8);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    try { return new TextDecoder('utf-8').decode(bytes); } catch(_) {}
  }
  // Old UCS-2 LE format: UNICODE\x00 prefix (backward compat)
  if (str.indexOf('UNICODE') === 0) {
    var raw2 = str.slice(8);
    var out = '';
    for (var j = 0; j < raw2.length - 1; j += 2) {
      out += String.fromCharCode(raw2.charCodeAt(j) | (raw2.charCodeAt(j + 1) << 8));
    }
    return out;
  }
  return '';
}

// ---- internal ----

function _m(s, re) {
  var r = s.match(re);
  return r ? r[1].trim() : null;
}
