/* ═══════════════════════════════════════════════════════════════
   Liebes Tagebuch 💕 — script.js
   Handles:
     · Step flow (entry → location picker → confirmation)
     · Karrierecenter data + dropdown population
     · Geolocation + Haversine auto-selection
     · mailto: email construction and launch
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── Karrierecenter data ─────────────────────────────────────────
// Replace placeholder emails with real addresses before going live.
const KARRIERECENTER = [
  { name: 'Berlin',      email: 'bewerbungenberlin@bundeswehr.org',      lat: 52.5200, lng: 13.4050 },
  { name: 'Düsseldorf',  email: 'bewerbungenduesseldorf@bundeswehr.org', lat: 51.2254, lng:  6.7763 },
  { name: 'Erfurt',      email: 'KarrCBwErfurtEingang@bundeswehr.org', lat: 50.9778, lng:  11.0287 },
  { name: 'Hannover',    email: 'KarrCBwHannoverBewerberservice@bundeswehr.org', lat: 52.3759, lng:  9.7320 },
  { name: 'München',     email: 'bewerbungsservicemuenchen@bundeswehr.org',    lat: 48.1351, lng: 11.5820 },
  { name: 'Stuttgart',   email: 'KarrCBwStuttgartEingang@bundeswehr.org',   lat: 48.7758, lng:  9.1829 },
  { name: 'Wilhelmhaven',email: ' KarrCBwWilhelmshavenBewMgmt@Bundeswehr.org',     lat: 53.5279, lng: 8.106 },
];

// ─── DOM references ──────────────────────────────────────────────
const stepEntry    = document.getElementById('step-entry');
const stepLocation = document.getElementById('step-location');
const stepDone     = document.getElementById('step-done');

const diaryText    = document.getElementById('diary-text');
const charCount    = document.getElementById('char-count');
const diaryDateEl  = document.getElementById('diary-date');

const btnNext      = document.getElementById('btn-next');
const btnBack      = document.getElementById('btn-back');
const btnSend      = document.getElementById('btn-send');
const btnGeo       = document.getElementById('btn-geo');
const btnRestart   = document.getElementById('btn-restart');

const centerSelect  = document.getElementById('center-select');
const selectedInfo  = document.getElementById('selected-info');
const selectedEmail = document.getElementById('selected-email');
const geoStatus     = document.getElementById('geo-status');

// ─── Init ────────────────────────────────────────────────────────
(function init() {
  setTodaysDate();
  populateDropdown();
  attachEvents();
})();

/** Write today's date in German format into the diary header. */
function setTodaysDate() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  diaryDateEl.textContent = now.toLocaleDateString('de-DE', opts);
}

/** Fill the <select> from the KARRIERECENTER array. */
function populateDropdown() {
  KARRIERECENTER.forEach((center, index) => {
    const opt = document.createElement('option');
    opt.value = String(index);
    opt.textContent = `Karrierecenter ${center.name}`;
    centerSelect.appendChild(opt);
  });
}

// ─── Event listeners ─────────────────────────────────────────────
function attachEvents() {

  // Live character counter
  diaryText.addEventListener('input', () => {
    charCount.textContent = diaryText.value.length;
  });

  // Step 1 → 2
  btnNext.addEventListener('click', () => {
    const text = diaryText.value.trim();
    if (!text) {
      shakeElement(diaryText);
      diaryText.placeholder = '✏️ Bitte erst etwas schreiben!';
      diaryText.focus();
      return;
    }
    showStep(stepLocation);
  });

  // Step 2 → 1 (back)
  btnBack.addEventListener('click', () => {
    showStep(stepEntry);
  });

  // Dropdown change → update info box
  centerSelect.addEventListener('change', () => {
    updateSelectedInfo();
  });

  // Geolocation button
  btnGeo.addEventListener('click', handleGeoRequest);

  // Send button → mailto
  btnSend.addEventListener('click', handleSend);

  // Restart
  btnRestart.addEventListener('click', () => {
    diaryText.value = '';
    charCount.textContent = '0';
    centerSelect.value = '';
    geoStatus.textContent = '';
    selectedInfo.classList.add('hidden');
    btnSend.disabled = true;
    showStep(stepEntry);
  });
}

