# Drop & Finds

A second-screen iPad web app for Fortnite. Spin a wheel to pick where to drop, and pin what you find on the map.

Fan-made. Not made by or connected to Epic Games. Map data comes from [fortnite-api.com](https://fortnite-api.com), a free community service.

**Open it:** https://astnhughes.github.io/drop-and-finds/
**Put it on the iPad:** open that address in Safari, tap Share, then Add to Home Screen.

## How it works, part by part

### The files

| File | What it is | Like... |
|---|---|---|
| `index.html` | What's on the page: the buttons, the wheel, the map, the pop-up cards | The skeleton |
| `style.css` | How it looks: colors, sizes, where things sit | The clothes |
| `app.js` | What it does when you tap things | The brain |
| `sw.js` | A helper that fetches new versions and keeps a saved copy for offline | The backpack |
| `manifest.webmanifest` + `icons/` | The name and icon for the Home Screen | The name tag |

### Drop Picker

1. When the app opens, it asks the map service for today's locations.
2. Each location becomes a slice on the wheel.
3. **Spin** picks a winner at random *first*, then turns the wheel so that slice stops under the arrow.
4. **Skip this spot** takes the winner off the wheel and spins again.
5. **Pick** jumps to the map and marks the spot. The service gives locations in game coordinates (big numbers), so the app converts them to "how far across and down the picture".

### My Finds

1. Tap the map and the app works out where on the picture you tapped, as a number from 0 to 1 across and down. That's why a pin stays on its spot at any zoom.
2. Choose a category, Confirmed or Rumor, and an optional note.
3. Pins are saved on the iPad itself (in the browser's storage). Nothing is sent anywhere.
4. Pinch to zoom, drag to slide. The map gets bigger; the pins stay the same size.
5. The filter buttons show one category at a time.

### Seasons

The app reads the game's version number (like 43.10). When the big number goes up, a new season has started: the old season's pins and map picture are kept in the archive, and a fresh season begins. Old seasons are look-only.

### Backup

**Export** saves every season's pins to one file. **Import** adds pins from a file and never deletes any.

### Updating and offline

Every time the app opens with internet, `sw.js` fetches the newest version and saves a copy. With no internet, it uses the saved copy.

### Loot route

After Pick, **Loot route** takes the pins near the drop spot and draws the shortest walk through them, starting where you land. It respects the category filter, so filtering to Chests first gives a chest run. The order is worked out exactly (see `bestOrder` in `app.js`), not guessed.

### Guide (web tips)

`guide.json` holds tips gathered from gaming articles: which NPCs, bosses and vaults are at which named place. Places that match a location from the map service get a 📖 marker on the map. A tip only says which place, so when the real thing is found in the game, "Found it" turns it into an exact pin.

To refresh it, ask Claude to "refresh the guide". Claude re-reads the articles, rewrites `guide.json` (tips, `checked` date, and `season`), and publishes. The guide hides itself when the season number in the file no longer matches the game.

## Changing the look

All the colors are at the top of sections in `style.css` (look for `:root`). Pin categories and their icons are the `CATEGORIES` list in `app.js`.

## After a new chapter

The Pick marker uses three numbers measured on the season 43 map (`MAP_SCALE`, `MAP_CENTER_X`, `MAP_CENTER_Y` in `app.js`). A brand-new map may need them measured again; the app shows a small warning until `MEASURED_SEASON` is updated.
