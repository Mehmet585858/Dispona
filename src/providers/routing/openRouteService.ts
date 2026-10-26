import { RoutingCache } from "./cache";
import { luftlinieMinuten } from "./luftlinie";
import type { GeocodeResult, LatLng, RoutingProvider } from "./types";

const BASIS_URL = "https://api.openrouteservice.org";
/** Ab diesem Wert (0–1) gilt ein Geocoding-Treffer als "sicher" (docs/02-architektur.md). */
export const GEOCODE_SICHER_SCHWELLE = 0.8;

type MatrixAntwort = { durations?: number[][] };
type GeocodeAntwort = {
  features: {
    geometry: { coordinates: [number, number] };
    properties: { label: string; confidence: number };
  }[];
};

export function createOpenRouteService(apiKey: string | undefined): RoutingProvider {
  const matrixCache = new RoutingCache<number[][]>();

  async function matrix(from: LatLng[], to: LatLng[]): Promise<number[][]> {
    if (!apiKey) {
      return from.map((f) => to.map((t) => luftlinieMinuten(f, t)));
    }

    const gecacht = matrixCache.lesen([...from, ...to]);
    if (gecacht) return gecacht;

    const locations = [...from, ...to].map((p) => [p.lng, p.lat]);
    const sources = from.map((_, i) => String(i));
    const destinations = to.map((_, i) => String(from.length + i));

    try {
      const antwort = await fetch(`${BASIS_URL}/v2/matrix/driving-car`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ locations, sources, destinations, metrics: ["duration"] }),
      });
      if (!antwort.ok) {
        throw new Error(`OpenRouteService Matrix-Fehler: ${antwort.status}`);
      }
      const daten = (await antwort.json()) as MatrixAntwort;
      if (!daten.durations) {
        throw new Error("OpenRouteService Matrix: keine Fahrzeiten erhalten.");
      }
      const minuten = daten.durations.map((zeile) => zeile.map((sekunden) => sekunden / 60));
      matrixCache.schreiben([...from, ...to], minuten);
      return minuten;
    } catch {
      // Notlösung bei Ausfall (docs/05-disposition.md): Luftlinie × 1,4 bei 40 km/h.
      return from.map((f) => to.map((t) => luftlinieMinuten(f, t)));
    }
  }

  return {
    name: "openrouteservice",

    async geocode(query: string, near?: LatLng): Promise<GeocodeResult[]> {
      if (!apiKey) return [];
      const parameter = new URLSearchParams({ api_key: apiKey, text: query, size: "5" });
      if (near) {
        parameter.set("focus.point.lat", String(near.lat));
        parameter.set("focus.point.lon", String(near.lng));
      }
      const antwort = await fetch(`${BASIS_URL}/geocode/search?${parameter.toString()}`);
      if (!antwort.ok) {
        throw new Error(`OpenRouteService Geocoding-Fehler: ${antwort.status}`);
      }
      const daten = (await antwort.json()) as GeocodeAntwort;
      return daten.features.map((feature) => ({
        label: feature.properties.label,
        position: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
        confidence: feature.properties.confidence,
      }));
    },

    async travelTimeMinutes(from: LatLng, to: LatLng): Promise<number> {
      const ergebnis = await matrix([from], [to]);
      return ergebnis[0][0];
    },

    matrix,
  };
}
