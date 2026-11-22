// Drop & Finds — step 2: the Drop Picker wheel.

// Where the map comes from. This is a free community service, not Epic.
const MAP_URL = 'https://fortnite-api.com/v1/map';

const statusLine = document.getElementById('status');

// ---------- Switching screens ----------
// When a bottom button is tapped, show its screen and hide the other one.
const tabs = document.querySelectorAll('.tab');
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.hidden = screen.id !== tab.dataset.screen;
    });
  });
});

// ---------- The wheel ----------
const wheel = document.getElementById('wheel');
const resultLine = document.getElementById('result');
const spinButton = document.getElementById('spin');
const skipButton = document.getElementById('skip');
const resetButton = document.getElementById('reset');
const skippedNote = document.getElementById('skipped-note');

const SPIN_SECONDS = 4;      // must match the "transition" time in style.css
const SLICE_COLORS = ['--slice-1', '--slice-2', '--slice-3', '--slice-4'];

let allSpots = [];     // every location name from the live map
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

  spotsOnWheel.forEach((name, i) => {
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
                  transform="rotate(${middleOfSlice} 250 250)">${escapeText(name)}</text>`;
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
    resultLine.textContent = chosenSpot;
    spinning = false;
    updateButtons();
  }, SPIN_SECONDS * 1000 + 100);
}

// Skip: take the chosen spot off the wheel and spin again.
function skip() {
  if (spinning || !chosenSpot || spotsOnWheel.length <= 1) return;
  spotsOnWheel = spotsOnWheel.filter((name) => name !== chosenSpot);
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
  spinButton.disabled = spinning || spotsOnWheel.length === 0;
  spinButton.textContent = chosenSpot ? 'Re-spin' : 'Spin';
  skipButton.disabled = spinning || !chosenSpot || spotsOnWheel.length <= 1;
  resetButton.hidden = skippedCount === 0;
  resetButton.disabled = spinning;
  skippedNote.hidden = skippedCount === 0;
  skippedNote.textContent = skippedCount === 1 ? '1 spot skipped' : skippedCount + ' spots skipped';
}

spinButton.addEventListener('click', spin);
skipButton.addEventListener('click', skip);
resetButton.addEventListener('click', resetWheel);

// ---------- Loading the map ----------
// Ask the service for the current map, then fill the wheel and show the picture.
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
    // Every location's name goes on the wheel.
    allSpots = map.pois.map((spot) => spot.name);
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
