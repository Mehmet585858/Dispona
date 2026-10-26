import { fahrgaesteLaden } from "./actions";
import { FahrgaesteClient } from "./FahrgaesteClient";

export default async function FahrgaestePage() {
  const fahrgaeste = await fahrgaesteLaden();
  return <FahrgaesteClient fahrgaeste={fahrgaeste} />;
}
