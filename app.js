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
  if (screenId === 'screen-news') loadNewsScreen(); // freshen the news when you open it
  if (screenId === 'screen-shop') loadShop();        // and the shop
  else stopCardVideo();                              // leaving the shop stops any video
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
const MEASURED_SEASON = '43';  // the season those three numbers were measured on

function spotToPicture(spot) {
  return {
    across: MAP_CENTER_X + spot.x * MAP_SCALE,
    down: MAP_CENTER_Y + spot.y * MAP_SCALE,
  };
}

function pick() {
  if (spinning || !chosenSpot) return;
  if (viewSeason !== data.currentSeason) showSeason(data.currentSeason); // the drop is on today's map
  const place = spotToPicture(chosenSpot);

  dropMarker.style.left = (place.across * 100) + '%';
  dropMarker.style.top = (place.down * 100) + '%';
  dropMarkerLabel.textContent = chosenSpot.name;
  dropMarker.hidden = false;

  dropName.textContent = chosenSpot.name;
  // On a brand-new map the three numbers above haven't been re-measured yet, so say so.
  document.getElementById('drop-caution').hidden = data.currentSeason === MEASURED_SEASON;
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

const mapWrap = document.querySelector('.map-wrap');
const mapPicture = document.getElementById('map-blank');
const pinsLayer = document.getElementById('pins');
const findsHint = document.getElementById('finds-hint');
const backdrop = document.getElementById('backdrop');
const pinForm = document.getElementById('pin-form');
const categoryButtons = document.getElementById('category-buttons');
const noteInput = document.getElementById('note');
const saveButton = document.getElementById('pin-save');

// ---------- What's saved on the iPad ----------
// Everything is kept on this iPad under this name. Nothing is sent anywhere.
const DATA_KEY = 'drop-and-finds-data';
const OLD_PINS_KEY = 'drop-and-finds-pins'; // where pins lived before seasons existed

// The saved data looks like this:
// {
//   currentSeason: '43',
//   seasons: {
//     '43': { build: '43.10', pins: [ ...pins... ], spots: [ ...wheel spots... ] },
//     '42': { build: '42.30', pins: [ ... ], spots: [ ... ] },
//   }
// }
// A season is named by the game's big version number. Until we've learned that
// number, the season is called 'unknown'.
//
// Each pin looks like:
// { id: 'p1732300000000', across: 0.48, down: 0.67, category: 'vault',
//   status: 'confirmed', note: 'behind the shop' }
// "across" and "down" are how far across/down the picture it is, from 0 to 1,
// so the pin stays in the right place whatever size the map is drawn.
let data = readSavedData();
if (!Array.isArray(data.wishlist)) data.wishlist = []; // shop items Max has starred
let viewSeason = data.currentSeason;        // the season on screen right now
let pins = data.seasons[viewSeason].pins;   // that season's pins
let newPin = null;      // where a brand-new pin will go, before Save is tapped
let editingPin = null;  // the saved pin being changed, if the card is in "edit" mode
let formCategory = null;       // what's picked on the card right now
let formStatus = 'confirmed';  // 'confirmed' or 'rumor'
let filter = 'all';     // which pins to show: 'all' or one category id

function emptySeason() {
  return { build: null, pins: [], spots: [] };
}

function readSavedData() {
  try {
    const saved = JSON.parse(localStorage.getItem(DATA_KEY));
    if (saved && saved.seasons && saved.seasons[saved.currentSeason]) return saved;
  } catch (error) {
    // fall through and start fresh
  }

  // Nothing saved in the new shape yet. Bring along any pins from before seasons existed.
  const fresh = { currentSeason: 'unknown', seasons: { unknown: emptySeason() } };
  try {
    const oldPins = JSON.parse(localStorage.getItem(OLD_PINS_KEY));
    if (Array.isArray(oldPins)) fresh.seasons.unknown.pins = oldPins;
  } catch (error) {
    // no old pins to bring along
  }
  return fresh;
}

function saveData() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (error) {
    showProblem('Could not save on this iPad. Storage may be full or turned off.', error);
  }
}

function savePins() {
  data.seasons[viewSeason].pins = pins;
  saveData();
}

function seasonName(key) {
  return key === 'unknown' ? 'This season' : 'Season v' + key;
}

