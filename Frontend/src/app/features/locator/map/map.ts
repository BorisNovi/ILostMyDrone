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
import { GeolocationService, UserPosition } from '@app/core';

const ROUTE_SOURCE_ID = 'route';
const FALLBACK_CENTER: [number, number] = [41.8902, 12.4925];

// MapLibre infers the worker URL from its own bundle's `import.meta.url`, which
// resolves to a broken path once the dev server or the app bundler moves the
// module around. Pointing it at a static copy (see scripts/copy-maplibre-worker.mjs)
// sidesteps that entirely, in both dev and production.
setWorkerUrl('/maplibre-gl-worker.mjs');

@Component({
  selector: 'app-map',
  templateUrl: 'map.html',
  styleUrl: 'map.scss',
})
export class MapComponent implements OnDestroy {
  readonly #geolocation = inject(GeolocationService);

  readonly target = input<LngLatLike | null>(null);

  protected readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  #map: Map | null = null;
  #userMarker: Marker | null = null;
  #targetMarker: Marker | null = null;
  #lastFittedTarget: LngLatLike | null = null;

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
  }

  ngOnDestroy(): void {
    this.#geolocation.stop();
    this.#map?.remove();
  }

  #initMap(): void {
    this.#map = new Map({
      container: this.mapContainer().nativeElement,
      style: environment.tilesLightUrl,
      center: FALLBACK_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    this.#map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');

    this.#map.on('load', () => {
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
