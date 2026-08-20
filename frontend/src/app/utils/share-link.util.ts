import { parseLatLng } from './geo.util';

/** Query param names — kept short since they end up in a link people share by hand. */
export const TARGET_PARAM = 't';
export const CHECKED_CELLS_PARAM = 'g';

/**
 * If `text` is a URL carrying our `t`/`g` params, rebuilds the equivalent URL
 * against *our own* origin/path — only the param values are trusted, so
 * pasting something crafted to point elsewhere can't navigate the app away.
 * Returns null if `text` isn't a URL or doesn't carry a valid target.
 */
export function parseSharedLink(text: string): string | null {
  let pasted: URL;
  try {
    pasted = new URL(text.trim());
  }
  catch {
    return null;
  }

  const t = pasted.searchParams.get(TARGET_PARAM);
  if (!t || !parseLatLng(t))
    return null;

  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set(TARGET_PARAM, t);

  const g = pasted.searchParams.get(CHECKED_CELLS_PARAM);
  if (g)
    url.searchParams.set(CHECKED_CELLS_PARAM, g);

  return url.toString();
}
