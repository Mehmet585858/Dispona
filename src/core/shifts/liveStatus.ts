/**
 * Live-Status eines Fahrzeugs für die Fahrzeugspalte im Zeitstrahl (DISPO-SPEZ.md Abschnitt 3.3):
 * aus dem Status der heutigen Fahrten abgeleitet, nicht aus GPS-Position – der Fahrer setzt den
 * Status selbst in der Fahrer-App (Fahre los → Fahrgast im Auto → Am Ziel).
 */
function uhrzeit(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

export type FahrtFuerLiveStatus = {
  status: string;
  pickupAt: Date;
  geplantesEnde: Date;
  completedAt: Date | null;
  driverDelayMin: number | null;
  passagierName: string;
};

export type FahrzeugLiveStatus = {
  punkt: "go" | "in" | "at" | "free" | "late";
  label: string;
  zusatz: string;
};

const AM_ZIEL_SICHTBAR_MINUTEN = 60;

/**
 * oeffentlich=true (öffentliche Live-Demo, kein Login, siehe src/app/live/actions.ts) lässt den
 * Fahrgastnamen aus "zusatz" weg - der einzige der vier Zustände, dessen Text sonst einen echten
 * Namen enthält. Statt den fertigen Text danach wieder zu zerlegen, wird er hier schon ohne Namen
 * gebaut - die anderen Zustände (Ankunftszeit, Verspätung, "am Betriebshof") enthalten ohnehin nie
 * einen Namen und bleiben unverändert.
 */
export function fahrzeugLiveStatus(
  fahrtenHeute: FahrtFuerLiveStatus[],
  jetzt: Date,
  oeffentlich = false,
): FahrzeugLiveStatus {
  const anBord = fahrtenHeute.find((f) => f.status === "AN_BORD");
  if (anBord) {
    return { punkt: "in", label: "Fahrgast im Auto", zusatz: `Ankunft ${uhrzeit(anBord.geplantesEnde)}` };
  }

  const unterwegs = fahrtenHeute.find((f) => f.status === "UNTERWEGS");
  if (unterwegs) {
    const verspaetungMin = unterwegs.driverDelayMin ?? 0;
    if (verspaetungMin > 0) {
      return { punkt: "late", label: "Fährt zum Fahrgast", zusatz: `+${verspaetungMin} Min.` };
    }
    const zeit = uhrzeit(unterwegs.pickupAt);
    return {
      punkt: "go",
      label: "Fährt zum Fahrgast",
      zusatz: oeffentlich ? zeit : `${unterwegs.passagierName}, ${zeit}`,
    };
  }

  const amZiel = [...fahrtenHeute]
    .filter((f) => f.status === "ERLEDIGT" && f.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
  if (amZiel && jetzt.getTime() - amZiel.completedAt!.getTime() < AM_ZIEL_SICHTBAR_MINUTEN * 60_000) {
    return { punkt: "at", label: "Fahrgast am Ziel", zusatz: `seit ${uhrzeit(amZiel.completedAt!)}` };
  }

  return { punkt: "free", label: "Frei", zusatz: "am Betriebshof" };
}
