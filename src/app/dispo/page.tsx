import { datumIso } from "@/core/shifts/week";
import { fahrzeugeFuerAuswahl } from "./fahrer/actions";
import { fahrplanLaden, orteFuerAuswahl } from "./fahrten/actions";
import { DispoClient } from "./DispoClient";

export default async function DispoPage({
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
    <DispoClient
      paket={fahrplan.paket}
      automodusText={fahrplan.automodusText}
      kennzahlen={fahrplan.kennzahlen}
      brauchtSie={fahrplan.brauchtSie}
      liveAnrufe={fahrplan.liveAnrufe}
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
