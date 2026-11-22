// Drop & Finds — step 1: two screens and the live map.

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

// ---------- Loading the map ----------
// Ask the service for the current map, then put the pictures on screen.
async function loadMap() {
  try {
    const response = await fetch(MAP_URL);
    if (!response.ok) throw new Error('The map service answered ' + response.status);

    const map = (await response.json()).data;

    // images.pois = map with names printed on it, images.blank = map with no names
    document.getElementById('map-named').src = map.images.pois;
    document.getElementById('map-blank').src = map.images.blank;

    statusLine.textContent = map.pois.length + ' locations on today\'s map';
    statusLine.classList.remove('problem');
  } catch (error) {
    statusLine.textContent = 'Could not load the map. Check the internet and reopen.';
    statusLine.classList.add('problem');
    console.error(error);
  }
}

loadMap();
