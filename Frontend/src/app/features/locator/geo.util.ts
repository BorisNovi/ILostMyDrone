import { LngLatLike, LngLat } from 'maplibre-gl';

const EARTH_RADIUS_M = 6371000;
const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
export function distanceMeters(from: LngLatLike, to: LngLatLike): number {
  const a = LngLat.convert(from);
  const b = LngLat.convert(to);

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial bearing in degrees clockwise from north, in [0, 360). */
export function bearingDegrees(from: LngLatLike, to: LngLatLike): number {
  const a = LngLat.convert(from);
  const b = LngLat.convert(to);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function compassDirection(bearing: number): string {
  return COMPASS_POINTS[Math.round(bearing / 45) % 8];
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

const METERS_PER_DEGREE_LAT = 111320;

/**
 * Offsets a point by a number of meters east (dx) and north (dy), using an
 * equirectangular approximation — accurate to within centimeters at the
 * few-hundred-meter scale this app deals with.
 */
export function offsetMeters(point: LngLatLike, dxMeters: number, dyMeters: number): LngLat {
  const p = LngLat.convert(point);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(toRad(p.lat));
  return new LngLat(p.lng + dxMeters / metersPerDegreeLng, p.lat + dyMeters / METERS_PER_DEGREE_LAT);
}

/** Parses "lat, lng" or "lat lng" (comma and/or whitespace-separated) into coordinates. */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const parts = text.trim().split(/[\s,]+/);
  if (parts.length !== 2)
    return null;

  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return null;

  return { lat, lng };
}
