import { datumIso } from "@/core/shifts/week";
import { fahrzeugeFuerAuswahl } from "../fahrer/actions";
import { fahrtenLaden, orteFuerAuswahl } from "./actions";
import { FahrtenClient } from "./FahrtenClient";

export default async function FahrtenPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string }>;
}) {
  const { datum: datumParam } = await searchParams;
  const datum = datumParam ?? datumIso(new Date());

  const [fahrten, orte, fahrzeuge] = await Promise.all([
    fahrtenLaden(datum),
    orteFuerAuswahl(),
    fahrzeugeFuerAuswahl(),
  ]);

  return <FahrtenClient fahrten={fahrten} orte={orte} fahrzeuge={fahrzeuge} datum={datum} />;
}
