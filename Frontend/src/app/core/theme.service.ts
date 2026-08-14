import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { DOCUMENT } from "@angular/common";

@Injectable({providedIn: 'root'})
export class ThemeService {
  readonly #document = inject(DOCUMENT);
  readonly #theme = signal<Theme>(Theme.light);
  readonly isThemeLight = computed(() => this.#theme() == Theme.light);

  constructor() {
    effect(() => {
      const root = this.#document.documentElement;
      root.classList.toggle('theme-dark', !this.isThemeLight());
    });
  }

  toggleTheme(): void {
    this.#theme.set(this.isThemeLight() ? Theme.dark : Theme.light);
  }
}

enum Theme {
  'light',
  'dark'
}