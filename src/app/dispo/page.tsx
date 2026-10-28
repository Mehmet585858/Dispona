import { datumIso } from "@/core/shifts/week";
import { fahrzeugeFuerAuswahl } from "./fahrer/actions";
import { fahrplanLaden, orteFuerAuswahl } from "./fahrten/actions";
import { dashboardLaden } from "./actions";
import { DispoClient } from "./DispoClient";

export default async function DispoPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; ansicht?: string }>;
}) {
  const { datum: datumParam, ansicht: ansichtParam } = await searchParams;
  const datum = datumParam ?? datumIso(new Date());
  const ansicht = ansichtParam === "woche" ? "woche" : "tag";

  const [dashboard, fahrplan, orte, fahrzeuge] = await Promise.all([
    dashboardLaden(),
    fahrplanLaden(datum, ansicht),
    orteFuerAuswahl(),
    fahrzeugeFuerAuswahl(),
  ]);

  return (
    <DispoClient
      kennzahlen={dashboard.kennzahlen}
      alarme={dashboard.alarme}
      automodusText={dashboard.automodusText}
      heuteNacht={dashboard.heuteNacht}
      planFuerMorgen={dashboard.planFuerMorgen}
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
