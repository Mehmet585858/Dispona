import type { Metadata } from "next";
import { liveMediwayLaden } from "./actions";
import { LiveMediwayClient } from "./LiveMediwayClient";

// Öffentlich, nur für den Live-Testanruf mit Mediway Krankenfahrdienst (Live Test) - wie /live,
// siehe dort für die Begründung von force-dynamic.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mediway Live-Test",
  description: "Live-Ansicht für den Vapi-Testanruf bei Mediway Krankenfahrdienst (Live Test).",
};

export default async function LiveMediwayPage() {
  const daten = await liveMediwayLaden();
  return <LiveMediwayClient initialDaten={daten} />;
}
