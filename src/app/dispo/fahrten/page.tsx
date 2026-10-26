import { datumIso } from "@/core/shifts/week";
import { fahrzeugeFuerAuswahl } from "../fahrer/actions";
import { fahrtenFuerWocheLaden, fahrtenLaden, orteFuerAuswahl } from "./actions";
import { FahrtenClient } from "./FahrtenClient";

export default async function FahrtenPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; ansicht?: string }>;
}) {
  const { datum: datumParam, ansicht: ansichtParam } = await searchParams;
  const datum = datumParam ?? datumIso(new Date());
  const ansicht = ansichtParam === "woche" ? "woche" : "tag";

  const [fahrten, orte, fahrzeuge] = await Promise.all([
    ansicht === "woche" ? fahrtenFuerWocheLaden(datum) : fahrtenLaden(datum),
    orteFuerAuswahl(),
    fahrzeugeFuerAuswahl(),
  ]);

  return <FahrtenClient fahrten={fahrten} orte={orte} fahrzeuge={fahrzeuge} datum={datum} ansicht={ansicht} />;
}
