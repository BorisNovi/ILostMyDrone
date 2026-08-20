import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const STORAGE_NAMESPACE = 'coords-finder:';

/** Signal-backed wrapper around localStorage, kept in sync via an effect. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly #storageSignal = signal<Record<string, unknown>>(this.#loadInitialData());

  readonly data = computed(() => this.#storageSignal());

  constructor() {
    effect(() => {
      if (!this.#isBrowser)
        return;

      const currentData = this.#storageSignal();
      try {
        for (const [key, value] of Object.entries(currentData))
          localStorage.setItem(key, JSON.stringify(value));

        this.#cleanUpUnusedKeys(currentData);
      }
      catch (error) {
        console.error(`Error while writing to localStorage: ${error}`);
      }
    });
  }

  getItem<T>(key: string): T | null {
    const data = this.#storageSignal();
    const namespacedKey = this.#getNamespacedKey(key);
    return data[namespacedKey] !== undefined ? (data[namespacedKey] as T) : null;
  }

  setItem<T>(key: string, value: T): void {
    const namespacedKey = this.#getNamespacedKey(key);
    this.#storageSignal.update((currentData) => ({ ...currentData, [namespacedKey]: value }));
  }

  removeItem(key: string): void {
    const namespacedKey = this.#getNamespacedKey(key);
    this.#storageSignal.update((currentData) => {
      const newData = { ...currentData };
      delete newData[namespacedKey];
      return newData;
    });
  }

  clear(): void {
    this.#storageSignal.set({});
  }

  #loadInitialData(): Record<string, unknown> {
    if (!this.#isBrowser)
      return {};

    const data: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_NAMESPACE))
          continue;

        const rawValue = localStorage.getItem(key);
        if (rawValue !== null)
          data[key] = JSON.parse(rawValue);
      }
      return data;
    }
    catch (error) {
      console.error(`Error while reading from localStorage: ${error}`);
      return {};
    }
  }

  /** Removes namespaced keys that were dropped from the signal (e.g. via removeItem/clear). */
  #cleanUpUnusedKeys(currentData: Record<string, unknown>): void {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_NAMESPACE) && !(key in currentData))
        localStorage.removeItem(key);
    }
  }

  #getNamespacedKey(key: string): string {
    return `${STORAGE_NAMESPACE}${key}`;
  }
}
