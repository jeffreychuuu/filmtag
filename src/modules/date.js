import { newFilmPrefix } from '../lib/utils.js';

var S;

export function init(refs) { S = refs; }

export function applyDateToSelected() {
  var keys = Object.keys(S.selectedSet);
  if (!keys.length) return;
  var dv = S.singleDateInp.value, tv = S.singleTimeInp.value;
  if (!dv || !tv) return;
  var fd = dv.replace(/-/g, ''), ed = dv.replace(/-/g, ':');
  var p = tv.split(':'), h = parseInt(p[0], 10) || 0, m = parseInt(p[1], 10) || 0;
  for (var k = 0; k < keys.length; k++) {
    var mins = m + k;
    S.fileDates[keys[k]] = { fileDate: fd, exifDate: ed, hr: (h + Math.floor(mins / 60)) % 24, min: mins % 60 };
    delete S.clearedDates[keys[k]];
  }
  S.renderFileList();
}

export function refreshSegments() {
  S.renderFileList();
  S.reviewBtn.disabled = S.uploadedFiles.length === 0;
}

export function computeDateForFile(idx) {
  if (S.clearedDates[idx - 1]) return null;
  var fd = S.fileDates[idx - 1];
  if (fd) {
    var ds = fd.fileDate;
    return { date: ds.slice(0,4) + '/' + ds.slice(4,6) + '/' + ds.slice(6,8), time: String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') };
  }
  var baseTime = S.uploadedFiles[0].file.lastModified;
  var d = new Date(baseTime + (idx - 1) * 60000);
  var dd = String(d.getFullYear()) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  return { date: dd.slice(0,4) + '/' + dd.slice(4,6) + '/' + dd.slice(6,8), time: String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') };
}

export function getFileDate(i) {
  var fd = S.fileDates[i];
  if (fd) return fd;
  var baseTime = S.uploadedFiles[0].file.lastModified;
  var d = new Date(baseTime + i * 60000);
  var dd = String(d.getFullYear()) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  return { fileDate: dd, exifDate: dd.slice(0,4) + ':' + dd.slice(4,6) + ':' + dd.slice(6,8), hr: d.getHours(), min: d.getMinutes() };
}

export function newFName(film, ext, i) {
  var fd = getFileDate(i);
  var c = newFilmPrefix(film);
  return c + '_' + fd.fileDate + String(fd.hr).padStart(2,'0') + String(fd.min).padStart(2,'0') + '_' + String(i + 1).padStart(2,'0') + '.' + ext;
}
