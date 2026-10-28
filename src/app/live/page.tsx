import type { Metadata } from "next";
import { liveDemoLaden } from "./actions";
import { LiveClient } from "./LiveClient";

// Öffentlich erreichbar, bewusst nicht unter /dispo (src/proxy.ts verlangt dort eine Anmeldung) -
// siehe src/app/live/actions.ts für die Absicherung auf den Demo-Mandanten.
//
// force-dynamic ist Pflicht: ohne requireSession()/cookies() gäbe es sonst kein Signal für
// Next.js, die Seite nicht beim Build einmalig statisch zu rendern - sie würde dann für immer den
// Datenstand vom letzten Deploy zeigen statt live zu aktualisieren.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dispona live erleben",
  description: "Rufen Sie die Demo-Nummer an und sehen Sie in Echtzeit, wie Dispona Ihre Fahrt einplant.",
};

export default async function LivePage() {
  const daten = await liveDemoLaden();
  return <LiveClient initialDaten={daten} />;
}
