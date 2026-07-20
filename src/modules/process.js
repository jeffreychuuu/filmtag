import piexif from 'piexifjs';
import JSZip from 'jszip';
import { t } from '../i18n.js';
import { toDms, toUcs2Binary, injectXmp } from '../lib/utils.js';

var S;

function updatePhotoCount(n) {
  fetch('/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'photos', amount: n }) }).then(function(r) { return r.json(); }).then(function(d) {
    if (!d || d.count == null) return;
    var el = document.getElementById('photo-count');
    if (el) el.textContent = d.count.toLocaleString();
  }).catch(function() {});
}

export function init(refs) { S = refs; }

function addContactSheetIfEnabled(files, params, zip, processedFiles, onDone) {
  var toggle = document.getElementById('contact-sheet-toggle');
  if (!toggle || !toggle.checked) { onDone(); return; }
  generateContactSheet(files, params, function(blob) {
    if (!blob) { onDone(); return; }
    if (zip) zip.file('contact_sheet.jpg', blob, { binary: true });
    if (processedFiles) processedFiles.push({ name: 'contact_sheet.jpg', blob: new Blob([blob], { type: 'image/jpeg' }) });
    onDone();
  });
}

export function startZipProcess() {
  S.summaryPanel.classList.remove('show');
  var p = S.collect();
  S.reviewBtn.disabled = true;
  S.progressSec.classList.add('show');
  S.statusMsg.className = 'status-msg'; S.statusMsg.style.display = 'none';
  var total = S.uploadedFiles.length, zip = new JSZip();
  var completed = 0, nextIdx = 0, active = 0, CONCURRENCY = 4;

  function startNext() {
    while (active < CONCURRENCY && nextIdx < total) {
      var idx = nextIdx++; active++;
      processFile(idx);
    }
    if (active === 0 && completed === total) {
      addContactSheetIfEnabled(S.uploadedFiles, p, zip, null, function() {
      S.progText.textContent = t('creating_zip');
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = 'filmtag_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        S.progBar.style.width = '100%'; S.progText.textContent = t('done_processed', {n: total});
        showStatus(t('processed_success', {n: total}), 'success');
        S.reviewBtn.disabled = false;
        S.saveCustomOpts();
        S.saveLastSession();
        updatePhotoCount(total);
        var spin = S._('progress-spinner'), done = S._('progress-done');
        if (spin) spin.style.display = 'none'; if (done) done.style.display = 'flex';
        var nextBtn = S._('progress-next-btn');
        if (nextBtn) nextBtn.style.display = 'inline-block';
      });
    }); // end addContactSheetIfEnabled
    }
  }

  function processFile(idx) {
    var entry = S.uploadedFiles[idx], ext = entry.file.name.split('.').pop().toLowerCase();
    var fd = S.getFileDate(idx);
    var nn = S.newFName(p.film.name, ext, idx);
    var reader = new FileReader();
    reader.onload = function(e) {
      var bytes = new Uint8Array(e.target.result);
      if (ext === 'jpg' || ext === 'jpeg') {
        try {
          var jpegStr = entry._jpegStr || '';
          if (!jpegStr) { for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]); }
          var exifObj;
          try { exifObj = piexif.load(jpegStr); } catch(_) { exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null }; }
          exifObj['0th'][piexif.ImageIFD.Make] = p.camera.make;
          exifObj['0th'][piexif.ImageIFD.Model] = p.camera.model;
          exifObj['0th'][piexif.ImageIFD.Artist] = p.artist;
          exifObj['0th'][piexif.ImageIFD.Software] = p.scanner + ' (FilmTag by Jeffrey Chu)';
          exifObj['Exif'][0x828D] = p.process + ' (' + p.pushpull + ')';
          var dateTimeStr = fd.exifDate + ' ' + String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') + ':00+08:00';
          exifObj['0th'][piexif.ImageIFD.DateTime] = dateTimeStr;
          exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateTimeStr;
          exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = dateTimeStr;
          exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = parseInt(p.film.iso, 10) || 400;
          exifObj['Exif'][piexif.ExifIFD.LensModel] = p.lens.name;
          if (p.lens.focal) {
            var fl = parseFloat(p.lens.focal);
            exifObj['Exif'][piexif.ExifIFD.FocalLength] = Number.isInteger(fl) ? [fl, 1] : [Math.round(fl * 100), 100];
          }
          if (p.lens.aperture) {
            var ap = Math.round(parseFloat(p.lens.aperture) * 100);
            exifObj['Exif'][piexif.ExifIFD.FNumber] = [ap, 100];
            exifObj['Exif'][piexif.ExifIFD.MaxApertureValue] = [ap, 100];
            exifObj['Exif'][piexif.ExifIFD.ApertureValue] = [ap, 100];
          }
          if (p.camera.shutter) {
            var sf = p.camera.shutter.split('/');
            if (sf.length === 2) {
              exifObj['Exif'][piexif.ExifIFD.ExposureTime] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
              exifObj['Exif'][piexif.ExifIFD.ShutterSpeedValue] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
            }
          }
          exifObj['Exif'][piexif.ExifIFD.UserComment] = 'UNICODE\x00' + toUcs2Binary('Film Stock: ' + p.film.name + ' | Process: ' + p.process + ' | Exposure: ' + p.pushpull + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Scanner: ' + p.scanner);
          exifObj['0th'][piexif.ImageIFD.ImageDescription] = (S._('public-checkbox').checked ? 'FilmTag by Jeffrey Chu | ' : '') + 'Photo by ' + p.artist + ' | Camera: ' + p.camera.model + ' (' + p.lens.name + ') | Film: ' + p.film.name + ' (ISO ' + p.film.iso + ')' + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' (' + p.pushpull + ') | Scanner: ' + p.scanner;
          exifObj['0th'][piexif.ImageIFD.Copyright] = 'FilmTag by Jeffrey Chu | ' + 'Processed by ' + p.lab + ' (' + p.process + ') | Scanned via ' + p.scanner;
          var gps = S.gpsData[idx];
          if (gps) {
            exifObj['GPS'] = exifObj['GPS'] || {};
            exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = toDms(gps.lat);
            exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = gps.lat >= 0 ? 'N' : 'S';
            exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = toDms(gps.lng);
            exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = gps.lng >= 0 ? 'E' : 'W';
          }
          var exifBytes = piexif.dump(exifObj);
          var newStr = piexif.insert(exifBytes, jpegStr);
          p.dateTime = dateTimeStr;
          p.publicDesc = S._('public-checkbox').checked;
          newStr = injectXmp(newStr, p, p.lab, p.process, p.scanner);
          bytes = new Uint8Array(newStr.length);
          for (var b2 = 0; b2 < newStr.length; b2++) bytes[b2] = newStr.charCodeAt(b2) & 0xFF;
        } catch(err) { console.warn('EXIF write failed', err); }
      }
      zip.file(nn, bytes, { binary: true });
      completed++; active--;
      S.progBar.style.width = Math.round((completed / total) * 100) + '%';
      S.progText.textContent = t('processing_of', {i: completed, n: total});
      startNext();
    };
    reader.readAsArrayBuffer(entry.file);
  }
  startNext();
}

