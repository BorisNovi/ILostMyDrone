import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LngLatLike } from 'maplibre-gl';

import { GeolocationService } from '../../core/geolocation.service';
import { MapComponent } from './map/map';

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
  protected readonly geolocation = inject(GeolocationService);

  protected readonly form = this.#fb.nonNullable.group({
    lat: [null as number | null, [Validators.required, Validators.min(-90), Validators.max(90)]],
    lng: [null as number | null, [Validators.required, Validators.min(-180), Validators.max(180)]],
  });

  protected readonly target = signal<LngLatLike | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { lat, lng } = this.form.getRawValue();
    if (lat === null || lng === null)
      return;

    this.target.set({ lat, lng });
  }
}
