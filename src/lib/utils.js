import piexif from 'piexifjs';

// Convert decimal degrees to EXIF GPS DMS format
export function toDms(coord) {
  var abs = Math.abs(coord);
  var d = Math.floor(abs);
  var m = Math.floor((abs - d) * 60);
  var s = Math.round(((abs - d) * 60 - m) * 60 * 100);
  return [[d, 1], [m, 1], [s, 100]];
}

// Encode JS string to UTF-8 binary for XMP segment embedding
export function strToUtf8Binary(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c < 0x800) {
      out += String.fromCharCode(0xC0 | (c >> 6));
      out += String.fromCharCode(0x80 | (c & 0x3F));
    } else if (c >= 0xD800 && c < 0xE000) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
      out += String.fromCharCode(0xF0 | (cp >> 18));
      out += String.fromCharCode(0x80 | ((cp >> 12) & 0x3F));
      out += String.fromCharCode(0x80 | ((cp >> 6) & 0x3F));
      out += String.fromCharCode(0x80 | (cp & 0x3F));
      i++;
    } else {
      out += String.fromCharCode(0xE0 | (c >> 12));
      out += String.fromCharCode(0x80 | ((c >> 6) & 0x3F));
      out += String.fromCharCode(0x80 | (c & 0x3F));
    }
  }
  return out;
}

// Encode JS string to UCS-2 little-endian for EXIF UserComment
export function toUcs2Binary(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    out += String.fromCharCode(c & 0xFF, (c >> 8) & 0xFF);
  }
  return out;
}

// Escape XML special characters for XMP metadata
export function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Insert or replace XMP metadata segment (Label, Creator, Credit, DateCreated, Description) in JPEG binary
export function injectXmp(jpegStr, params, lab, process, scanner) {
  var xmpXML = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about=""' +
    ' xmlns:xmp="http://ns.adobe.com/xap/1.0/"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"' +
    ' xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">' +
    '<xmp:Label>' + escXml(params.film.name + ' (' + params.pushpull + ')') + '</xmp:Label>' +
    '<xmp:Creator>' + escXml(params.author) + '</xmp:Creator>' +
    '<photoshop:Credit>' + escXml('Processed by ' + lab + ' (' + process + ') | Scanned via ' + scanner) + '</photoshop:Credit>' +
    '<xmp:DateCreated>' + escXml(params.dateTime) + '</xmp:DateCreated>' +
    '<dc:creator>' + escXml(params.author) + '</dc:creator>' +
    (params.publicDesc ? '<dc:description>' + escXml('FilmTag by Jeffrey Chu | Photo by ' + params.author + ' | Camera: ' + params.camera.model + ' (' + params.lens.name + ') | Film: ' + params.film.name + ' (ISO ' + params.film.iso + ')' + (params.camera.shutter ? ' | Shutter: ' + params.camera.shutter : '') + ' | Lab: ' + lab + ' | Process: ' + process + ' (' + params.pushpull + ') | Scanner: ' + scanner) + '</dc:description>' : '<dc:description>' + escXml('Photo by ' + params.author + ' | Camera: ' + params.camera.model + ' (' + params.lens.name + ') | Film: ' + params.film.name + ' (ISO ' + params.film.iso + ')' + (params.camera.shutter ? ' | Shutter: ' + params.camera.shutter : '') + ' | Lab: ' + lab + ' | Process: ' + process + ' (' + params.pushpull + ') | Scanner: ' + scanner) + '</dc:description>') +
    '</rdf:Description>' +
    '</rdf:RDF>' +
    '</x:xmpmeta>' +
    '<?xpacket end="w"?>';

  var xmpUtf8 = strToUtf8Binary(xmpXML);
  var xmpData = 'http://ns.adobe.com/xap/1.0/\x00' + xmpUtf8;
  var segLen = xmpData.length + 2;
  var xmpSegment = '\xFF\xE1' +
    String.fromCharCode(segLen >> 8, segLen & 0xFF) +
    xmpData;

  var cleaned = '';
  var pos = 0;
  while (pos < jpegStr.length) {
    if (jpegStr.charCodeAt(pos) === 0xFF && jpegStr.charCodeAt(pos + 1) === 0xE1 &&
        jpegStr.slice(pos + 4, pos + 33) === 'http://ns.adobe.com/xap/1.0/\x00') {
      var segLen2 = (jpegStr.charCodeAt(pos + 2) << 8) | jpegStr.charCodeAt(pos + 3);
      pos += 2 + segLen2;
    } else {
      cleaned += jpegStr.charAt(pos);
      pos++;
    }
  }

  if (cleaned.charCodeAt(0) === 0xFF && cleaned.charCodeAt(1) === 0xD8) {
    return cleaned.slice(0, 2) + xmpSegment + cleaned.slice(2);
  }
  return cleaned;
}

// HTML-escape a plain text string for safe innerHTML assignment
export function esc(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

// Format byte count to human-readable label (B/KB/MB)
export function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Convert EXIF GPS DMS tuple plus N/S/E/W ref to signed decimal degrees
export function dmsToDecimal(dms, ref) {
  if (!dms || dms.length < 3) return null;
  var deg = dms[0][0] / dms[0][1];
  var min = dms[1][0] / dms[1][1];
  var sec = dms[2][0] / dms[2][1];
  var dec = deg + min / 60 + sec / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return dec;
}

// Normalise film name to PascalCase prefix for output filenames
export function newFilmPrefix(film) {
  return film
    .split(/[^a-zA-Z0-9]+/)
    .filter(function(w) { return w.length > 0; })
    .map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
    .join('');
}
