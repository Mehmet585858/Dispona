import { orteLaden } from "./actions";
import { OrteClient } from "./OrteClient";

export default async function OrtePage() {
  const orte = await orteLaden();
  return <OrteClient orte={orte} />;
}
