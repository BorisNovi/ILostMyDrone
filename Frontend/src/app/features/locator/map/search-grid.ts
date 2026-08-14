import { LngLat, LngLatLike } from 'maplibre-gl';
import { offsetMeters } from '../geo.util';

export const GRID_RADIUS_M = 200;
export const GRID_CELL_M = 5;

const GRID_SPAN = GRID_RADIUS_M * 2;
const GRID_SIZE = GRID_SPAN / GRID_CELL_M;
const GRID_HALF = GRID_SIZE / 2;

/** Maps a 0-based grid index to an algebra-style axis coordinate that skips zero: ..., -2, -1, 1, 2, ... */
function axisLabel(index: number): number {
  return index < GRID_HALF ? index - GRID_HALF : index - GRID_HALF + 1;
}

/**
 * Builds an 80x80 grid of 5m squares covering 200m in every direction from
 * `center`, plus a matching set of point labels ("col,row") for their
 * southwest corners.
 */
export function buildSearchGrid(center: LngLatLike) {
  const cells: {
    type: 'Feature';
    id: number;
    properties: Record<string, never>;
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }[] = [];

  const labels: {
    type: 'Feature';
    properties: { label: string };
    geometry: { type: 'Point'; coordinates: number[] };
  }[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const west = -GRID_RADIUS_M + col * GRID_CELL_M;
      const south = -GRID_RADIUS_M + row * GRID_CELL_M;
      const east = west + GRID_CELL_M;
      const north = south + GRID_CELL_M;

      const sw = offsetMeters(center, west, south).toArray();
      const se = offsetMeters(center, east, south).toArray();
      const ne = offsetMeters(center, east, north).toArray();
      const nw = offsetMeters(center, west, north).toArray();

      cells.push({
        type: 'Feature',
        id: row * GRID_SIZE + col,
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[sw, se, ne, nw, sw]] },
      });

      labels.push({
        type: 'Feature',
        properties: { label: `${axisLabel(col)}, ${axisLabel(row)}` },
        geometry: { type: 'Point', coordinates: sw },
      });
    }
  }

  return {
    cells: { type: 'FeatureCollection' as const, features: cells },
    labels: { type: 'FeatureCollection' as const, features: labels },
  };
}

/** Storage key so a grid's checked cells persist across visits to the same target. */
export function gridStorageKey(center: LngLatLike): string {
  const p = LngLat.convert(center);
  return `grid:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}
