import { fahrzeugeLaden } from "./actions";
import { FahrzeugeClient } from "./FahrzeugeClient";

export default async function FahrzeugePage() {
  const fahrzeuge = await fahrzeugeLaden();
  return <FahrzeugeClient fahrzeuge={fahrzeuge} />;
}