// ─── Step navigation ─────────────────────────────────────────────
/**
 * Hide all steps and show the target one.
 * @param {HTMLElement} target
 */
function showStep(target) {
  [stepEntry, stepLocation, stepDone].forEach(s => s.classList.add('hidden'));
  target.classList.remove('hidden');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Location picker helpers ─────────────────────────────────────
/** Update the info box below the dropdown. */
function updateSelectedInfo() {
  const idx = centerSelect.value;
  if (idx === '' || idx === null) {
    selectedInfo.classList.add('hidden');
    btnSend.disabled = true;
    return;
  }
  const center = KARRIERECENTER[Number(idx)];
  selectedEmail.textContent = center.email;
  selectedInfo.classList.remove('hidden');
  btnSend.disabled = false;
}

/** Handle the "find nearest" geolocation request. */
function handleGeoRequest() {
  if (!navigator.geolocation) {
    geoStatus.textContent = '❌ Dein Browser unterstützt keine Standortermittlung.';
    return;
  }

  geoStatus.textContent = '🔍 Standort wird ermittelt…';
  btnGeo.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const nearestIdx = findNearest(userLat, userLng);
      centerSelect.value = String(nearestIdx);
      updateSelectedInfo();
      geoStatus.textContent = `✅ Nächstes Karrierecenter gefunden: ${KARRIERECENTER[nearestIdx].name}`;
      btnGeo.disabled = false;
    },
    (err) => {
      const messages = {
        1: '❌ Standortzugriff wurde verweigert.',
        2: '❌ Standort konnte nicht ermittelt werden.',
        3: '❌ Zeitüberschreitung bei der Standortermittlung.',
      };
      geoStatus.textContent = messages[err.code] || '❌ Unbekannter Fehler.';
      btnGeo.disabled = false;
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

/**
 * Haversine formula — returns the index of the nearest center.
 * @param {number} lat   User latitude in degrees
 * @param {number} lng   User longitude in degrees
 * @returns {number}     Index into KARRIERECENTER array
 */
function findNearest(lat, lng) {
  let minDist = Infinity;
  let minIdx  = 0;

  KARRIERECENTER.forEach((center, idx) => {
    const d = haversineKm(lat, lng, center.lat, center.lng);
    if (d < minDist) {
      minDist = d;
      minIdx  = idx;
    }
  });

  return minIdx;
}

/**
 * Haversine distance between two lat/lng pairs (result in km).
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R   = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// ─── Email sending ───────────────────────────────────────────────
function handleSend() {
  const idx = centerSelect.value;
  if (idx === '') return;

  const center = KARRIERECENTER[Number(idx)];
  const text   = diaryText.value.trim();

  const subject = encodeURIComponent('Mein Tagebucheintrag für die Bundeswehr 💕');
  const prefix  = encodeURIComponent('Liebe Bundeswehr,\n\n');
  const body    = encodeURIComponent(text);
  const mailto  = `mailto:${center.email}?subject=${subject}&body=${prefix}${body}`;

  // mailto URIs have a practical length limit in some clients (~2000 chars).
  // We warn but still proceed.
  if (mailto.length > 2000) {
    geoStatus.textContent = '⚠️ Der Eintrag ist sehr lang – manche E-Mail-Programme kürzen ihn ab.';
  }

  window.location.href = mailto;

  // Show the confirmation step after a short delay so the mailto has time to trigger.
  setTimeout(() => showStep(stepDone), 600);
}

// ─── Utilities ───────────────────────────────────────────────────
/** Brief CSS shake animation for validation feedback. */
function shakeElement(el) {
  el.classList.remove('shake');
  // Re-trigger animation
  void el.offsetWidth;
  el.classList.add('shake');

  // Add keyframe dynamically once
  if (!document.getElementById('shake-style')) {
    const style = document.createElement('style');
    style.id = 'shake-style';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%       { transform: translateX(-6px); }
        40%       { transform: translateX(6px); }
        60%       { transform: translateX(-4px); }
        80%       { transform: translateX(4px); }
      }
      .shake { animation: shake 0.4s ease; }
    `;
    document.head.appendChild(style);
  }
}
