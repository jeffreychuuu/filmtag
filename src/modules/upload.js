import piexif from 'piexifjs';
import { t } from '../i18n.js';
import { dmsToDecimal } from '../lib/utils.js';
import { selByText, setCust } from './gear.js';
import { parseSoftware, parseInstructions, parseCopyright, parseImageDescription, parseUserComment, tryFixUtf8 } from '../lib/exif-format.js';

var S;

export function init(refs) { S = refs; }

export function handleFiles(files) {
  var el = document.getElementById('upload-status');
  if (el) { el.textContent = ''; el.className = 'upload-status-msg'; }
  var rejected = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'jpg' && ext !== 'jpeg') { rejected++; continue; }
    if (!S.uploadedFiles.some(function(x) { return x.file.name === f.name && x.file.size === f.size; })) {
      S.uploadedFiles.push({ file: f });
    }
  }
  if (rejected > 0) {
    var el = document.getElementById('upload-status');
    el.textContent = t('upload_non_jpeg_warn', {n: rejected});
    el.className = 'upload-status-msg error';
  }
  S.uploadedFiles.sort(function(a, b) { return a.file.name.localeCompare(b.file.name); });
  for (var k = 0; k < S.uploadedFiles.length; k++) S.selectedSet[k] = true;
  S.currentPage = 1;
  S.renderFileList(true);
  S.reviewBtn.disabled = false;
  extractExifFromFiles();
}

function extractExifFromFiles() {
  var completed = 0;
  var total = S.uploadedFiles.length;
  if (!total) return;
  var firstPageSize = S.pageSize === 0 ? total : Math.min(S.pageSize, total);
  var firstPageDone = false;
  S.loadingText.textContent = t('extracting_exif', {n: total});
  S.loadingEl.classList.add('show');
  for (var i = 0; i < total; i++) {
    (function(idx) {
      var file = S.uploadedFiles[idx].file;
      var ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'jpg' && ext !== 'jpeg') {
        completed++;
        if (completed >= firstPageSize && !firstPageDone) { firstPageDone = true; S.renderFileList(); }
        if (completed === total) { S.renderFileList(); }
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        var bytes = new Uint8Array(e.target.result);
        var jpegStr = '';
        for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]);
        S.uploadedFiles[idx]._jpegStr = jpegStr;
        try {
          var exifObj = piexif.load(jpegStr);
          if (!S.fileDates[idx]) {
            var dt = exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] || exifObj['0th'][piexif.ImageIFD.DateTime];
            if (dt) {
              var dp = dt.split(' ')[0].split(':');
              var tp = dt.split(' ')[1].split(':');
              if (dp.length === 3 && tp.length >= 2) {
                S.fileDates[idx] = { fileDate: dp.join(''), exifDate: dp.join(':'), hr: parseInt(tp[0], 10), min: parseInt(tp[1], 10) };
                delete S.clearedDates[idx];
              }
            }
          }
          if (!S.gpsData[idx]) {
            var gps = exifObj['GPS'];
            if (gps && gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLongitude]) {
              var lat = dmsToDecimal(gps[piexif.GPSIFD.GPSLatitude], gps[piexif.GPSIFD.GPSLatitudeRef]);
              var lng = dmsToDecimal(gps[piexif.GPSIFD.GPSLongitude], gps[piexif.GPSIFD.GPSLongitudeRef]);
              if (lat !== null && lng !== null) {
                S.gpsData[idx] = { lat: lat, lng: lng, addr: '' };
                S.reverseGeocode(lat, lng, [idx]);
              }
            }
          }
        } catch(_) {}
        completed++;
        if (completed >= firstPageSize && !firstPageDone) { firstPageDone = true; S.renderFileList(); }
        if (completed === total) { S.renderFileList(); autoFillFromFirstFile(); }
      };
      reader.readAsArrayBuffer(file);
    })(i);
  }
}

function fillField(sel, inp, val) {
  if (!val) return;
  if (!selByText(sel, val)) setCust(sel, inp, val);
}

