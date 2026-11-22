// Drop & Finds — the Drop Picker wheel, "Pick" to mark the spot, and My Finds pins.

// Where the map comes from. This is a free community service, not Epic.
const MAP_URL = 'https://fortnite-api.com/v1/map';

const statusLine = document.getElementById('status');

// ---------- Switching screens ----------
// Show one screen, hide the other, and light up the matching bottom button.
const tabs = document.querySelectorAll('.tab');

function showScreen(screenId) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.screen === screenId));
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.hidden = screen.id !== screenId;
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
});

// ---------- The wheel ----------
const wheel = document.getElementById('wheel');
const resultLine = document.getElementById('result');
const spinButton = document.getElementById('spin');
const pickButton = document.getElementById('pick');
const skipButton = document.getElementById('skip');
const resetButton = document.getElementById('reset');
const skippedNote = document.getElementById('skipped-note');

const SPIN_SECONDS = 4;      // must match the "transition" time in style.css
const SLICE_COLORS = ['--slice-1', '--slice-2', '--slice-3', '--slice-4'];

// Each spot looks like { name: 'Loguetown', x: 1846, y: 55330 }
let allSpots = [];     // every location from the live map
let spotsOnWheel = []; // the ones still on the wheel (skipped ones are taken off)
let chosenSpot = null; // the spot the wheel last landed on
let wheelTurn = 0;     // how far the wheel has turned so far, in degrees
let spinning = false;

// Turn an angle on the wheel into an x,y point. 0 degrees is straight up.
function pointOnWheel(angle, radius) {
  const radians = (angle - 90) * Math.PI / 180;
  return [250 + radius * Math.cos(radians), 250 + radius * Math.sin(radians)];
}

// Draw one pizza slice per spot, with its name written along it.
function drawWheel() {
  const count = spotsOnWheel.length;
  const sliceAngle = 360 / count;
  let drawing = '';

  spotsOnWheel.forEach((spot, i) => {
    const [x1, y1] = pointOnWheel(i * sliceAngle, 240);
    const [x2, y2] = pointOnWheel((i + 1) * sliceAngle, 240);
    // Pick a color, making sure the last slice doesn't match the first one next to it.
    let colorIndex = i % SLICE_COLORS.length;
    if (i === count - 1 && colorIndex === 0 && count > 1) colorIndex = 1;
    const color = `var(${SLICE_COLORS[colorIndex]})`;

    if (count === 1) {
      drawing += `<circle cx="250" cy="250" r="240" fill="${color}"/>`;
    } else {
      drawing += `<path d="M250 250 L${x1} ${y1} A240 240 0 0 1 ${x2} ${y2} Z"
                    fill="${color}" stroke="var(--background)" stroke-width="2"/>`;
    }
    // Write the name from the rim toward the middle.
    const middleOfSlice = (i + 0.5) * sliceAngle - 90;
    drawing += `<text x="478" y="250" text-anchor="end" dominant-baseline="central"
                  transform="rotate(${middleOfSlice} 250 250)">${escapeText(spot.name)}</text>`;
  });

  drawing += '<circle cx="250" cy="250" r="26" fill="var(--background)"/>';
  wheel.innerHTML = drawing;
}

// Names like "Nami's Tangerine Grove" have characters that need care inside a drawing.
function escapeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Spin: pick the winner first, then turn the wheel so that slice stops under the arrow.
function spin() {
  if (spinning || spotsOnWheel.length === 0) return;
  spinning = true;
  updateButtons();
  resultLine.textContent = '…';

  const count = spotsOnWheel.length;
  const sliceAngle = 360 / count;
  const winner = Math.floor(Math.random() * count);

  // Where inside the winning slice to stop (not always dead center, so it looks real).
  const wobble = (Math.random() - 0.5) * sliceAngle * 0.7;
  const stopAt = -((winner + 0.5) * sliceAngle + wobble);

  // Five full turns, plus whatever extra gets us to the stopping point.
  const extra = (((stopAt - wheelTurn) % 360) + 360) % 360;
  wheelTurn += 360 * 5 + extra;
  wheel.style.transform = `rotate(${wheelTurn}deg)`;

  setTimeout(() => {
    chosenSpot = spotsOnWheel[winner];
    resultLine.textContent = chosenSpot.name;
    spinning = false;
    updateButtons();
  }, SPIN_SECONDS * 1000 + 100);
}