function categoryFor(id) {
  return CATEGORIES.find((category) => category.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// Draw the pins on the map (only the kind the filter allows),
// plus the see-through one being made, if any.
function drawPins() {
  pinsLayer.innerHTML = '';
  const shown = pins.filter((pin) => filter === 'all' || pin.category === filter);

  shown.forEach((pin) => {
    const category = categoryFor(pin.category);
    const button = document.createElement('button');
    button.className = pin.status === 'rumor' ? 'pin rumor' : 'pin';
    button.textContent = category.icon;
    button.style.background = `var(${category.color})`;
    button.style.left = (pin.across * 100) + '%';
    button.style.top = (pin.down * 100) + '%';
    button.setAttribute('aria-label', category.name + (pin.note ? ': ' + pin.note : ''));
    button.addEventListener('click', () => {
      if (fingerMoved) return; // you were sliding the map, not tapping the pin
      openPinForm(pin);
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

  const count = (n) => (n === 1 ? '1 pin' : n + ' pins');
  if (viewSeason !== data.currentSeason) {
    findsHint.textContent = count(shown.length) + ' from ' + seasonName(viewSeason) + '. Old seasons are look-only.';
  } else if (pins.length === 0) {
    findsHint.textContent = 'Tap the map to drop a pin.';
  } else if (filter === 'all') {
    findsHint.textContent = count(pins.length) + ' · Tap the map to add one, or a pin to change it.';
  } else {
    findsHint.textContent = 'Showing ' + shown.length + ' of ' + count(pins.length) + '.';
  }

  drawFilterBar();
}

// The row of filter buttons: "All" plus one per category, each with its pin count.
const filterBar = document.getElementById('filter-bar');

function drawFilterBar() {
  filterBar.innerHTML = '';
  const choices = [{ id: 'all', label: 'All', count: pins.length }];
  CATEGORIES.forEach((category) => {
    choices.push({
      id: category.id,
      label: category.icon + ' ' + category.name,
      count: pins.filter((pin) => pin.category === category.id).length,
    });
  });

  choices.forEach((choice) => {
    const chip = document.createElement('button');
    chip.className = choice.id === filter ? 'chip selected' : 'chip';
    chip.textContent = choice.label + ' ' + choice.count;
    chip.addEventListener('click', () => {
      filter = choice.id;
      drawPins();
    });
    filterBar.appendChild(chip);
  });
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
    && !event.target.closest('.pin')
    && viewSeason === data.currentSeason; // old seasons are look-only
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

// ---------- The pin card (new pin or edit pin) ----------
const formTitle = document.getElementById('form-title');
const deleteButton = document.getElementById('pin-delete');
const statusButtons = document.querySelectorAll('.status-button');
let deleteArmed = false; // Delete needs two taps, so one slip can't erase a pin

// Build the five category buttons once.
CATEGORIES.forEach((category) => {
  const button = document.createElement('button');
  button.className = 'category-button';
  button.dataset.category = category.id;
  button.innerHTML = `<span class="icon">${category.icon}</span>${category.name}`;
  button.addEventListener('click', () => {
    formCategory = category.id;
    showFormChoices();
  });
  categoryButtons.appendChild(button);
});

statusButtons.forEach((button) => {
  button.addEventListener('click', () => {
    formStatus = button.dataset.status;
    showFormChoices();
  });
});

// Light up whichever category and status are picked. Save only works once there's a category.
function showFormChoices() {
  categoryButtons.querySelectorAll('.category-button').forEach((button) => {
    button.classList.toggle('selected', button.dataset.category === formCategory);
  });
  statusButtons.forEach((button) => {
    button.classList.toggle('selected', button.dataset.status === formStatus);
  });
  saveButton.disabled = !formCategory;
}

// Open the card. Give it a saved pin to edit that pin; give it nothing to make a new one.
// On an old season the card is look-only: nothing can be changed.
function openPinForm(pin = null) {
  const lookOnly = viewSeason !== data.currentSeason;
  editingPin = pin;
  formTitle.textContent = lookOnly ? 'Old find' : (pin ? 'Edit find' : 'New find');
  formCategory = pin ? pin.category : null;
  formStatus = pin && pin.status === 'rumor' ? 'rumor' : 'confirmed';
  noteInput.value = pin ? pin.note : '';
  saveButton.textContent = pin ? 'Save' : 'Save pin';
  disarmDelete();
  showFormChoices();

  pinForm.querySelectorAll('.category-button, .status-button').forEach((button) => {
    button.disabled = lookOnly;
  });
  noteInput.disabled = lookOnly;
  saveButton.hidden = lookOnly;
  deleteButton.hidden = lookOnly || !pin;
  document.getElementById('pin-cancel').textContent = lookOnly ? 'Close' : 'Cancel';

  showCard(pinForm);
}

function closeCards() {
  backdrop.hidden = true;
  noteInput.blur(); // puts the keyboard away
  newPin = null;
  editingPin = null;
  drawPins();
}

function savePin() {
  if (!formCategory) return;
  const note = noteInput.value.trim();

  if (editingPin) {
    // Change the pin that's already saved.
    editingPin.category = formCategory;
    editingPin.status = formStatus;
    editingPin.note = note;
  } else if (newPin) {
    pins.push({
      id: 'p' + Date.now(),
      across: newPin.across,
      down: newPin.down,
      category: formCategory,
      status: formStatus,
      note,
    });
  }

  // If a filter is on and this pin isn't that kind, show everything so the pin doesn't vanish.
  if (filter !== 'all' && filter !== formCategory) filter = 'all';

  savePins();
  closeCards();
}

// First tap asks "are you sure?", second tap really deletes.
function deletePin() {
  if (!editingPin) return;
  if (!deleteArmed) {
    deleteArmed = true;
    deleteButton.textContent = 'Tap again to delete';
    return;
  }
  pins = pins.filter((pin) => pin !== editingPin);
  savePins();
  closeCards();
}

function disarmDelete() {
  deleteArmed = false;
  deleteButton.textContent = 'Delete';
}

saveButton.addEventListener('click', savePin);
// Pressing Return on the keyboard saves too.
noteInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !saveButton.hidden && !saveButton.disabled) savePin();
});
deleteButton.addEventListener('click', deletePin);
document.getElementById('pin-cancel').addEventListener('click', closeCards);
// Tapping the dark area outside the card closes it too.
backdrop.addEventListener('click', (event) => {
  if (event.target === backdrop) closeCards();
});

drawPins();

// ---------- Seasons: today's map and the archive of old ones ----------
const seasonButton = document.getElementById('season-button');
const seasonCard = document.getElementById('season-card');
const seasonList = document.getElementById('season-list');
const seasonNotice = document.getElementById('season-notice');
const archiveBanner = document.getElementById('archive-banner');

// The map service only ever serves TODAY's map picture. So each time we load it,
// we tuck a copy away under the season's name. That copy is how old maps can be
// looked at after the season is over.
const SEASON_PICTURES = 'drop-and-finds-season-maps';
let todaysPictureUrl = null;      // the big live picture's address, once loaded
let todaysSmallPictureUrl = null; // the normal-size one, used if the big one won't load
let borrowedPictureUrl = null;

function pictureName(key) {
  return new URL('season-maps/' + key + '.png', location.href).href;
}

async function keepSeasonPicture(key, bigUrl, smallUrl) {
  try {
    let picture = await fetch(bigUrl);
    if (!picture.ok) picture = await fetch(smallUrl);
    if (!picture.ok) return;
    const shelf = await caches.open(SEASON_PICTURES);
    await shelf.put(pictureName(key), picture);
  } catch (error) {
    console.error(error); // not serious: we'll try again next time the app opens
  }
}

// If the big picture won't load, quietly switch to the normal-size one.
mapPicture.addEventListener('error', () => {
  if (todaysSmallPictureUrl && mapPicture.src === todaysPictureUrl) {
    mapPicture.src = todaysSmallPictureUrl;
  }
});

async function keptSeasonPicture(key) {
  try {
    const shelf = await caches.open(SEASON_PICTURES);
    const picture = await shelf.match(pictureName(key));
    if (!picture) return null;
    if (borrowedPictureUrl) URL.revokeObjectURL(borrowedPictureUrl);
    borrowedPictureUrl = URL.createObjectURL(await picture.blob());
    return borrowedPictureUrl;
  } catch (error) {
    return null;
  }
}

// Put a season on screen: its map picture and its pins.
async function showSeason(key) {
  const isToday = key === data.currentSeason;
  viewSeason = key;
  pins = data.seasons[key].pins;
  filter = 'all';
  seasonButton.textContent = seasonName(key) + ' ▾';
  archiveBanner.hidden = isToday;
  document.getElementById('archive-name').textContent = seasonName(key);
  if (!isToday) clearDrop();
  resetView();
  drawPins();

  const picture = (isToday && todaysPictureUrl) ? todaysPictureUrl : await keptSeasonPicture(key);
  if (viewSeason !== key) return; // a different season was chosen while we waited
  if (picture) {
    mapPicture.src = picture;
  } else {
    mapPicture.removeAttribute('src');
    findsHint.textContent = 'No saved map picture for ' + seasonName(key) + ', but its pins are still here.';
  }
}

// The Seasons card: newest first, with how many pins each has.
function openSeasonCard() {
  seasonList.innerHTML = '';
  const keys = Object.keys(data.seasons).sort((a, b) => Number(b) - Number(a));
  keys.sort((a, b) => (b === data.currentSeason) - (a === data.currentSeason)); // today's first

  keys.forEach((key) => {
    const season = data.seasons[key];
    const count = season.pins.length === 1 ? '1 pin' : season.pins.length + ' pins';
    const button = document.createElement('button');
    button.className = key === viewSeason ? 'category-button selected' : 'category-button';
    const title = document.createElement('span');
    title.textContent = seasonName(key) + (key === data.currentSeason ? " (today's map)" : '');
    const small = document.createElement('span');
    small.className = 'small';
    small.textContent = count;
    button.append(title, small);
    button.addEventListener('click', () => {
      closeCards();
      showSeason(key);
    });
    seasonList.appendChild(button);
  });

  showCard(seasonCard);
}

seasonButton.addEventListener('click', openSeasonCard);
document.getElementById('season-close').addEventListener('click', closeCards);
document.getElementById('archive-back').addEventListener('click', () => showSeason(data.currentSeason));

// Work out which season we're in from the game's version, like "43.10".
// A new big number (43 -> 44) means a new season: the old season's pins stay
// saved under its name and a fresh, empty season begins.
// Returns true if a new season just started.
function updateSeason(version) {
  if (!version) return false; // couldn't learn the version: carry on with the season we had
  const before = data.currentSeason;
  let newSeasonStarted = false;

  if (before === 'unknown') {
    // First time we've learned the number: give the nameless season its real name.
    data.seasons[version.season] = data.seasons.unknown;
    delete data.seasons.unknown;
    data.currentSeason = version.season;
  } else if (Number(version.season) > Number(before)) {
    if (!data.seasons[version.season]) data.seasons[version.season] = emptySeason();
    data.currentSeason = version.season;
    newSeasonStarted = true;
    seasonNotice.textContent = 'New season! Your ' + seasonName(before)
      + ' pins are safe. Tap the Season button to see them.';
    seasonNotice.hidden = false;
  }

  data.seasons[data.currentSeason].build = version.full;
  return newSeasonStarted;
}

// ---------- Backup: Export and Import ----------
const backupCard = document.getElementById('backup-card');
const backupResult = document.getElementById('backup-result');
const importFile = document.getElementById('import-file');

// Show one pop-up card and hide the others.
function showCard(card) {
  document.querySelectorAll('#backdrop .card').forEach((other) => {
    other.hidden = other !== card;
  });
  backdrop.hidden = false;
}

function sayBackupResult(message, isProblem = false) {
  backupResult.textContent = message;
  backupResult.classList.toggle('problem', isProblem);
  backupResult.hidden = false;
}

function countAllPins() {
  return Object.values(data.seasons).reduce((total, season) => total + season.pins.length, 0);
}

// Export: turn everything saved into a file and hand it to the iPad to keep.
async function exportBackup() {
  const today = new Date().toISOString().slice(0, 10); // like 2026-11-22
  const fileName = 'drop-and-finds-backup-' + today + '.json';
  const contents = JSON.stringify({ app: 'drop-and-finds', exported: new Date().toISOString(), data }, null, 2);
  const pinCount = countAllPins();
  const summary = pinCount === 1 ? '1 pin' : pinCount + ' pins';

  // On the iPad, the Share sheet lets you pick "Save to Files".
  const file = new File([contents], fileName, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Drop & Finds backup' });
      sayBackupResult('Backup with ' + summary + ' handed to the iPad. Choose "Save to Files" to keep it.');
    } catch (error) {
      if (error.name !== 'AbortError') sayBackupResult('Could not share the backup: ' + error.message, true);
    }
    return;
  }

  // On a computer, download it like any other file.
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  sayBackupResult('Backup with ' + summary + ' downloaded as ' + fileName + '.');
}

// A pin from a file is only trusted if it has a real position and category.
// We copy just the parts we know about, so a strange file can't sneak anything in.
function cleanPin(pin) {
  if (!pin || typeof pin.across !== 'number' || typeof pin.down !== 'number') return null;
  if (!CATEGORIES.some((category) => category.id === pin.category)) return null;
  return {
    id: typeof pin.id === 'string' ? pin.id : 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
    across: clamp(pin.across, 0, 1),
    down: clamp(pin.down, 0, 1),
    category: pin.category,
    status: pin.status === 'rumor' ? 'rumor' : 'confirmed',
    note: typeof pin.note === 'string' ? pin.note.slice(0, 80) : '',
  };
}

function cleanSpots(spots) {
  if (!Array.isArray(spots)) return [];
  return spots
    .filter((spot) => spot && typeof spot.name === 'string' && typeof spot.x === 'number' && typeof spot.y === 'number')
    .map((spot) => ({ name: spot.name, x: spot.x, y: spot.y }));
}

// Import: read a backup file and ADD its pins to what's here. Nothing is ever deleted.
// A pin that's already here (same id) is skipped, so importing twice is harmless.
function importBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch (error) {
    sayBackupResult('That file isn\'t a Drop & Finds backup.', true);
    return;
  }
  const seasons = backup && backup.data && backup.data.seasons;
  if (!backup || backup.app !== 'drop-and-finds' || !seasons || typeof seasons !== 'object') {
    sayBackupResult('That file isn\'t a Drop & Finds backup.', true);
    return;
  }

  let added = 0;
  let alreadyHere = 0;

  Object.keys(seasons).forEach((key) => {
    const theirs = seasons[key];
    if (!theirs || !Array.isArray(theirs.pins)) return;

    // A backup made before the season number was known goes into today's season.
    let target = /^\d+$/.test(key) ? key : data.currentSeason;
    if (!data.seasons[target]) {
      data.seasons[target] = emptySeason();
      data.seasons[target].build = typeof theirs.build === 'string' ? theirs.build : null;
      data.seasons[target].spots = cleanSpots(theirs.spots);
    }
    const mine = data.seasons[target].pins;

    theirs.pins.forEach((pin) => {
      const clean = cleanPin(pin);
      if (!clean) return;
      if (mine.some((existing) => existing.id === clean.id)) {
        alreadyHere += 1;
      } else {
        mine.push(clean);
        added += 1;
      }
    });
  });

  // Bring back wish list stars too (again, only adding).
  const theirWishes = Array.isArray(backup.data.wishlist) ? backup.data.wishlist : [];
  theirWishes.forEach((wish) => {
    if (!wish || typeof wish.key !== 'string' || typeof wish.name !== 'string') return;
    if (data.wishlist.some((mine) => mine.key === wish.key)) return;
    data.wishlist.push({
      key: wish.key,
      name: wish.name.slice(0, 120),
      kind: typeof wish.kind === 'string' ? wish.kind : 'Other',
      image: typeof wish.image === 'string' && wish.image.startsWith('https://') ? wish.image : '',
      video: isVideoId(wish.video) ? wish.video : '',
    });
  });

  saveData();
  pins = data.seasons[viewSeason].pins;
  drawPins();

  const addedText = added === 1 ? '1 pin' : added + ' pins';
  sayBackupResult(
    'Brought back ' + addedText + '.'
    + (alreadyHere === 1 ? ' 1 was already here.' : alreadyHere ? ' ' + alreadyHere + ' were already here.' : '')
  );
}

document.getElementById('backup-button').addEventListener('click', () => {
  backupResult.hidden = true;
  showCard(backupCard);
});
document.getElementById('backup-close').addEventListener('click', closeCards);
document.getElementById('export-button').addEventListener('click', exportBackup);
document.getElementById('import-button').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = ''; // so picking the same file again still works
  if (file) importBackup(await file.text());
});

