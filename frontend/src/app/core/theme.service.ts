import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';

enum Theme {
  Light = 'light',
  Dark = 'dark',
}

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #document = inject(DOCUMENT);
  readonly #storage = inject(StorageService);

  /** null means "no explicit choice yet" — follow the system preference. */
  readonly #userTheme = signal<Theme | null>(this.#storage.getItem<Theme>(STORAGE_KEY));
  readonly #systemPrefersDark = signal(this.#systemPrefersDarkNow());

  readonly isThemeLight = computed(
    () => (this.#userTheme() ?? (this.#systemPrefersDark() ? Theme.Dark : Theme.Light)) === Theme.Light,
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (event) => this.#systemPrefersDark.set(event.matches));
    }

    effect(() => {
      const root = this.#document.documentElement;
      root.classList.toggle('theme-light', this.isThemeLight());
      root.classList.toggle('theme-dark', !this.isThemeLight());
    });
  }

  toggleTheme(): void {
    const theme = this.isThemeLight() ? Theme.Dark : Theme.Light;
    this.#userTheme.set(theme);
    this.#storage.setItem(STORAGE_KEY, theme);
  }

  #systemPrefersDarkNow(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