export function startSaveProcess() {
  S.summaryPanel.classList.remove('show');
  var p = S.collect();
  S.reviewBtn.disabled = true;
  S.progressSec.classList.add('show');
  S.statusMsg.className = 'status-msg'; S.statusMsg.style.display = 'none';
  S.processedFiles = [];
  var total = S.uploadedFiles.length, zip = new JSZip();
  var completed = 0, nextIdx = 0, active = 0, CONCURRENCY = 4;

  function startNext() {
    while (active < CONCURRENCY && nextIdx < total) {
      var idx = nextIdx++; active++;
      processFile(idx);
    }
    if (active === 0 && completed === total) {
      addContactSheetIfEnabled(S.uploadedFiles, p, zip, S.processedFiles, function() {
      S.progText.textContent = t('done_processed', {n: total});
      var spin = S._('progress-spinner'), done = S._('progress-done');
      if (spin) spin.style.display = 'none'; if (done) done.style.display = 'flex';
      S.reviewBtn.disabled = false;
      S.saveCustomOpts();
      S.saveLastSession();
      updatePhotoCount(total);
      showGallery(S.processedFiles, p, zip);
      });
    }
  }

  function processFile(idx) {
    var entry = S.uploadedFiles[idx], ext = entry.file.name.split('.').pop().toLowerCase();
    var fd = S.getFileDate(idx);
    var nn = S.newFName(p.film.name, ext, idx);
    var reader = new FileReader();
    reader.onload = function(e) {
      var bytes = new Uint8Array(e.target.result);
      if (ext === 'jpg' || ext === 'jpeg') {
        try {
          var jpegStr = entry._jpegStr || '';
          if (!jpegStr) { for (var b = 0; b < bytes.length; b++) jpegStr += String.fromCharCode(bytes[b]); }
          var exifObj;
          try { exifObj = piexif.load(jpegStr); } catch(_) { exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null }; }
          exifObj['0th'][piexif.ImageIFD.Make] = p.camera.make;
          exifObj['0th'][piexif.ImageIFD.Model] = p.camera.model;
          exifObj['0th'][piexif.ImageIFD.Artist] = p.artist;
          exifObj['0th'][piexif.ImageIFD.Software] = p.scanner + ' (FilmTag by Jeffrey Chu)';
          var dt = fd.exifDate + ' ' + String(fd.hr).padStart(2,'0') + ':' + String(fd.min).padStart(2,'0') + ':00+08:00';
          exifObj['0th'][piexif.ImageIFD.DateTime] = dt;
          exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dt;
          exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = dt;
          exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = parseInt(p.film.iso, 10) || 400;
          exifObj['Exif'][piexif.ExifIFD.LensModel] = p.lens.name;
          if (p.lens.focal) {
            var fl = parseFloat(p.lens.focal);
            exifObj['Exif'][piexif.ExifIFD.FocalLength] = Number.isInteger(fl) ? [fl, 1] : [Math.round(fl * 100), 100];
          }
          if (p.lens.aperture) {
            var ap = Math.round(parseFloat(p.lens.aperture) * 100);
            exifObj['Exif'][piexif.ExifIFD.FNumber] = [ap, 100];
            exifObj['Exif'][piexif.ExifIFD.MaxApertureValue] = [ap, 100];
            exifObj['Exif'][piexif.ExifIFD.ApertureValue] = [ap, 100];
          }
          if (p.camera.shutter) {
            var sf = p.camera.shutter.split('/');
            if (sf.length === 2) {
              exifObj['Exif'][piexif.ExifIFD.ExposureTime] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
              exifObj['Exif'][piexif.ExifIFD.ShutterSpeedValue] = [parseInt(sf[0], 10), parseInt(sf[1], 10)];
            }
          }
          exifObj['Exif'][piexif.ExifIFD.UserComment] = 'UNICODE\x00' + toUcs2Binary('Film Stock: ' + p.film.name + ' | Process: ' + p.process + ' | Exposure: ' + p.pushpull + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Scanner: ' + p.scanner);
          exifObj['Exif'][0x828D] = p.process + ' (' + p.pushpull + ')';
          exifObj['0th'][piexif.ImageIFD.ImageDescription] = (S._('public-checkbox').checked ? 'FilmTag by Jeffrey Chu | ' : '') + 'Photo by ' + p.artist + ' | Camera: ' + p.camera.model + ' (' + p.lens.name + ') | Film: ' + p.film.name + ' (ISO ' + p.film.iso + ')' + (p.camera.shutter ? ' | Shutter: ' + p.camera.shutter : '') + ' | Lab: ' + p.lab + ' | Process: ' + p.process + ' (' + p.pushpull + ') | Scanner: ' + p.scanner;
          exifObj['0th'][piexif.ImageIFD.Copyright] = 'FilmTag by Jeffrey Chu | ' + 'Processed by ' + p.lab + ' (' + p.process + ') | Scanned via ' + p.scanner;
          var gps2 = S.gpsData[idx];
          if (gps2) {
            exifObj['GPS'] = exifObj['GPS'] || {};
            exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = toDms(gps2.lat);
            exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = gps2.lat >= 0 ? 'N' : 'S';
            exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = toDms(gps2.lng);
            exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = gps2.lng >= 0 ? 'E' : 'W';
          }
          var exifBytes = piexif.dump(exifObj);
          var newStr = piexif.insert(exifBytes, jpegStr);
          p.dateTime = dt;
          p.publicDesc = S._('public-checkbox').checked;
          newStr = injectXmp(newStr, p, p.lab, p.process, p.scanner);
          bytes = new Uint8Array(newStr.length);
          for (var b2 = 0; b2 < newStr.length; b2++) bytes[b2] = newStr.charCodeAt(b2) & 0xFF;
        } catch(err) { console.warn('EXIF write failed', err); }
      }
      zip.file(nn, bytes, { binary: true });
      S.processedFiles.push({ name: nn, blob: new Blob([bytes], { type: entry.file.type || 'image/jpeg' }) });
      completed++; active--;
      S.progBar.style.width = Math.round((completed / total) * 100) + '%';
      S.progText.textContent = t('processing_of', {i: completed, n: total});
      startNext();
    };
    reader.readAsArrayBuffer(entry.file);
  }
  startNext();
}

