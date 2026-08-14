import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { GeolocationService, StorageService, ThemeService, UserPosition } from '@app/core';
import { environment } from '@environments/environment';
import {
  GeoJSONSource,
  LngLat,
  LngLatBounds,
  LngLatLike,
  Map,
  MapLayerMouseEvent,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import { buildSearchGrid, gridStorageKey } from './search-grid';

const ROUTE_SOURCE_ID = 'route';
const GRID_SOURCE_ID = 'search-grid';
const GRID_FILL_LAYER_ID = 'search-grid-fill';
const GRID_LINE_LAYER_ID = 'search-grid-line';
const GRID_LABELS_SOURCE_ID = 'search-grid-labels';
const GRID_LABEL_LAYER_ID = 'search-grid-label';
/** Below this zoom, 5m cells are too small on screen for their labels to be legible. */
const GRID_LABEL_MIN_ZOOM = 19;
// [lng, lat] — Rome, used only when there's neither a restored target nor a GPS fix yet.
const FALLBACK_CENTER: [number, number] = [12.4925, 41.8902];

// Documented bundler setup for MapLibre v6+ (esbuild/webpack): `import.meta.url`
// inside maplibre-gl's own module doesn't reliably resolve once a bundler moves
// it around, so every consumer must point setWorkerUrl() at a copy of the worker
// file (see scripts/copy-maplibre-worker.mjs) — resolved relative to this module
// so it still works if the app is ever served from a sub-path.
// https://maplibre.org/maplibre-gl-js/docs/
setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString());

@Component({
  selector: 'app-map',
  templateUrl: 'map.html',
  styleUrl: 'map.scss',
})
export class MapComponent implements OnDestroy {
  readonly #geolocation = inject(GeolocationService);
  readonly #themeService = inject(ThemeService);
  readonly #storage = inject(StorageService);

  readonly target = input<LngLatLike | null>(null);

  protected readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  #map: Map | null = null;
  #userMarker: Marker | null = null;
  #targetMarker: Marker | null = null;
  #lastFittedTarget: LngLatLike | null = null;
  #appliedStyle: string | null = null;
  /** Stops auto-following the user once they've manually panned the map. */
  #followUser = true;

  #grid: ReturnType<typeof buildSearchGrid> | null = null;
  #gridStorageKey: string | null = null;
  #checkedCells = new Set<number>();

