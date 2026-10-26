export type LatLng = { lat: number; lng: number };

export type GeocodeResult = {
  label: string;
  position: LatLng;
  /** 0 (unsicher) bis 1 (sicher). Ab welchem Wert ein Treffer als "sicher" gilt, legt der Aufrufer fest. */
  confidence: number;
};

export interface RoutingProvider {
  name: string;
  geocode(query: string, near?: LatLng): Promise<GeocodeResult[]>;
  travelTimeMinutes(from: LatLng, to: LatLng, departAt: Date): Promise<number>;
  /** Fahrzeiten in Minuten, matrix[i][j] = Zeit von from[i] nach to[j]. */
  matrix(from: LatLng[], to: LatLng[], departAt: Date): Promise<number[][]>;
}