// Skip: take the chosen spot off the wheel and spin again.
function skip() {
  if (spinning || !chosenSpot || spotsOnWheel.length <= 1) return;
  spotsOnWheel = spotsOnWheel.filter((spot) => spot !== chosenSpot);
  chosenSpot = null;
  drawWheel();
  spin();
}

// Put every skipped spot back on the wheel.
function resetWheel() {
  if (spinning) return;
  spotsOnWheel = [...allSpots];
  chosenSpot = null;
  resultLine.textContent = 'Tap Spin!';
  drawWheel();
  updateButtons();
}

// Turn buttons on and off so you can't tap the wrong thing mid-spin.
function updateButtons() {
  const skippedCount = allSpots.length - spotsOnWheel.length;
  const haveWinner = !spinning && chosenSpot !== null;

  spinButton.disabled = spinning || spotsOnWheel.length === 0;
  spinButton.textContent = chosenSpot ? 'Re-spin' : 'Spin';
  pickButton.disabled = !haveWinner;
  skipButton.disabled = !haveWinner || spotsOnWheel.length <= 1;

  // The bright button is the one you'll most likely want next:
  // Spin before there's a winner, Pick once there is one.
  spinButton.classList.toggle('primary', !haveWinner);
  pickButton.classList.toggle('primary', haveWinner);

  resetButton.hidden = skippedCount === 0;
  resetButton.disabled = spinning;
  skippedNote.hidden = skippedCount === 0;
  skippedNote.textContent = skippedCount === 1 ? '1 spot skipped' : skippedCount + ' spots skipped';
}

spinButton.addEventListener('click', spin);
skipButton.addEventListener('click', skip);
resetButton.addEventListener('click', resetWheel);

// ---------- Pick: mark the chosen spot on the map ----------
const dropMarker = document.getElementById('drop-marker');
const dropMarkerLabel = document.getElementById('drop-marker-label');
const dropBanner = document.getElementById('drop-banner');
const dropName = document.getElementById('drop-name');

// The service gives each spot in GAME coordinates (big numbers like 55330).
// These numbers turn them into "how far across / down the picture", from 0 to 1.
// They were measured against the map on 22 Nov 2026 (build 43.10).
// A brand-new map may need them measured again.
const MAP_SCALE = 3.225e-6;   // picture-widths per game unit
const MAP_CENTER_X = 0.4772;  // where game x = 0 sits across the picture
const MAP_CENTER_Y = 0.4968;  // where game y = 0 sits down the picture

function spotToPicture(spot) {
  return {
    across: MAP_CENTER_X + spot.x * MAP_SCALE,
    down: MAP_CENTER_Y + spot.y * MAP_SCALE,
  };
}

function pick() {
  if (spinning || !chosenSpot) return;
  const place = spotToPicture(chosenSpot);

  dropMarker.style.left = (place.across * 100) + '%';
  dropMarker.style.top = (place.down * 100) + '%';
  dropMarkerLabel.textContent = chosenSpot.name;
  dropMarker.hidden = false;

  dropName.textContent = chosenSpot.name;
  dropBanner.hidden = false;
  resetView(); // zoom back out so the marker is definitely in view

  showScreen('screen-finds');
}

function clearDrop() {
  dropMarker.hidden = true;
  dropBanner.hidden = true;
}

pickButton.addEventListener('click', pick);
document.getElementById('drop-clear').addEventListener('click', clearDrop);

// ---------- My Finds: pins ----------
// The kinds of things Max can pin. The icon shows on the pin, the color fills it.
const CATEGORIES = [
  { id: 'egg',   name: 'Easter Egg', icon: '🥚', color: '--pin-egg' },
  { id: 'vault', name: 'Vault',      icon: '🔒', color: '--pin-vault' },
  { id: 'chest', name: 'Chest',      icon: '🧰', color: '--pin-chest' },
  { id: 'npc',   name: 'NPC',        icon: '🧍', color: '--pin-npc' },
  { id: 'other', name: 'Other',      icon: '⭐', color: '--pin-other' },
];

