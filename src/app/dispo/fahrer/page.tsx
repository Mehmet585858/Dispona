import { connection } from "next/server";
import { datumIso, wochenStart } from "@/core/shifts/week";
import { fahrerLaden, fahrzeugeFuerAuswahl, schichtenFuerWoche } from "./actions";
import { FahrerClient } from "./FahrerClient";

export default async function FahrerPage() {
  await connection(); // new Date() unten ist pro Aufruf unterschiedlich, siehe Next.js Proxy-Doku
  const montag = datumIso(wochenStart(new Date()));
  const [fahrer, fahrzeuge, schichten] = await Promise.all([
    fahrerLaden(),
    fahrzeugeFuerAuswahl(),
    schichtenFuerWoche(montag),
  ]);

  return (
    <FahrerClient
      fahrer={fahrer}
      fahrzeuge={fahrzeuge}
      anfangsSchichten={schichten}
      anfangsMontag={montag}
    />
  );
}
