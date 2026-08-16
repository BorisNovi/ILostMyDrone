import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/** Thin wrapper around the router's query params — flat string key/value pairs only. */
@Injectable({ providedIn: 'root' })
export class QueryParamsService {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);

  getParam(key: string): string | null {
    return this.#route.snapshot.queryParamMap.get(key);
  }

  /** Merges `params` into the current query string. A `null` value removes that key. */
  setParams(params: Record<string, string | null>, replaceUrl = true): void {
    this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