// Pins are saved on this iPad under this name. Nothing is sent anywhere.
const PINS_KEY = 'drop-and-finds-pins';

const mapWrap = document.querySelector('.map-wrap');
const pinsLayer = document.getElementById('pins');
const findsHint = document.getElementById('finds-hint');
const backdrop = document.getElementById('backdrop');
const pinForm = document.getElementById('pin-form');
const pinView = document.getElementById('pin-view');
const categoryButtons = document.getElementById('category-buttons');
const noteInput = document.getElementById('note');
const saveButton = document.getElementById('pin-save');

// Each pin looks like:
// { id: 'p1732300000000', across: 0.48, down: 0.67, category: 'vault', note: 'behind the shop' }
// "across" and "down" are how far across/down the picture it is, from 0 to 1,
// so the pin stays in the right place whatever size the map is drawn.
let pins = readSavedPins();
let newPin = null; // the pin being made right now, before Save is tapped

function readSavedPins() {
  try {
    const saved = JSON.parse(localStorage.getItem(PINS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function savePins() {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  } catch (error) {
    showProblem('Could not save pins on this iPad. Storage may be full or turned off.', error);
  }
}

function categoryFor(id) {
  return CATEGORIES.find((category) => category.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// Draw every saved pin on the map (plus the see-through one being made, if any).
function drawPins() {
  pinsLayer.innerHTML = '';

  pins.forEach((pin) => {
    const category = categoryFor(pin.category);
    const button = document.createElement('button');
    button.className = 'pin';
    button.textContent = category.icon;
    button.style.background = `var(${category.color})`;
    button.style.left = (pin.across * 100) + '%';
    button.style.top = (pin.down * 100) + '%';
    button.setAttribute('aria-label', category.name + (pin.note ? ': ' + pin.note : ''));
    button.addEventListener('click', (event) => {
      if (fingerMoved) return; // you were sliding the map, not tapping the pin
      openPinView(pin);
    });
    pinsLayer.appendChild(button);
  });

  if (newPin) {
    const ghost = document.createElement('div');
    ghost.className = 'pin new';
    ghost.style.left = (newPin.across * 100) + '%';
    ghost.style.top = (newPin.down * 100) + '%';
    pinsLayer.appendChild(ghost);
  }

  findsHint.textContent = pins.length === 0
    ? 'Tap the map to drop a pin.'
    : (pins.length === 1 ? '1 pin' : pins.length + ' pins') + ' · Tap the map to add another.';
}

// ---------- Zooming and sliding the map ----------
// zoom 1 = the whole map fits. zoom 3 = three times bigger.
// panX / panY = how far the map has slid, measured in "window widths" (always 0 or less).
const mapLayer = document.getElementById('map-layer');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const MAX_ZOOM = 6;
let zoom = 1;
let panX = 0;
let panY = 0;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// Make the screen match zoom/panX/panY, never letting the map slide off its window.
function applyView() {
  zoom = clamp(zoom, 1, MAX_ZOOM);
  panX = clamp(panX, 1 - zoom, 0);
  panY = clamp(panY, 1 - zoom, 0);
  mapLayer.style.width = (zoom * 100) + '%';
  mapLayer.style.height = (zoom * 100) + '%';
  mapLayer.style.left = (panX * 100) + '%';
  mapLayer.style.top = (panY * 100) + '%';
  zoomInButton.disabled = zoom >= MAX_ZOOM;
  zoomOutButton.disabled = zoom <= 1;
}

// Zoom to a new level while keeping the point under your fingers in place.
function zoomAt(windowX, windowY, newZoom) {
  newZoom = clamp(newZoom, 1, MAX_ZOOM);
  const mapX = (windowX - panX) / zoom; // which bit of the map is under that point
  const mapY = (windowY - panY) / zoom;
  zoom = newZoom;
  panX = windowX - mapX * zoom;
  panY = windowY - mapY * zoom;
  applyView();
}

function resetView() {
  zoom = 1;
  panX = 0;
  panY = 0;
  applyView();
}

// Where a finger is inside the map window, from 0 to 1 across and down.
function windowPoint(event) {
  const box = mapWrap.getBoundingClientRect();
  return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
}

// Finger tracking. One finger slides the map (or taps). Two fingers pinch to zoom.
const fingers = new Map(); // finger id -> where it is now
let gesture = null;        // what things looked like when the current move began
let fingerMoved = false;   // true once a touch turns into a slide or pinch (so it's not a tap)

function beginGesture() {
  const points = [...fingers.values()];
  if (points.length === 1) {
    gesture = { startX: points[0].x, startY: points[0].y, panX, panY };
  } else if (points.length >= 2) {
    const [a, b] = points;
    const middleX = (a.x + b.x) / 2;
    const middleY = (a.y + b.y) / 2;
    gesture = {
      spread: Math.hypot(a.x - b.x, a.y - b.y),
      zoom,
      mapX: (middleX - panX) / zoom, // the bit of map between the two fingers
      mapY: (middleY - panY) / zoom,
    };
  } else {
    gesture = null;
  }
}

mapWrap.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.zoom-buttons')) return;
  if (fingers.size === 0) fingerMoved = false;
  fingers.set(event.pointerId, windowPoint(event));
  beginGesture();
});

window.addEventListener('pointermove', (event) => {
  if (!fingers.has(event.pointerId)) return;
  fingers.set(event.pointerId, windowPoint(event));
  const points = [...fingers.values()];

  if (points.length === 1) {
    const movedX = points[0].x - gesture.startX;
    const movedY = points[0].y - gesture.startY;
    // A tiny wobble still counts as a tap. More than that is a slide.
    const wobble = 8 / mapWrap.getBoundingClientRect().width;
    if (Math.hypot(movedX, movedY) > wobble) fingerMoved = true;
    if (fingerMoved) {
      panX = gesture.panX + movedX;
      panY = gesture.panY + movedY;
      applyView();
    }
  } else if (points.length >= 2) {
    fingerMoved = true;
    const [a, b] = points;
    const spread = Math.hypot(a.x - b.x, a.y - b.y);
    zoom = clamp(gesture.zoom * spread / gesture.spread, 1, MAX_ZOOM);
    panX = (a.x + b.x) / 2 - gesture.mapX * zoom;
    panY = (a.y + b.y) / 2 - gesture.mapY * zoom;
    applyView();
  }
});

function fingerLifted(event, wasCancelled) {
  if (!fingers.has(event.pointerId)) return;
  const point = fingers.get(event.pointerId);
  fingers.delete(event.pointerId);

  // A clean tap on the map (not a slide, not on a pin): drop a new pin there.
  const tappedMap = fingers.size === 0 && !fingerMoved && !wasCancelled
    && !event.target.closest('.pin');
  if (tappedMap) {
    newPin = {
      across: (point.x - panX) / zoom,
      down: (point.y - panY) / zoom,
      category: null,
    };
    drawPins();
    openPinForm();
  }
  beginGesture();
}

window.addEventListener('pointerup', (event) => fingerLifted(event, false));
window.addEventListener('pointercancel', (event) => fingerLifted(event, true));

// The + and − buttons zoom around the middle of the window.
zoomInButton.addEventListener('click', () => zoomAt(0.5, 0.5, zoom * 1.6));
zoomOutButton.addEventListener('click', () => zoomAt(0.5, 0.5, zoom / 1.6));

// On a computer, the mouse wheel zooms too (handy for testing on the Mac).
mapWrap.addEventListener('wheel', (event) => {
  event.preventDefault();
  const point = windowPoint(event);
  zoomAt(point.x, point.y, zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
}, { passive: false });

// Safari has its own pinch-the-whole-page zoom. Turn it off so only the map zooms
// and pop-up cards always stay where you can see them.
document.addEventListener('gesturestart', (event) => event.preventDefault());

applyView();

// Build the five category buttons once.
CATEGORIES.forEach((category) => {
  const button = document.createElement('button');
  button.className = 'category-button';
  button.dataset.category = category.id;
  button.innerHTML = `<span class="icon">${category.icon}</span>${category.name}`;
  button.addEventListener('click', () => {
    newPin.category = category.id;
    categoryButtons.querySelectorAll('.category-button').forEach((other) => {
      other.classList.toggle('selected', other === button);
    });
    saveButton.disabled = false;
  });
  categoryButtons.appendChild(button);
});

function openPinForm() {
  noteInput.value = '';
  saveButton.disabled = true;
  categoryButtons.querySelectorAll('.category-button').forEach((b) => b.classList.remove('selected'));
  pinView.hidden = true;
  pinForm.hidden = false;
  backdrop.hidden = false;
}

function openPinView(pin) {
  const category = categoryFor(pin.category);
  document.getElementById('view-title').textContent = category.icon + ' ' + category.name;
  const noteLine = document.getElementById('view-note');
  noteLine.textContent = pin.note || 'No note';
  noteLine.classList.toggle('empty', !pin.note);
  pinForm.hidden = true;
  pinView.hidden = false;
  backdrop.hidden = false;
}

function closeCards() {
  backdrop.hidden = true;
  pinForm.hidden = true;
  pinView.hidden = true;
  noteInput.blur(); // puts the keyboard away
  newPin = null;
  drawPins();
}

function saveNewPin() {
  if (!newPin || !newPin.category) return;
  pins.push({
    id: 'p' + Date.now(),
    across: newPin.across,
    down: newPin.down,
    category: newPin.category,
    note: noteInput.value.trim(),
  });
  savePins();
  closeCards();
}

saveButton.addEventListener('click', saveNewPin);
document.getElementById('pin-cancel').addEventListener('click', closeCards);
document.getElementById('view-close').addEventListener('click', closeCards);
// Tapping the dark area outside a card closes it too.
backdrop.addEventListener('click', (event) => {
  if (event.target === backdrop) closeCards();
});

drawPins();

// ---------- Loading the map ----------
// Three different things can go wrong, and each gets its own honest message:
//   1. We can't reach the service at all (no internet).
//   2. The service answers, but with a problem or with data we don't understand.
//   3. Our own code breaks while using the data (a bug).
async function loadMap() {
  // 1. Try to reach the service.
  let response;
  try {
    response = await fetch(MAP_URL);
  } catch (error) {
    showProblem('Can\'t reach the map service. Check the internet and reopen.', error);
    return;
  }

  // 2. Check the answer is good and has the parts we need.
  if (!response.ok) {
    showProblem('The map service is having trouble (code ' + response.status + '). Try again later.');
    return;
  }
  let map;
  try {
    map = (await response.json()).data;
  } catch (error) {
    map = null;
  }
  if (!map || !Array.isArray(map.pois) || !map.images || !map.images.blank) {
    showProblem('The map service sent something unexpected. Try again later.');
    return;
  }

  // 3. Use the data. If this part fails, it's a bug in the app, not the internet.
  try {
    // Every location goes on the wheel. We keep its name and where it is.
    allSpots = map.pois.map((spot) => ({
      name: spot.name,
      x: spot.location.x,
      y: spot.location.y,
    }));
    resetWheel();

    // images.blank = the map picture with no names printed on it
    document.getElementById('map-blank').src = map.images.blank;

    statusLine.textContent = allSpots.length + ' locations on today\'s map';
    statusLine.classList.remove('problem');
  } catch (error) {
    showAppBug(error);
  }
}

// Show a problem in the top corner (and keep the details for Dad in the console).
function showProblem(message, error) {
  statusLine.textContent = message;
  statusLine.classList.add('problem');
  if (error) console.error(error);
}

// A bug in our own code. Show what broke so we can tell Claude exactly what to fix.
function showAppBug(error) {
  const detail = error && error.message ? error.message : String(error);
  showProblem('Something broke inside the app: ' + detail, error);
}

// Catch bugs anywhere else in the app too, so they never hide.
window.addEventListener('error', (event) => showAppBug(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showAppBug(event.reason));

loadMap();

// ---------- Self-updating and offline ----------
// Start the helper in sw.js. It fetches the newest app when online and keeps
// a saved copy for when there's no internet.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.error(error));
}