export function showGallery(files, params, zip) {
  S.galleryTitle.textContent = t('files_ready', {n: files.length});
  S.galleryGrid.innerHTML = '';
  for (var i = 0; i < files.length; i++) {
    (function(f) {
      var item = document.createElement('div');
      item.className = 'gallery-item';
      var canvas = document.createElement('canvas');
      canvas.width = 150; canvas.height = 150;
      var ctx = canvas.getContext('2d');
      var img = new Image();
      img.onload = function() {
        var scale = Math.min(150 / img.width, 150 / img.height);
        var w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (150 - w) / 2, (150 - h) / 2, w, h);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f.blob);
      canvas.addEventListener('click', function(e) {
        e.stopPropagation();
        var url = URL.createObjectURL(f.blob);
        S.imgOverlayImg.src = url;
        S.imgOverlayImg.onload = function() { URL.revokeObjectURL(url); };
        S.imgOverlay.classList.add('show');
      });
      item.appendChild(canvas);
      var nameEl = document.createElement('div');
      nameEl.className = 'g-name'; nameEl.textContent = f.name;
      item.appendChild(nameEl);
      var saveBtn2 = document.createElement('button');
      saveBtn2.className = 'g-save-btn'; saveBtn2.textContent = t('save');
      saveBtn2.addEventListener('click', function() {
        var file = new File([f.blob], f.name, { type: 'image/jpeg' });
        if (/iPhone|iPad|Android/.test(navigator.userAgent) && navigator.share) {
          navigator.share({ files: [file] }).catch(function(){});
        } else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(f.blob);
          a.download = f.name;
          a.click();
        }
      });
      item.appendChild(saveBtn2);
      S.galleryGrid.appendChild(item);
    })(files[i]);
  }
  var nextBtn = S._('progress-next-btn');
  if (nextBtn) nextBtn.style.display = 'none';
  S.gallery.classList.add('show');
  S.galleryZipBtn.onclick = function() {
    zip.generateAsync({ type: 'blob' }).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'filmtag_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });
  };
  var newBtn = S._('gallery-new-btn');
  if (newBtn) newBtn.onclick = function() {
    S.gallery.classList.add('fade-out');
    setTimeout(function() { history.scrollRestoration = 'manual'; location.reload(); }, 300);
  };
}