// ---------- Loading the map ----------
const VERSION_URL = 'https://fortnite-api.com/v2/aes'; // tells us the game's version number

// Ask for the game's version. Gives back { season: '43', full: '43.10' }, or null if we can't tell.
async function readGameVersion() {
  try {
    const response = await fetch(VERSION_URL);
    if (!response.ok) return null;
    const build = (await response.json()).data.build; // like "++Fortnite+Release-43.10-CL-60118918"
    const found = /Release-(\d+)\.(\d+)/.exec(build);
    return found ? { season: found[1], full: found[1] + '.' + found[2] } : null;
  } catch (error) {
    return null;
  }
}

// Three different things can go wrong, and each gets its own honest message:
//   1. We can't reach the service at all (no internet).
//   2. The service answers, but with a problem or with data we don't understand.
//   3. Our own code breaks while using the data (a bug).
// For 1 and 2, if we've loaded the map before, we carry on with the saved one.
async function loadMap() {
  // 1. Try to reach the service.
  let response;
  try {
    response = await fetch(MAP_URL);
  } catch (error) {
    useSavedMap('Can\'t reach the map service. Check the internet and reopen.', error);
    return;
  }

  // 2. Check the answer is good and has the parts we need.
  if (!response.ok) {
    useSavedMap('The map service is having trouble (code ' + response.status + '). Try again later.');
    return;
  }
  let map;
  try {
    map = (await response.json()).data;
  } catch (error) {
    map = null;
  }
  if (!map || !Array.isArray(map.pois) || !map.images || !map.images.blank) {
    useSavedMap('The map service sent something unexpected. Try again later.');
    return;
  }

  const version = await readGameVersion();

  // 3. Use the data. If this part fails, it's a bug in the app, not the internet.
  try {
    const newSeasonStarted = updateSeason(version);
    const season = data.seasons[data.currentSeason];

    // Every location goes on the wheel. We keep its name and where it is.
    allSpots = map.pois.map((spot) => ({
      name: spot.name,
      x: spot.location.x,
      y: spot.location.y,
    }));
    season.spots = allSpots; // saved so the wheel still works with no internet
    saveData();
    resetWheel();

    // images.blank = the map picture with no names printed on it (2048 dots wide).
    // The service also has a bigger one (4096 wide) at a similar address, which stays
    // sharper when you zoom in. We ask for the big one and fall back to the normal one.
    // The "?v=43.10" on the end makes the address change whenever the game updates,
    // so the iPad only downloads the picture again when there's a new one.
    const stamp = '?v=' + (season.build || new Date().toISOString().slice(0, 10));
    todaysPictureUrl = map.images.blank.replace(/map\.png$/, 'map_4096.png') + stamp;
    todaysSmallPictureUrl = map.images.blank + stamp;
    keepSeasonPicture(data.currentSeason, todaysPictureUrl, todaysSmallPictureUrl);
    showSeason(data.currentSeason);

    if (allSpots.length === 0) {
      // Right after a new season starts, the service can take a while to list the new spots.
      showProblem('The map service has no locations listed yet. The wheel will fill in when it does.');
      resultLine.textContent = 'No spots yet';
    } else {
      statusLine.textContent = (newSeasonStarted ? 'New season! ' : '')
        + (navigator.onLine ? '' : 'Offline · ')
        + allSpots.length + ' locations'
        + (season.build ? ' · Season v' + season.build : '');
      statusLine.classList.remove('problem');
    }
  } catch (error) {
    showAppBug(error);
  }
}

