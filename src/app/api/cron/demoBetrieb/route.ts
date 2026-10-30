import { NextResponse, type NextRequest } from "next/server";
import { demoBetriebSimulieren } from "@/core/demo/betriebSimulieren";

// Jede Fahrzeug-Zuweisung/Status-Änderung braucht mehrere sequentielle Datenbank-Umläufe
// (Konfliktprüfung, Schicht-Suche, Update, Event, Push-Benachrichtigung) - bei viel nachzuholender
// Arbeit (z. B. nach einer Pause) reicht das Standard-Zeitlimit sonst nicht. betriebSimulieren.ts
// begrenzt die Arbeit pro Lauf zusätzlich selbst, dieses Limit ist nur die Sicherheitsmarge.
export const maxDuration = 60;

/** Für einen externen Scheduler (jede Minute, wie automodus.ts), gesichert mit CRON_SECRET - siehe
 * src/core/demo/betriebSimulieren.ts. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  await demoBetriebSimulieren();
  return NextResponse.json({ ok: true });
}
