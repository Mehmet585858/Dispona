export type LatLng = { lat: number; lng: number };

/** Entfernung zweier Punkte in Kilometern (Haversine-Formel). */
export function entfernungKm(a: LatLng, b: LatLng): number {
  const erdradiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * erdradiusKm * Math.asin(Math.sqrt(h));
}
