import { requireSession } from "@/lib/session";
import { einstellungenLaden, exportVorlageLaden } from "./actions";
import { EinstellungenClient } from "./EinstellungenClient";

export default async function EinstellungenPage() {
  const [{ role }, einstellungen, exportSpalten] = await Promise.all([
    requireSession(),
    einstellungenLaden(),
    exportVorlageLaden(),
  ]);
  return (
    <EinstellungenClient
      einstellungen={einstellungen}
      datenschutzEinstellungen={einstellungen}
      istAdmin={role === "ADMIN"}
      exportSpalten={exportSpalten}
    />
  );
}
