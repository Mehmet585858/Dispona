import { requireSession } from "@/lib/session";
import { einstellungenLaden } from "./actions";
import { EinstellungenClient } from "./EinstellungenClient";

export default async function EinstellungenPage() {
  const [{ role }, einstellungen] = await Promise.all([requireSession(), einstellungenLaden()]);
  return <EinstellungenClient einstellungen={einstellungen} istAdmin={role === "ADMIN"} />;
}