function autoFillFromFirstFile() {
  if (S.uploadedFiles.length === 0) return;
  var first = S.uploadedFiles[0];
  if (!first._jpegStr) return;
  try {
    var exifObj = piexif.load(first._jpegStr);
    var filled = {};

    // Artist
    var artist = exifObj['0th'][piexif.ImageIFD.Artist];
    if (artist && !selByText(S.artistSel, artist)) setCust(S.artistSel, S.artistCust, artist);

    // Camera + Lens pair: auto-fill only if both model and lens are present
    var make = exifObj['0th'][piexif.ImageIFD.Make] || '';
    var model = exifObj['0th'][piexif.ImageIFD.Model] || '';
    var lens = exifObj['Exif'][piexif.ExifIFD.LensModel];

    if (model && lens) {
      var matched = false;
      for (var ci = 0; ci < S.CAMERAS.length; ci++) {
        if (S.CAMERAS[ci].model === model) {
          S.cameraSel.selectedIndex = ci;
          S.cameraSel.dispatchEvent(new Event('change'));
          matched = true;
          break;
        }
      }
      if (!matched && !selByText(S.cameraSel, model)) {
        setCust(S.cameraSel, S.cameraCust, model);
        if (make) S.$('camera-make-custom').value = make;
      }

      if (!selByText(S.lensSel, lens)) setCust(S.lensSel, S.lensCust, lens);
      var focal = exifObj['Exif'][piexif.ExifIFD.FocalLength];
      if (focal) {
        var fv = Array.isArray(focal) ? (focal[0] / focal[1]) : focal;
        S.$('lens-focal').value = String(Math.round(fv));
      }
      var aperture = exifObj['Exif'][piexif.ExifIFD.FNumber];
      if (aperture) {
        var av = Array.isArray(aperture) ? (aperture[0] / aperture[1]) : aperture;
        S.$('lens-aperture').value = av.toFixed(1);
      }
    }

    // Parse composite strings via shared functions
    var sw = parseSoftware(exifObj['0th'][piexif.ImageIFD.Software]);
    var ins = parseInstructions(exifObj['Exif'][0x828D]);
    var cr = parseCopyright(exifObj['0th'][piexif.ImageIFD.Copyright]);
    var desc = parseImageDescription(exifObj['0th'][piexif.ImageIFD.ImageDescription]);
    var uc = parseUserComment(exifObj['Exif'][piexif.ExifIFD.UserComment]);

    // Scanner: Software → ImageDescription → UserComment
    var scannerVal = sw || desc.scanner || uc.scanner;
    if (scannerVal) { fillField(S.scanSel, S.$('scanner-custom-input'), scannerVal); filled.scanner = true; }

    // Artist: standard EXIF → UserComment (Unicode-safe) → ImageDescription
    var artistVal = artist || uc.artist || desc.artist;
    // artist already set above if found; skipping overwrite

    // Lab: UserComment (Unicode-safe) → Copyright (try UTF-8 fix) → ImageDescription (try UTF-8 fix)
    var labVal = uc.lab || tryFixUtf8(cr.lab) || tryFixUtf8(desc.lab);
    if (labVal) { fillField(S.labSel, S.$('lab-custom-input'), labVal); filled.lab = true; }

    // Process: Instructions → Copyright → UserComment → ImageDescription
    var procVal = (ins && ins.process) || cr.process || uc.process || desc.process;
    if (procVal) { fillField(S.processSel, S.$('process-custom-input'), procVal); filled.process = true; }

    // PushPull: Instructions → UserComment → ImageDescription
    var ppVal = (ins && ins.pushpull) || uc.pushpull || desc.pushpull;
    if (ppVal) { fillField(S.ppSel, S.$('pushpull-custom-input'), ppVal); filled.pushpull = true; }

    // Film matching: name match first, ISO fallback
    var rawIso = exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings];
    var isoVal = rawIso ? (Array.isArray(rawIso) ? rawIso[0] : rawIso) : null;

    if (!filled.film) {
      var filmVal = uc.film || desc.film;
      var filmIso = uc.iso || desc.iso || isoVal;
      var matchedFilm = false;

      if (filmVal) {
        for (var fi = 0; fi < S.filmSel.options.length; fi++) {
          if (S.filmSel.options[fi].textContent === filmVal) {
            S.filmSel.selectedIndex = fi;
            S.filmSel.dispatchEvent(new Event('change'));
            matchedFilm = true;
            break;
          }
        }
      }

      if (!matchedFilm && filmIso) {
        for (var fi = 0; fi < S.filmSel.options.length; fi++) {
          if (S.filmSel.options[fi].getAttribute('data-iso') == filmIso) {
            S.filmSel.selectedIndex = fi;
            S.filmSel.dispatchEvent(new Event('change'));
            matchedFilm = true;
            break;
          }
        }
      }

      if (!matchedFilm) {
        if (filmVal && !selByText(S.filmSel, filmVal)) setCust(S.filmSel, S.filmCust, filmVal);
        if (filmIso && S.$('film-iso-custom')) S.$('film-iso-custom').value = filmIso;
      }
    }

  } catch(_) {}
}