export function showStatus(msg, type) {
  S.statusMsg.textContent = msg; S.statusMsg.className = 'status-msg ' + type; S.statusMsg.style.display = 'block';
}

function calculateGrid(n, cw, ch, mx, my_t, my_b, cg, rg) {
  n = Math.min(n, 40);
  if (n <= 0) return [1, 1];
  var uw = Math.max(cw - 2 * mx, 1);
  var uh = Math.max(ch - my_t - my_b, 1);
  var minCell = 120;
  var best = [1, 1, Infinity];
  for (var cols = 1; cols <= 20; cols++) {
    var rows = Math.ceil(n / cols);
    var cell_w = (uw - (cols - 1) * cg) / cols;
    var cell_h = (uh - (rows - 1) * rg) / rows;
    if (cell_w < minCell || cell_h < minCell) continue;
    var aspect = cw / ch;
    var score = Math.abs((cell_w / cell_h) - aspect) + 0.05 * (cols * rows - n);
    if (score < best[2]) best = [cols, rows, score];
  }
  return best;
}

function fmtDateStr(d) {
  if (!d || isNaN(d.getTime())) return '--';
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

export function generateContactSheet(files, params, onComplete) {
  if (!files || files.length === 0) { onComplete(null); return; }
  var firstFile = files[0].file;
  var firstImg = new Image();
  firstImg.onload = function() {
    var cw = firstImg.naturalWidth, ch = firstImg.naturalHeight;
    URL.revokeObjectURL(firstImg.src);
    if (cw <= 0 || ch <= 0) { onComplete(null); return; }

    var n = Math.min(files.length, 40);
    var mx = Math.round(cw * 0.025), my_t = Math.round(ch * 0.04), my_b = Math.round(ch * 0.1);
    var cg = Math.round(cw * 0.01), rg = Math.round(ch * 0.015);
    var grid = calculateGrid(n, cw, ch, mx, my_t, my_b, cg, rg);
    var cols = grid[0], rows = grid[1];
    var uw = cw - 2 * mx, uh = ch - my_t - my_b;
    var cell_w = (uw - (cols - 1) * cg) / cols;
    var cell_h = (uh - (rows - 1) * rg) / rows;

    var canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ebebeb';
    ctx.fillRect(0, 0, cw, ch);

    var pending = n, active = 0, next = 0, errored = false;

    function tryFinish() {
      if (pending > 0) return;
      if (errored) { onComplete(null); return; }
      var footerH = Math.max(80, Math.round(ch * 0.08));
      var footerY = ch - footerH;
      ctx.fillStyle = '#222';
      ctx.fillRect(0, footerY, cw, footerH);
      ctx.fillStyle = '#fff';
      var fSize = Math.max(13, Math.round(footerH * 0.24));
      ctx.font = 'bold ' + fSize + 'px sans-serif';
      var lp = Math.round(cw * 0.02);
      ctx.fillText('\uD83C\uDFAC ' + params.film.name + ' (ISO ' + params.film.iso + ')', lp, footerY + fSize + 4);
      var camLens = params.camera.make + ' ' + params.camera.model + ' + ' + params.lens.name;
      if (params.lens.focal) camLens += ' (' + params.lens.focal + 'mm)';
      if (params.lens.aperture) camLens += ' f/' + params.lens.aperture;
      ctx.fillText('\uD83D\uDCF7 ' + camLens, lp, footerY + fSize * 2 + 10);
      var minD = null, maxD = null;
      for (var di = 0; di < files.length; di++) {
        var fd = S.getFileDate(di);
        if (fd && fd.exifDate) {
          var ts = new Date(fd.exifDate).getTime();
          if (!isNaN(ts)) {
            if (minD === null || ts < minD) minD = ts;
            if (maxD === null || ts > maxD) maxD = ts;
          }
        }
      }
      var dr = '--';
      if (minD !== null && maxD !== null) dr = fmtDateStr(new Date(minD)) + ' ~ ' + fmtDateStr(new Date(maxD));
      ctx.fillText('\uD83E\uDD7A ' + params.lab + '  |  \uD83D\uDCC5 ' + dr, lp, footerY + fSize * 3 + 16);
      canvas.toBlob(function(blob) { onComplete(blob); }, 'image/jpeg', 0.92);
    }

    function processNext() {
      while (active < 4 && next < n) {
        var idx = next++;
        active++;
        (function(i) {
          var r = Math.floor(i / cols);
          var c = i % cols;
          var cx = mx + c * (cell_w + cg);
          var cy = my_t + r * (cell_h + rg);
          ctx.fillStyle = '#fff';
          ctx.fillRect(cx, cy, cell_w, cell_h);
          var numSize = Math.max(12, Math.round(Math.min(cell_w, cell_h) * 0.08));
          ctx.font = 'bold ' + numSize + 'px sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillText('#' + (i + 1), cx + 4, cy + numSize + 2);
          var img = new Image();
          img.onload = function() {
            var scale = Math.min(cell_w / img.width, cell_h / img.height) * 0.92;
            var pw = img.width * scale, ph = img.height * scale;
            ctx.drawImage(img, cx + (cell_w - pw) / 2, cy + (cell_h - ph) / 2, pw, ph);
            URL.revokeObjectURL(img.src);
            pending--;
            active--;
            processNext();
          };
          img.onerror = function() { pending--; active--; errored = true; processNext(); };
          img.src = URL.createObjectURL(files[i].file);
        })(idx);
      }
      if (active === 0 && pending === 0) tryFinish();
    }
    processNext();
  };
  firstImg.src = URL.createObjectURL(firstFile);
  // Revoke on error
  firstImg.onerror = function() { URL.revokeObjectURL(firstImg.src); onComplete(null); };
}

export function startContactSheet() {
  var p = S.collect();
  S.summaryPanel.classList.remove('show');
  S.progressSec.classList.add('show');
  S.statusMsg.className = 'status-msg';
  S.statusMsg.style.display = 'none';
  S.progText.textContent = t('contact_sheet_generating');
  S.progBar.style.width = '0%';

  generateContactSheet(S.uploadedFiles, p, function(blob) {
    if (!blob) {
      showStatus('Contact sheet generation failed', 'error');
      S.reviewBtn.disabled = false;
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'contact_sheet_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    S.progBar.style.width = '100%';
    S.progText.textContent = t('contact_sheet_done');
    showStatus(t('contact_sheet_done'), 'success');
    S.reviewBtn.disabled = false;
  });
}
