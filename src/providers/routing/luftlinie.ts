import { entfernungKm } from "@/lib/geo";
import type { LatLng } from "./types";

/** Notlösung, wenn der Routing-Dienst ausfällt: Luftlinie × 1,4 bei 40 km/h (docs/05-disposition.md). */
export function luftlinieMinuten(from: LatLng, to: LatLng): number {
  const strassenKm = entfernungKm(from, to) * 1.4;
  const stundenKmH = 40;
  return (strassenKm / stundenKmH) * 60;
}
