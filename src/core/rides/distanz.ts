import { entfernungKm, type LatLng } from "@/lib/geo";

/** Rechnet aufeinanderfolgende GPS-Punkte zu einer gefahrenen Strecke in km auf (docs/07-adapter.md). */
export function gefahreneKmAusPunkten(punkte: LatLng[]): number {
  let summe = 0;
  for (let i = 1; i < punkte.length; i += 1) {
    summe += entfernungKm(punkte[i - 1], punkte[i]);
  }
  return summe;
}

/** Schätzung ohne GPS-Punkte: Luftlinie × 1,4 (gleicher Faktor wie bei der Disposition ohne Routing-Dienst). */
export function gefahreneKmGeschaetzt(von: LatLng, nach: LatLng): number {
  return entfernungKm(von, nach) * 1.4;
}

/** Gefahrene km zwischen "Fahrgast an Bord" und "Erledigt": aus GPS-Punkten, sonst geschätzt. */
export function gefahreneKmBerechnen(punkte: LatLng[], von: LatLng, nach: LatLng): number {
  if (punkte.length >= 2) {
    return gefahreneKmAusPunkten(punkte);
  }
  return gefahreneKmGeschaetzt(von, nach);
}
