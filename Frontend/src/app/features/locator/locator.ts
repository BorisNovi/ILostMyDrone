import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { GeolocationService, QueryParamsService, StorageService } from '@app/core';
import {
  bearingDegrees,
  CHECKED_CELLS_PARAM,
  compassDirection,
  decodeCheckedCells,
  distanceMeters,
  encodeCheckedCells,
  formatDistance,
  gridStorageKey,
  parseLatLng,
  parseSharedLink,
  TARGET_PARAM
} from '@app/utils';
import { LngLatLike } from 'maplibre-gl';

import { MapComponent } from './map/map';

const COORDS_STORAGE_KEY = 'coords';

@Component({
  selector: 'app-locator',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MapComponent,
  ],
  templateUrl: 'locator.html',
  styleUrl: 'locator.scss',
})
export class LocatorComponent {
  readonly #fb = inject(FormBuilder);
  readonly #storage = inject(StorageService);
  readonly #queryParams = inject(QueryParamsService);
  protected readonly geolocation = inject(GeolocationService);

  readonly #urlCoords = parseLatLng(this.#queryParams.getParam(TARGET_PARAM) ?? '');
  readonly #storedCoords = this.#storage.getItem<{ lat: number; lng: number }>(COORDS_STORAGE_KEY);
  readonly #initialCoords = this.#urlCoords ?? this.#storedCoords;

  /** Checked cells from a shared link — only meaningful together with #urlCoords. */
  protected readonly sharedCheckedCells = this.#urlCoords
    ? decodeCheckedCells(this.#queryParams.getParam(CHECKED_CELLS_PARAM) ?? '')
    : null;

  protected readonly form = this.#fb.nonNullable.group({
    lat: [
      this.#initialCoords?.lat ?? (null as number | null),
      [Validators.required, Validators.min(-90), Validators.max(90)],
    ],
    lng: [
      this.#initialCoords?.lng ?? (null as number | null),
      [Validators.required, Validators.min(-180), Validators.max(180)],
    ],
  });

  protected readonly target = signal<LngLatLike | null>(this.#initialCoords);
  protected readonly pasteError = signal<string | null>(null);
  protected readonly shareStatus = signal<string | null>(null);

  protected readonly routeInfo = computed(() => {
    const position = this.geolocation.position();
    const target = this.target();
    if (!position || !target)
      return null;

    const bearing = bearingDegrees(position, target);
    // Rotation for an arrow icon pointing at the target *relative to where the
    // phone is currently facing* — falls back to north-up (0) if there's no
    // compass heading yet, matching the map's own north-up default.
    const relativeBearing = (bearing - (position.heading ?? 0) + 360) % 360;

    return {
      distance: formatDistance(distanceMeters(position, target)),
      direction: compassDirection(bearing),
      relativeBearing,
    };
  });

  constructor() {
    // A link shared with someone else takes priority over what's already in
    // their own localStorage — adopt it as the new local baseline.
    if (this.#urlCoords)
      this.#storage.setItem(COORDS_STORAGE_KEY, this.#urlCoords);
  }

  protected async pasteCoordinates(): Promise<void> {
    this.pasteError.set(null);

    let text: string;
    try {
      text = await navigator.clipboard.readText();
    }
    catch {
      this.pasteError.set('Clipboard access denied');
      return;
    }

    // A pasted share link carries its own checked-cells state alongside the
    // target — reloading onto it reuses the exact same URL-hydration path a
    // freshly opened link goes through, instead of juggling that state here.
    const sharedLink = parseSharedLink(text);
    if (sharedLink) {
      location.href = sharedLink;
      return;
    }

    const parsed = parseLatLng(text);
    if (!parsed) {
      this.pasteError.set('Clipboard doesn\'t contain "lat, lng" coordinates or a shared link');
      return;
    }

    this.form.patchValue(parsed);
  }

  protected async share(): Promise<void> {
    this.shareStatus.set(null);
    const url = location.href;

    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'I lost my drone' });
      }
      catch {
        /* user dismissed the share sheet — not an error */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      this.shareStatus.set('Link copied to clipboard');
    }
    catch {
      this.shareStatus.set('Could not copy the link');
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { lat, lng } = this.form.getRawValue();
    if (lat === null || lng === null)
      return;

    this.#storage.setItem(COORDS_STORAGE_KEY, { lat, lng });
    this.target.set({ lat, lng });

    // New target, so any `g` in the URL described checked cells for the old one.
    this.#queryParams.setParams({ [TARGET_PARAM]: `${lat},${lng}`, [CHECKED_CELLS_PARAM]: null });
  }

  protected onCheckedCellsChange(ids: number[]): void {
    this.#queryParams.setParams({ [CHECKED_CELLS_PARAM]: ids.length ? encodeCheckedCells(ids) : null });
  }

  protected clear(): void {
    const target = this.target();
    if (target)
      this.#storage.removeItem(gridStorageKey(target));

    this.#storage.removeItem(COORDS_STORAGE_KEY);
    this.form.reset({ lat: null, lng: null });
    this.target.set(null);

    this.#queryParams.setParams({ [TARGET_PARAM]: null, [CHECKED_CELLS_PARAM]: null });
  }
}