// No good answer from the service. If we saved this season's map earlier, use that.
function useSavedMap(problem, error) {
  const season = data.seasons[data.currentSeason];
  if (!season.spots.length) {
    showProblem(problem, error);
    return;
  }
  try {
    allSpots = season.spots;
    resetWheel();
    showSeason(data.currentSeason);
    statusLine.textContent = 'Offline · using the saved map · ' + allSpots.length + ' locations';
    statusLine.classList.remove('problem');
    if (error) console.error(error);
  } catch (bug) {
    showAppBug(bug);
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

// ---------- News screen: server status and today's news ----------
const STATUS_URL = 'https://status.epicgames.com/api/v2/summary.json'; // Epic's own status page
const NEWS_URL = 'https://fortnite-api.com/v2/news/br';                // today's in-game news

const serverDot = document.getElementById('server-dot');
const serverHeadline = document.getElementById('server-headline');
const serverDetails = document.getElementById('server-details');
const newsList = document.getElementById('news-list');
const newsNote = document.getElementById('news-note');
let newsLoadedAt = 0;

// Only ask again if it's been five minutes, so tapping the tab a lot doesn't spam the services.
function loadNewsScreen() {
  if (Date.now() - newsLoadedAt < 5 * 60 * 1000) return;
  newsLoadedAt = Date.now();
  loadServerStatus();
  loadNews();
}

function addLine(parent, text) {
  const line = document.createElement('p');
  line.textContent = text;
  parent.appendChild(line);
}

function friendlyTime(isoTime) {
  const when = new Date(isoTime);
  if (isNaN(when)) return '';
  return when.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function showServerLight(color, headline) {
  serverDot.className = 'server-dot' + (color ? ' ' + color : '');
  serverHeadline.textContent = headline;
}

// Epic's status page lists lots of games. We pick out the Fortnite parts
// (Login, Matchmaking, Item Shop...) and show the worst news among them.
async function loadServerStatus() {
  serverDetails.innerHTML = '';
  let summary;
  try {
    const response = await fetch(STATUS_URL);
    if (!response.ok) throw new Error('status ' + response.status);
    summary = await response.json();
  } catch (error) {
    showServerLight('', 'Can\'t check the servers right now.');
    newsLoadedAt = 0; // let the next tap try again
    return;
  }

  try {
    const parts = Array.isArray(summary.components) ? summary.components : [];
    const fortniteGroup = parts.find((part) => part.group && part.name === 'Fortnite');
    const fortniteParts = fortniteGroup ? parts.filter((part) => part.group_id === fortniteGroup.id) : [];
    const fortniteIds = new Set(fortniteParts.map((part) => part.id).concat(fortniteGroup ? [fortniteGroup.id] : []));
    const aboutFortnite = (item) => !Array.isArray(item.components) || item.components.length === 0
      || item.components.some((part) => fortniteIds.has(part.id));

    const troubled = fortniteParts.filter((part) => part.status !== 'operational');
    const inMaintenance = troubled.some((part) => part.status === 'under_maintenance');
    const majorOutage = troubled.some((part) => part.status === 'major_outage');

    if (!fortniteGroup) {
      showServerLight('', 'Couldn\'t find Fortnite on Epic\'s status page.');
    } else if (troubled.length === 0) {
      showServerLight('good', 'Fortnite servers are up');
    } else if (inMaintenance) {
      showServerLight('bad', 'Fortnite is down for maintenance');
    } else if (majorOutage) {
      showServerLight('bad', 'Fortnite servers are having big problems');
    } else {
      showServerLight('warn', 'Fortnite servers are having some trouble');
    }

    const statusWords = {
      degraded_performance: 'running slowly',
      partial_outage: 'partly down',
      major_outage: 'down',
      under_maintenance: 'under maintenance',
    };
    troubled.forEach((part) => addLine(serverDetails, part.name + ': ' + (statusWords[part.status] || part.status)));

    // Problems Epic is working on right now
    (summary.incidents || []).filter(aboutFortnite).forEach((incident) => {
      addLine(serverDetails, 'Epic says: ' + incident.name);
    });

    // Planned downtime (updates usually come with a few hours of this)
    (summary.scheduled_maintenances || []).filter(aboutFortnite).forEach((planned) => {
      const starts = friendlyTime(planned.scheduled_for);
      const ends = friendlyTime(planned.scheduled_until);
      addLine(serverDetails, 'Planned downtime: ' + planned.name
        + (starts ? ' · starts ' + starts : '') + (ends ? ' · ends ' + ends : ''));
    });
  } catch (error) {
    showAppBug(error);
  }
}

// Today's in-game news: one card per story.
async function loadNews() {
  let stories;
  try {
    const response = await fetch(NEWS_URL);
    if (!response.ok) throw new Error('status ' + response.status);
    stories = (await response.json()).data.motds;
    if (!Array.isArray(stories)) throw new Error('no stories');
  } catch (error) {
    if (!newsList.children.length) newsNote.textContent = 'Can\'t load the news right now.';
    newsLoadedAt = 0;
    return;
  }

  try {
    newsList.innerHTML = '';
    stories
      .filter((story) => !story.hidden)
      .sort((a, b) => (b.sortingPriority || 0) - (a.sortingPriority || 0))
      .forEach((story) => {
        const card = document.createElement('article');
        card.className = 'news-card';

        const picture = story.tileImage || story.image;
        if (picture) {
          const img = document.createElement('img');
          img.src = picture;
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('error', () => img.remove()); // no picture is better than a broken one
          card.appendChild(img);
        }
        const title = document.createElement('h3');
        title.textContent = story.title || '';
        const body = document.createElement('p');
        body.textContent = story.body || '';
        card.append(title, body);
        newsList.appendChild(card);
      });

    newsNote.textContent = newsList.children.length
      ? 'News comes from the game itself, by way of fortnite-api.com.'
      : 'No news today.';
  } catch (error) {
    showAppBug(error);
  }
}

// ---------- Shop screen: today's item shop and the wish list ----------
const SHOP_URL = 'https://fortnite-api.com/v2/shop';
const shopList = document.getElementById('shop-list');
const shopChips = document.getElementById('shop-chips');
const shopNote = document.getElementById('shop-note');
const shopSearch = document.getElementById('shop-search');
const wishBox = document.getElementById('wish-box');
const shopTab = document.querySelector('.tab[data-screen="screen-shop"]');

const SHOP_KINDS = ['All', 'Outfits', 'Pickaxes', 'Back Blings', 'Emotes', 'Gliders', 'Wraps',
  'Bundles', 'Music', 'Cars', 'Other', '★ Wish list'];
const KIND_FOR_TYPE = { Outfit: 'Outfits', Pickaxe: 'Pickaxes', 'Back Bling': 'Back Blings',
  Emote: 'Emotes', Glider: 'Gliders', Wrap: 'Wraps' };

let shopItems = [];      // today's shop, boiled down to what a card needs
let shopKind = 'All';    // which chip is picked
let shopLoadedAt = 0;

// The service describes each shop offer with LOTS of detail. This keeps just:
// a key (to recognise the same item on another day), name, kind, price, when it leaves, picture.
function simplifyOffer(offer) {
  const item = (offer.brItems || [])[0];
  const track = (offer.tracks || [])[0];
  const car = (offer.cars || [])[0];
  const shopPicture = offer.newDisplayAsset && offer.newDisplayAsset.renderImages
    && offer.newDisplayAsset.renderImages[0] && offer.newDisplayAsset.renderImages[0].image;

  let key, name, kind, image;
  if (offer.bundle) {
    key = 'bundle:' + offer.bundle.name;
    name = offer.bundle.name;
    kind = 'Bundles';
    image = offer.bundle.image || shopPicture;
  } else if (item) {
    key = item.id;
    name = item.name;
    kind = KIND_FOR_TYPE[item.type && item.type.displayValue] || 'Other';
    image = shopPicture || (item.images && (item.images.icon || item.images.smallIcon));
  } else if (track) {
    key = track.id;
    name = track.title + (track.artist ? ' · ' + track.artist : '');
    kind = 'Music';
    image = track.albumArt;
  } else if (car) {
    key = car.id;
    name = car.name;
    kind = 'Cars';
    image = shopPicture || (car.images && (car.images.large || car.images.small));
  } else {
    return null; // nothing we know how to show
  }

  // Many items come with a short showcase video on YouTube (just its 11-letter id).
  const withVideo = (item && item.showcaseVideo) ? item : (offer.brItems || []).find((one) => one.showcaseVideo);

  return {
    key,
    name: name || 'Mystery item',
    kind,
    image: image || '',
    video: withVideo && isVideoId(withVideo.showcaseVideo) ? withVideo.showcaseVideo : '',
    section: (offer.layout && offer.layout.name || '').trim(),
    price: offer.finalPrice,
    was: offer.regularPrice > offer.finalPrice ? offer.regularPrice : null,
    leaves: offer.outDate,
  };
}

// A real YouTube id is exactly 11 letters, numbers, dashes or underscores.
// Checking this means nothing odd can ever be put into the video player's address.
function isVideoId(id) {
  return typeof id === 'string' && /^[\w-]{11}$/.test(id);
}

function isWished(key) {
  return data.wishlist.some((wish) => wish.key === key);
}

function toggleWish(item) {
  if (isWished(item.key)) {
    data.wishlist = data.wishlist.filter((wish) => wish.key !== item.key);
  } else {
    // Keep the name and picture so the wish still shows on days it's not in the shop.
    data.wishlist.push({ key: item.key, name: item.name, kind: item.kind, image: item.image, video: item.video || '' });
  }
  saveData();
  drawShop();
}

// "Leaves today", "Leaves tomorrow", or "Leaves Thu, Nov 26"
function leavesText(isoTime) {
  const when = new Date(isoTime);
  if (isNaN(when)) return '';
  const days = Math.floor((when - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return '';
  if (days === 0) return 'Leaves today';
  if (days === 1) return 'Leaves tomorrow';
  return 'Leaves ' + when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function makeShopCard(item, inShopToday) {
  const card = document.createElement('article');
  card.className = inShopToday ? 'shop-card' : 'shop-card gone';

  // The picture sits in a square box. A playing video goes on top of it in the same box.
  const media = document.createElement('div');
  media.className = 'card-media';
  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    media.appendChild(img);
  }
  card.appendChild(media);

  const name = document.createElement('p');
  name.className = 'name';
  name.textContent = item.name;
  const kind = document.createElement('p');
  kind.className = 'kind';
  kind.textContent = item.kind + (item.section ? ' · ' + item.section : '');
  card.append(name, kind);

  if (inShopToday) {
    const leaves = document.createElement('p');
    leaves.className = 'leaves';
    leaves.textContent = leavesText(item.leaves);
    const price = document.createElement('p');
    price.className = 'price';
    if (item.was) {
      const old = document.createElement('s');
      old.textContent = item.was.toLocaleString();
      price.append(old, ' ');
    }
    price.append(item.price.toLocaleString() + ' V-Bucks');
    card.append(leaves, price);
  } else {
    const gone = document.createElement('p');
    gone.className = 'price';
    gone.textContent = 'Not in the shop today';
    card.appendChild(gone);
  }

  if (isVideoId(item.video)) {
    const watch = document.createElement('button');
    watch.className = 'watch-button';
    watch.textContent = '▶ Watch';
    watch.addEventListener('click', () => toggleCardVideo(item, media, watch));
    card.appendChild(watch);
  }

  const star = document.createElement('button');
  star.className = isWished(item.key) ? 'star on' : 'star';
  star.textContent = '★';
  star.setAttribute('aria-label', isWished(item.key) ? 'Remove from wish list' : 'Add to wish list');
  star.addEventListener('click', () => toggleWish(item));
  card.appendChild(star);
  return card;
}

// ---------- Playing a showcase video right on a card ----------
// Tapping Watch makes the card wider and swaps its picture for the moving clip: silent, looping,
// with YouTube's buttons hidden and nothing inside it tappable. One card plays at a time.
// "youtube-nocookie" is YouTube's privacy mode.
let playingCard = null; // { media, button } for the card that's playing, if any

function stopCardVideo() {
  if (!playingCard) return;
  const player = playingCard.media.querySelector('iframe');
  if (player) player.remove();
  playingCard.media.parentElement.classList.remove('playing');
  playingCard.button.textContent = '▶ Watch';
  playingCard = null;
}

function toggleCardVideo(item, media, button) {
  const wasThisCard = playingCard && playingCard.media === media;
  stopCardVideo();
  if (wasThisCard || !isVideoId(item.video)) return; // tapping Stop just stops

  const player = document.createElement('iframe');
  player.src = 'https://www.youtube-nocookie.com/embed/' + item.video
    + '?autoplay=1&mute=1&loop=1&playlist=' + item.video   // silent, and starts over when it ends
    + '&controls=0&disablekb=1&fs=0&rel=0&playsinline=1&iv_load_policy=3'
    + '&enablejsapi=1&origin=' + encodeURIComponent(location.origin); // lets us send it "play"
  player.title = item.name + ' video';
  player.allow = 'autoplay; encrypted-media';
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  // Nothing in the player can be tapped, so if it doesn't start by itself we tell it to:
  // once it has loaded, send "mute" and "play" messages (and again a moment later, to be sure).
  player.addEventListener('load', () => {
    const tell = (command) => player.contentWindow && player.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }), 'https://www.youtube-nocookie.com');
    const start = () => { tell('mute'); tell('playVideo'); };
    start();
    setTimeout(start, 1500);
  });
  media.appendChild(player);
  media.parentElement.classList.add('playing'); // the card widens to fit the whole video
  button.textContent = '■ Stop';
  playingCard = { media, button };
  media.parentElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Draw the chips, the wish list message, and the cards that match the chip and search box.
function drawShop() {
  stopCardVideo(); // the cards are about to be redrawn
  shopChips.innerHTML = '';
  SHOP_KINDS.forEach((kind) => {
    const chip = document.createElement('button');
    chip.className = kind === shopKind ? 'chip selected' : 'chip';
    chip.textContent = kind;
    chip.addEventListener('click', () => {
      shopKind = kind;
      drawShop();
    });
    shopChips.appendChild(chip);
  });

  // Which wished-for items are in the shop today?
  const wishedHere = shopItems.filter((item) => isWished(item.key));
  const wishedNames = [...new Set(wishedHere.map((item) => item.name))];
  shopTab.classList.toggle('has-wish', wishedNames.length > 0);
  if (wishedNames.length > 0) {
    wishBox.textContent = '★ In the shop today from your wish list: ' + wishedNames.join(', ');
    wishBox.hidden = false;
  } else {
    wishBox.hidden = true;
  }

  const search = shopSearch.value.trim().toLowerCase();
  const matchesSearch = (item) => !search || item.name.toLowerCase().includes(search);
  shopList.innerHTML = '';
  let shown = 0;

  if (shopKind === '★ Wish list') {
    wishedHere.filter(matchesSearch).forEach((item) => {
      shopList.appendChild(makeShopCard(item, true));
      shown += 1;
    });
    // Wished-for items that aren't in the shop today still show, faded.
    const keysHere = new Set(wishedHere.map((item) => item.key));
    data.wishlist.filter((wish) => !keysHere.has(wish.key)).filter(matchesSearch).forEach((wish) => {
      shopList.appendChild(makeShopCard(wish, false));
      shown += 1;
    });
    shopNote.textContent = data.wishlist.length === 0
      ? 'Tap the ★ on anything in the shop to add it to your wish list.'
      : shown + ' on your wish list';
  } else {
    shopItems
      .filter((item) => shopKind === 'All' || item.kind === shopKind)
      .filter(matchesSearch)
      .forEach((item) => {
        shopList.appendChild(makeShopCard(item, true));
        shown += 1;
      });
    shopNote.textContent = shopItems.length === 0 ? shopNote.textContent
      : shown + ' of ' + shopItems.length + ' things in today\'s shop';
  }
}

// Fetch today's shop (at most once every ten minutes).
async function loadShop() {
  if (Date.now() - shopLoadedAt < 10 * 60 * 1000) return;
  shopLoadedAt = Date.now();

  let offers;
  try {
    const response = await fetch(SHOP_URL);
    if (!response.ok) throw new Error('status ' + response.status);
    offers = (await response.json()).data.entries;
    if (!Array.isArray(offers)) throw new Error('no entries');
  } catch (error) {
    shopLoadedAt = 0; // let the next tap try again
    if (shopItems.length === 0) shopNote.textContent = 'Can\'t load the shop right now.';
    return;
  }

  try {
    // The same thing can be listed twice (in two sections). Keep one of each.
    const seen = new Set();
    shopItems = offers.map(simplifyOffer).filter((item) => {
      if (!item || seen.has(item.key + '|' + item.price)) return false;
      seen.add(item.key + '|' + item.price);
      return true;
    });
    drawShop();
  } catch (error) {
    showAppBug(error);
  }
}

shopSearch.addEventListener('input', drawShop);
drawShop();
// If there's a wish list, check the shop right away so the ★ can show on the Shop tab.
if (data.wishlist.length > 0) loadShop();

// ---------- Self-updating and offline ----------
// Start the helper in sw.js. It fetches the newest app when online and keeps
// a saved copy for when there's no internet.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.error(error));
}
