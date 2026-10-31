import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { demoBetriebSimulieren } from "@/core/demo/betriebSimulieren";

// Jede Fahrzeug-Zuweisung/Status-Änderung braucht mehrere sequentielle Datenbank-Umläufe
// (Konfliktprüfung, Schicht-Suche, Update, Event, Push-Benachrichtigung) - bei viel nachzuholender
// Arbeit (z. B. nach einer Pause) reicht das Standard-Zeitlimit sonst nicht. betriebSimulieren.ts
// begrenzt die Arbeit pro Lauf zusätzlich selbst, dieses Limit ist nur die Sicherheitsmarge.
export const maxDuration = 60;

/** Für einen externen Scheduler (jede Minute, wie automodus.ts), gesichert mit CRON_SECRET - siehe
 * src/core/demo/betriebSimulieren.ts. */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  await demoBetriebSimulieren();
  return NextResponse.json({ ok: true });
}
