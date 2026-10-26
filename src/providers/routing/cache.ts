import type { LatLng } from "./types";

const ZWISCHENSPEICHER_MINUTEN = 10;

type Eintrag<T> = { wert: T; bis: number };

/** Einfacher Zwischenspeicher im Arbeitsspeicher, rundet Koordinaten auf ca. 100 m. */
export class RoutingCache<T> {
  private speicher = new Map<string, Eintrag<T>>();

  private rundenAufSchluessel(punkte: LatLng[]): string {
    return punkte.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join("|");
  }

  lesen(punkte: LatLng[]): T | undefined {
    const schluessel = this.rundenAufSchluessel(punkte);
    const eintrag = this.speicher.get(schluessel);
    if (!eintrag) return undefined;
    if (eintrag.bis < Date.now()) {
      this.speicher.delete(schluessel);
      return undefined;
    }
    return eintrag.wert;
  }

  schreiben(punkte: LatLng[], wert: T): void {
    const schluessel = this.rundenAufSchluessel(punkte);
    this.speicher.set(schluessel, { wert, bis: Date.now() + ZWISCHENSPEICHER_MINUTEN * 60_000 });
  }
}
