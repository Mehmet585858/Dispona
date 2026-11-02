import { requireBueroSession } from "@/lib/session";
import { fahrerLaden } from "./actions";
import { FahrerClient } from "./FahrerClient";

/** Personal (Fahrer und Aushilfen). Schichten plant /dispo/schichtplan. */
export default async function FahrerPage() {
  const [{ role }, fahrer] = await Promise.all([requireBueroSession(), fahrerLaden()]);
  return <FahrerClient fahrer={fahrer} istAdmin={role === "ADMIN"} />;
}
