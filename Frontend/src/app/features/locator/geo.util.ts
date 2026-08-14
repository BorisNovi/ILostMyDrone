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
