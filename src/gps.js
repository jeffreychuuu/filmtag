import { esc } from './utils.js';

var refs;

export function initGps(r) {
  refs = r;
}

// Update GPS indicator dots in file list with reverse-geocoded addresses
export function updateGpsDots() {
  var items = document.querySelectorAll('.file-item');
  for (var j = 0; j < items.length; j++) {
    var i = parseInt(items[j].getAttribute('data-idx'), 10);
    var dot = items[j].querySelector('.file-gps-dot');
    var hasDotGps = refs.gpsData[i];
    if (dot) dot.innerHTML = hasDotGps ? '📍' + (refs.gpsData[i].addr ? ' <span class="gps-addr">' + esc(refs.gpsData[i].addr) + '</span>' : '') : '<img src="no_gps.png" class="no-gps-icon">';
  }
}

// Enable/disable GPS Save button based on whether map marker is placed
export function updateGpsSaveBtn() {
  refs.gpsSaveBtn.disabled = !refs.mapMarker;
}

// Set GPS coordinates on all currently selected files
export function setGpsForSelected(lat, lng) {
  var keys = Object.keys(refs.selectedSet);
  if (!keys.length) return;
  for (var k = 0; k < keys.length; k++) {
    refs.gpsData[keys[k]] = { lat: lat, lng: lng, addr: '' };
  }
  updateGpsDots();
  reverseGeocode(lat, lng, keys);
  refs.mapInfoEl.textContent = keys.length + ' photo(s) location set';
}

// Queue a reverse geocode request for lat/lng, deduplicated and cached
function reverseGeocode(lat, lng, indices) {
  var key = lat.toFixed(5) + ',' + lng.toFixed(5);
  if (refs.geocodeCache[key]) {
    var addr = refs.geocodeCache[key];
    for (var k = 0; k < indices.length; k++) {
      if (refs.gpsData[indices[k]]) refs.gpsData[indices[k]].addr = addr;
    }
    updateGpsDots();
    return;
  }
  for (var q = 0; q < refs.geocodeQueue.length; q++) {
    if (refs.geocodeQueue[q].key === key) {
      for (var k2 = 0; k2 < indices.length; k2++) {
        if (refs.geocodeQueue[q].indices.indexOf(indices[k2]) === -1) {
          refs.geocodeQueue[q].indices.push(indices[k2]);
        }
      }
      return;
    }
  }
  refs.geocodeQueue.push({ key: key, lat: lat, lng: lng, indices: indices.slice() });
  processGeocodeQueue();
}

// Process reverse geocode queue with 1 req/s rate limit
function processGeocodeQueue() {
  if (refs.geocodeBusy || !refs.geocodeQueue.length) return;
  refs.geocodeBusy = true;
  var item = refs.geocodeQueue.shift();
  fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + item.lat + '&lon=' + item.lng)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var addr = '';
      if (data.address) {
        var p = [];
        if (data.address.road) p.push(data.address.road);
        if (data.address.suburb) p.push(data.address.suburb);
        else if (data.address.city || data.address.town) p.push(data.address.city || data.address.town);
        if (!p.length) addr = data.name || data.display_name || '';
        else addr = p.join(', ');
      }
      refs.geocodeCache[item.key] = addr;
      for (var k = 0; k < item.indices.length; k++) {
        if (refs.gpsData[item.indices[k]]) refs.gpsData[item.indices[k]].addr = addr;
      }
      updateGpsDots();
      refs.geocodeBusy = false;
      setTimeout(processGeocodeQueue, 1000);
    })
    .catch(function() {
      refs.geocodeBusy = false;
      setTimeout(processGeocodeQueue, 1000);
    });
}

// Initialise Leaflet map in the GPS overlay with click-to-set-marker behaviour
export function initMap() {
  if (!refs.gpsOverlay || !refs.gpsOverlay.classList.contains('show')) return;
  if (refs.mapInitialized) { refs.map.invalidateSize(); return; }
  refs.mapInitialized = true;
  var defPos = [22.3193, 114.1694];
  refs.map = L.map('map').setView(defPos, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(refs.map);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      refs.map.setView([pos.coords.latitude, pos.coords.longitude], 13);
    }, function() {});
  }
  refs.map.on('click', function(e) {
    var lat = e.latlng.lat, lng = e.latlng.lng;
    if (refs.mapMarker) refs.mapMarker.setLatLng([lat, lng]);
    else refs.mapMarker = L.marker([lat, lng]).addTo(refs.map);
    setGpsForSelected(lat, lng); updateGpsSaveBtn();
  });
}
