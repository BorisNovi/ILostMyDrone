import { Injectable, signal } from '@angular/core';

export interface UserPosition {
  lat: number;
  lng: number;
  /** Degrees clockwise from north, or null if unknown. */
  heading: number | null;
  accuracy: number;
}

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Tracks the browser geolocation position and, when available, the device
 * compass heading (used as a fallback while the device is stationary, since
 * GPS-derived heading only updates while moving).
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly position = signal<UserPosition | null>(null);
  readonly error = signal<string | null>(null);
  readonly supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  /** True once we know the compass needs an explicit tap to grant permission (iOS Safari). */
  readonly needsCompassPermission = signal(false);

  #watchId: number | null = null;
  #orientationHandler = (event: DeviceOrientationEvent) => this.#onOrientation(event);
  #listeningOrientation = false;

  start(): void {
    if (!this.supported || this.#watchId !== null)
      return;

    this.#watchId = navigator.geolocation.watchPosition(
      (pos) => this.#onPosition(pos),
      (err) => this.error.set(err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    this.#listenToCompass();
  }

  /**
   * Must be called synchronously from a user-gesture handler (e.g. a click).
   * iOS Safari only grants `DeviceOrientationEvent` permission when it's
   * requested directly inside a tap — a request made from code that runs on
   * page load (like `start()`) is silently ignored.
   */
  enableCompass(): void {
    const ctor = this.#deviceOrientationCtor();
    if (!ctor?.requestPermission)
      return;

    ctor
      .requestPermission()
      .then((state) => {
        if (state === 'granted') {
          this.needsCompassPermission.set(false);
          this.#attachOrientationListeners();
        }
      })
      .catch(() => {
        /* permission denied or unsupported — heading falls back to GPS-derived value */
      });
  }

  stop(): void {
    if (this.#watchId !== null) {
      navigator.geolocation.clearWatch(this.#watchId);
      this.#watchId = null;
    }

    if (this.#listeningOrientation && typeof window !== 'undefined') {
      window.removeEventListener('deviceorientationabsolute', this.#orientationHandler as EventListener);
      window.removeEventListener('deviceorientation', this.#orientationHandler as EventListener);
      this.#listeningOrientation = false;
    }
  }

  #onPosition(pos: GeolocationPosition): void {
    const current = this.position();
    this.error.set(null);
    this.position.set({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading ?? current?.heading ?? null,
      accuracy: pos.coords.accuracy,
    });
  }

  #onOrientation(event: DeviceOrientationEvent): void {
    // `webkitCompassHeading` (iOS Safari) is already degrees clockwise from north.
    const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
      .webkitCompassHeading;
    let heading = webkitHeading;

    // A plain (non-`absolute`) `deviceorientation` event's `alpha` is relative to
    // wherever the device happened to be pointing when tracking started — not to
    // true north — so treating it as a compass reading would just be wrong.
    if (heading === undefined) {
      if (!event.absolute || event.alpha === null)
        return;
      heading = 360 - event.alpha;
    }

    if (heading === null || Number.isNaN(heading))
      return;

    const current = this.position();
    if (current)
      this.position.set({ ...current, heading });
  }

  #listenToCompass(): void {
    if (typeof window === 'undefined' || this.#listeningOrientation)
      return;

    if (this.#deviceOrientationCtor()?.requestPermission) {
      this.needsCompassPermission.set(true);
      return;
    }

    this.#attachOrientationListeners();
  }

  #attachOrientationListeners(): void {
    if (this.#listeningOrientation)
      return;

    window.addEventListener('deviceorientationabsolute', this.#orientationHandler as EventListener);
    window.addEventListener('deviceorientation', this.#orientationHandler as EventListener);
    this.#listeningOrientation = true;
  }

  #deviceOrientationCtor(): DeviceOrientationEventCtor | undefined {
    return (window as typeof window & { DeviceOrientationEvent?: DeviceOrientationEventCtor })
      .DeviceOrientationEvent;
  }
}
