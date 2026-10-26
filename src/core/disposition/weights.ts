import type { TransportType } from "@/generated/prisma/enums";

/** score = anfahrt*W.anfahrt + verspaetung*W.verspaetung + leerKm*W.leerKm + (folgefahrtVerschoben?10:0)*W.folgefahrtVerschoben */
export const GEWICHTE = {
  anfahrt: 1.0,
  verspaetung: 3.0,
  leerKm: 0.5,
  folgefahrtVerschoben: 2.0,
};

export const FOLGEFAHRT_STRAFPUNKTE = 10;

/** Minuten für den Einstieg, je nach Beförderungsart (docs/05-disposition.md). */
export const EINSTIEGSZEIT_MINUTEN: Record<TransportType, number> = {
  SITZEND: 5,
  ROLLSTUHL: 10,
  TRAGESTUHL: 10,
  LIEGEND: 15,
};

export const ANFAHRT_PUFFER_MINUTEN = 5;
export const TERMIN_PUFFER_MINUTEN = 5;
/** Mindestpuffer vor der nächsten Fahrt, der als "leicht verschoben" gilt (sonst "zerstört"). */
export const FOLGEFAHRT_MINDESTPUFFER_MINUTEN = 15;
