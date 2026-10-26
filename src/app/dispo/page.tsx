import { dashboardLaden } from "./actions";
import { DispoClient } from "./DispoClient";

export default async function DispoPage() {
  const daten = await dashboardLaden();
  return (
    <DispoClient
      kennzahlen={daten.kennzahlen}
      bitteBestaetigen={daten.bitteBestaetigen}
      tagesplan={daten.tagesplan}
      alarme={daten.alarme}
      fahrzeuge={daten.fahrzeuge}
      serviceArea={daten.serviceArea}
    />
  );
}