  constructor() {
    afterNextRender(() => this.#initMap());

    effect(() => {
      const position = this.#geolocation.position();
      const target = this.target();

      this.#updateUserMarker(position);
      this.#updateTargetMarker(target);
      this.#updateRoute(position, target);

      // Only mark as fitted once we actually had both a position and a target to fit —
      // otherwise a target restored before the first GPS fix would never get fitted
      // once the position does arrive, since this would already look "up to date".
      if (target !== this.#lastFittedTarget && position && target) {
        this.#lastFittedTarget = target;
        this.#fitToMarkers(position, target);
      }
    });

    effect(() => {
      this.#rebuildGrid(this.target());
    });

    effect(() => {
      const style = this.#themeService.isThemeLight() ? environment.tilesLightUrl : environment.tilesDarkUrl;
      if (this.#map && style !== this.#appliedStyle) {
        this.#appliedStyle = style;
        this.#map.setStyle(style);
      }
    });
  }

  ngOnDestroy(): void {
    this.#geolocation.stop();
    this.#map?.remove();
  }

  #initMap(): void {
    const style = this.#themeService.isThemeLight() ? environment.tilesLightUrl : environment.tilesDarkUrl;
    this.#appliedStyle = style;

    this.#map = new Map({
      container: this.mapContainer().nativeElement,
      style,
      center: this.target() ?? FALLBACK_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    this.#map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');

    // `dragstart` only fires for user-initiated panning (never for our own
    // `easeTo` calls below), so this is a clean signal to stop auto-following.
    this.#map.on('dragstart', () => {
      this.#followUser = false;
    });

    this.#map.on('click', GRID_FILL_LAYER_ID, (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.id;
      if (typeof id === 'number')
        this.#toggleCell(id);
    });

    // Fires on the initial load *and* every subsequent setStyle() (e.g. theme
    // toggle) — setStyle() wipes any source/layer not part of the style JSON,
    // so the route needs to be re-attached every time, not just once.
    this.#map.on('style.load', () => {
      if (!this.#map?.getSource(ROUTE_SOURCE_ID)) {
        this.#map?.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });

        this.#map?.addLayer({
          id: ROUTE_SOURCE_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          paint: {
            'line-color': '#1a73e8',
            'line-width': 3,
            'line-dasharray': [2, 2],
          },
        });
      }

      this.#applyGrid();

      this.#updateUserMarker(this.#geolocation.position());
      this.#updateTargetMarker(this.target());
      this.#updateRoute(this.#geolocation.position(), this.target());
    });

    this.#geolocation.start();
  }

  /** Regenerates the search grid for a newly submitted target and restores its checked cells. */
  #rebuildGrid(target: LngLatLike | null): void {
    if (!target) {
      this.#grid = null;
      this.#gridStorageKey = null;
      this.#checkedCells = new Set();
      this.#applyGrid();
      return;
    }

    this.#gridStorageKey = gridStorageKey(target);
    this.#checkedCells = new Set(this.#storage.getItem<number[]>(this.#gridStorageKey) ?? []);
    this.#grid = buildSearchGrid(target);
    this.#applyGrid();
  }

  /** (Re-)creates the grid source/layers if needed and syncs data + checked feature-state. */
  #applyGrid(): void {
    if (!this.#map)
      return;

    const source = this.#map.getSource(GRID_SOURCE_ID) as GeoJSONSource | undefined;
    const labelsSource = this.#map.getSource(GRID_LABELS_SOURCE_ID) as GeoJSONSource | undefined;
    const cellsData = this.#grid?.cells ?? { type: 'FeatureCollection' as const, features: [] };
    const labelsData = this.#grid?.labels ?? { type: 'FeatureCollection' as const, features: [] };

    if (source && labelsSource) {
      source.setData(cellsData);
      labelsSource.setData(labelsData);

      // Feature-state is keyed by (source, id) and outlives setData() — the
      // grid always reuses the same 0..N-1 ids across different locations, so
      // without this, "checked" flags from a previous target would bleed into
      // the newly loaded one wherever ids happen to line up.
      this.#map.removeFeatureState({ source: GRID_SOURCE_ID });
    }
    else {
      this.#map.addSource(GRID_SOURCE_ID, { type: 'geojson', data: cellsData });
      this.#map.addSource(GRID_LABELS_SOURCE_ID, { type: 'geojson', data: labelsData });

      this.#map.addLayer({
        id: GRID_FILL_LAYER_ID,
        type: 'fill',
        source: GRID_SOURCE_ID,
        paint: {
          'fill-color': ['case', ['boolean', ['feature-state', 'checked'], false], '#34a853', '#1a73e8'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'checked'], false], 0.35, 0.08],
        },
      });

      this.#map.addLayer({
        id: GRID_LINE_LAYER_ID,
        type: 'line',
        source: GRID_SOURCE_ID,
        paint: { 'line-color': '#1a73e8', 'line-width': 1, 'line-opacity': 0.3 },
      });

      this.#map.addLayer({
        id: GRID_LABEL_LAYER_ID,
        type: 'symbol',
        source: GRID_LABELS_SOURCE_ID,
        minzoom: GRID_LABEL_MIN_ZOOM,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-anchor': 'bottom-left',
          'text-offset': [0.15, -0.15],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#1a73e8', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
      });
    }

    for (const id of this.#checkedCells)
      this.#map.setFeatureState({ source: GRID_SOURCE_ID, id }, { checked: true });
  }

  #toggleCell(id: number): void {
    if (!this.#map || !this.#gridStorageKey)
      return;

    if (this.#checkedCells.has(id))
      this.#checkedCells.delete(id);
    else
      this.#checkedCells.add(id);

    this.#map.setFeatureState({ source: GRID_SOURCE_ID, id }, { checked: this.#checkedCells.has(id) });
    this.#storage.setItem(this.#gridStorageKey, [...this.#checkedCells]);
  }

  #updateUserMarker(position: UserPosition | null): void {
    if (!this.#map || !position)
      return;

    if (!this.#userMarker) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.innerHTML = '<div class="user-marker__arrow"></div>';
      this.#userMarker = new Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat(position)
        .addTo(this.#map);
    }
    else
      this.#userMarker.setLngLat(position);

    if (position.heading !== null)
      this.#userMarker.setRotation(position.heading);

    if (!this.target() && this.#followUser)
      this.#map.easeTo({ center: position });
  }

  #updateTargetMarker(target: LngLatLike | null): void {
    if (!this.#map || !target)
      return;

    if (!this.#targetMarker)
      this.#targetMarker = new Marker({ color: '#d93025' }).setLngLat(target).addTo(this.#map);
    else
      this.#targetMarker.setLngLat(target);
  }

  #updateRoute(position: UserPosition | null, target: LngLatLike | null): void {
    const source = this.#map?.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source)
      return;

    const coordinates =
      position && target
        ? [[position.lng, position.lat], LngLat.convert(target).toArray()]
        : [];

    source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
  }

  #fitToMarkers(position: UserPosition | null, target: LngLatLike | null): void {
    if (!this.#map || !position || !target)
      return;

    const bounds = new LngLatBounds();
    bounds.extend(position);
    bounds.extend(target);
    this.#map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 500 });
  }
}
