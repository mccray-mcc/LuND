# LuND — London Urban Noise Distribution

Easiest: double-click **Start LuND.command** in this folder. It starts a local server and opens the site.

Or run it from Terminal (fonts won't load from `file://`):

```bash
cd /Users/mccraymcclellan/Documents/Creative_Coding/Tools/LuND && python3 -m http.server 3457
```

Then open http://127.0.0.1:3457 in Chrome or Safari. It needs internet for map tiles, borough outlines and the field recordings.

## Structure
- `index.html` — intro scenes + map app markup
- `css/lund.css` — all styling (white everywhere, cross cursor, panel UI)
- `js/data.js` — borough data merged from the noise CSV, decibel comparison CSV and GLA green cover sheet
- `js/audio.js` — sound engine: real London recordings (Wikimedia Commons) + synthesized traffic, sirens, horns, trains, aircraft, leaves
- `js/app.js` — intro controller, story charts, MapLibre street map, listener noise model, panels, sound-wave rings
- `video/`, `audio/`, `fonts/`, `svg/` — project assets

## Noise model (per cursor position)
Nearest roads by OpenStreetMap class (motorway 78 dB … residential 56 dB at 10 m), attenuated with distance and building
shielding, plus rail, Heathrow / City Airport, and a background set by the borough's average dB. Green and water share
come from the map polygons around the listener. Health values follow WHO Environmental Noise Guidelines (2018) and are illustrative.
