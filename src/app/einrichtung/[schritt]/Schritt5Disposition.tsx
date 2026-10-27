import { einstellungenLaden, exportVorlageLaden } from "@/app/dispo/einstellungen/actions";
import { EinstellungenClient } from "@/app/dispo/einstellungen/EinstellungenClient";

export async function Schritt5Disposition() {
  const [einstellungen, exportSpalten] = await Promise.all([einstellungenLaden(), exportVorlageLaden()]);
  return <EinstellungenClient einstellungen={einstellungen} istAdmin exportSpalten={exportSpalten} />;
}
