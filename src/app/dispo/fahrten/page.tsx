import { datumIso } from "@/core/shifts/week";
import { fahrzeugeFuerAuswahl } from "../fahrer/actions";
import { fahrplanLaden, orteFuerAuswahl } from "./actions";
import { FahrtenClient } from "./FahrtenClient";

export default async function FahrtenPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; ansicht?: string }>;
}) {
  const { datum: datumParam, ansicht: ansichtParam } = await searchParams;
  const datum = datumParam ?? datumIso(new Date());
  const ansicht = ansichtParam === "woche" ? "woche" : "tag";

  const [fahrplan, orte, fahrzeuge] = await Promise.all([
    fahrplanLaden(datum, ansicht),
    orteFuerAuswahl(),
    fahrzeugeFuerAuswahl(),
  ]);

  return (
    <FahrtenClient
      fahrten={fahrplan.fahrten}
      fahrer={fahrplan.fahrer}
      fahrzeugZeilen={fahrplan.fahrzeugZeilen}
      karte={fahrplan.karte}
      orte={orte}
      fahrzeuge={fahrzeuge}
      datum={datum}
      ansicht={ansicht}
    />
  );
}
