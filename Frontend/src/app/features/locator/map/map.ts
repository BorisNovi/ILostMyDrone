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
import {
  setWorkerUrl,
  Map,
  Marker,
  NavigationControl,
  LngLat,
  LngLatBounds,
  LngLatLike,
  GeoJSONSource,
} from 'maplibre-gl';
import { environment } from '@environments/environment';
import { GeolocationService, ThemeService, UserPosition } from '@app/core';

const ROUTE_SOURCE_ID = 'route';
const FALLBACK_CENTER: [number, number] = [41.8902, 12.4925];

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

  readonly target = input<LngLatLike | null>(null);

  protected readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  #map: Map | null = null;
  #userMarker: Marker | null = null;
  #targetMarker: Marker | null = null;
  #lastFittedTarget: LngLatLike | null = null;
  #appliedStyle: string | null = null;

  constructor() {
    afterNextRender(() => this.#initMap());

    effect(() => {
      const position = this.#geolocation.position();
      const target = this.target();

      this.#updateUserMarker(position);
      this.#updateTargetMarker(target);
      this.#updateRoute(position, target);

      if (target !== this.#lastFittedTarget) {
        this.#lastFittedTarget = target;
        this.#fitToMarkers(position, target);
      }
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
      center: FALLBACK_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    this.#map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');

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

      this.#updateUserMarker(this.#geolocation.position());
      this.#updateTargetMarker(this.target());
      this.#updateRoute(this.#geolocation.position(), this.target());
    });

    this.#geolocation.start();
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

    if (!this.target())
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
