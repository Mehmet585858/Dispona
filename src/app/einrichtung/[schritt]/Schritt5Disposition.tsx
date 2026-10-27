import { einstellungenLaden } from "@/app/dispo/einstellungen/actions";
import { EinstellungenClient } from "@/app/dispo/einstellungen/EinstellungenClient";

export async function Schritt5Disposition() {
  const einstellungen = await einstellungenLaden();
  return <EinstellungenClient einstellungen={einstellungen} istAdmin />;
}
