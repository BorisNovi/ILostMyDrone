# I lost my drone

A mobile-first web app for walking to a known GPS coordinate and finding whatever's sitting there — built with a lost FPV drone in mind, but it works for any "there's a thing at this lat/lng" scenario.

## What it does

- Enter (or paste) a target latitude/longitude and see it on a map alongside your live position.
- A line and a compass-relative arrow point from you to the target, with live distance and bearing.
- Your on-map marker rotates with the device compass, not just GPS course, so it also turns while you're standing still.
- A 200m x 200m search grid, divided into 5m cells with algebra-style coordinate labels, appears around the target. Tap a cell to mark it as searched — handy for covering the area on foot without re-walking ground you already checked.
- Everything (last coordinates, checked grid cells, light/dark preference) is saved to `localStorage`, so closing the tab doesn't lose your progress.
- Installable as a PWA and works offline once cached.

## Using it

1. Open the app and grant location access when prompted.
2. Enter the target's latitude and longitude (or tap the paste button to read them from the clipboard — accepts `lat, lng` or `lat lng`), then hit **Find**.
3. Walk following the arrow and distance readout.
4. On iPhone, tap **Enable compass** once — iOS requires that permission to be granted from a direct tap, so it can't be requested automatically.
5. As you search the area, tap grid cells to mark them checked.
6. Hit **Clear** to drop the current target, its saved coordinates, and its grid progress.

Theme follows your OS light/dark setting automatically; there's no manual toggle by design.

## Tech stack

- [Angular](https://angular.dev/) (standalone components, signals, SSR + prerendering)
- [Angular Material](https://material.angular.io/) for UI
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) for the map, with [OpenFreeMap](https://openfreemap.org/) tiles (free, no API key)
- Angular's [service worker](https://angular.dev/ecosystem/service-workers) for PWA/offline support

## Development

Install dependencies (this also copies MapLibre's worker files into `public/`, required for the map to render — see `scripts/copy-maplibre-worker.mjs`):

```bash
npm install
```

Start the dev server at `http://localhost:4200/`:

```bash
npm start
```

Build for production (output in `dist/frontend/browser`):

```bash
npm run build
```

Run unit tests ([Vitest](https://vitest.dev/)):

```bash
npm test
```

### Environment

`src/environments/environment.development.ts` is git-ignored so it can be tweaked locally without touching the tracked defaults. Copy `environment.development.example` to get started if you need to point at different map tiles:

```bash
cp src/environments/environment.development.example src/environments/environment.development.ts
```
