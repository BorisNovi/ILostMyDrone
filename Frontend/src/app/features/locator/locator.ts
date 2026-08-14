import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { GeolocationService, StorageService } from '@app/core';
import { LngLatLike } from 'maplibre-gl';
import { bearingDegrees, compassDirection, distanceMeters, formatDistance, parseLatLng } from './geo.util';
import { MapComponent } from './map/map';
import { gridStorageKey } from './map/search-grid';

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
  protected readonly geolocation = inject(GeolocationService);

  readonly #storedCoords = this.#storage.getItem<{ lat: number; lng: number }>(COORDS_STORAGE_KEY);

  protected readonly form = this.#fb.nonNullable.group({
    lat: [
      this.#storedCoords?.lat ?? (null as number | null),
      [Validators.required, Validators.min(-90), Validators.max(90)],
    ],
    lng: [
      this.#storedCoords?.lng ?? (null as number | null),
      [Validators.required, Validators.min(-180), Validators.max(180)],
    ],
  });

  protected readonly target = signal<LngLatLike | null>(this.#storedCoords);
  protected readonly pasteError = signal<string | null>(null);

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

    const parsed = parseLatLng(text);
    if (!parsed) {
      this.pasteError.set('Clipboard doesn\'t contain "lat, lng" coordinates');
      return;
    }

    this.form.patchValue(parsed);
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
  }

  protected clear(): void {
    const target = this.target();
    if (target)
      this.#storage.removeItem(gridStorageKey(target));

    this.#storage.removeItem(COORDS_STORAGE_KEY);
    this.form.reset({ lat: null, lng: null });
    this.target.set(null);
  }
}
