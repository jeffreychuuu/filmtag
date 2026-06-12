import piexif from 'piexifjs';
import { t } from '../i18n.js';
import { dmsToDecimal } from '../lib/utils.js';

var S;

export function init(refs) { S = refs; }

export function handleFiles(files) {
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!S.uploadedFiles.some(function(x) { return x.file.name === f.name && x.file.size === f.size; })) {
      S.uploadedFiles.push({ file: f });
    }
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
        if (completed === total) S.renderFileList();
      };
      reader.readAsArrayBuffer(file);
    })(i);
  }
}
