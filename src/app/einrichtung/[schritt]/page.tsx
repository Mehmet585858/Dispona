import { notFound } from "next/navigation";
import { istGueltigerSchritt } from "@/core/einrichtung/schritte";
import { einrichtungLaden, fahrerFuerTestanrufLaden, type AiZeitplanModus } from "./actions";
import { EinrichtungLayout } from "./EinrichtungLayout";
import { Schritt1Firma } from "./Schritt1Firma";
import { Schritt2Telefon } from "./Schritt2Telefon";
import { Schritt3Fahrzeuge } from "./Schritt3Fahrzeuge";
import { Schritt4Fahrer } from "./Schritt4Fahrer";
import { Schritt5Disposition } from "./Schritt5Disposition";
import { Schritt6Ki } from "./Schritt6Ki";
import { Schritt7Testanruf } from "./Schritt7Testanruf";
import { Schritt8LiveSchalten } from "./Schritt8LiveSchalten";

function oeffnungszeitTeile(openingHours: unknown): { von: string; bis: string } {
  const bereich = (openingHours as Record<string, string> | null)?.["mo-fr"] ?? "07:00-18:00";
  const [von, bis] = bereich.split("-");
  return { von: von ?? "07:00", bis: bis ?? "18:00" };
}

export default async function EinrichtungSchrittPage({ params }: { params: Promise<{ schritt: string }> }) {
  const { schritt: schrittParam } = await params;
  const schritt = Number(schrittParam);
  if (!istGueltigerSchritt(schritt)) notFound();

  const { tenant, settings, telefonnummer } = await einrichtungLaden();
  const { von: oeffnungszeitVon, bis: oeffnungszeitBis } = oeffnungszeitTeile(settings.openingHours);

  let inhalt: React.ReactNode;
  switch (schritt) {
    case 1:
      inhalt = (
        <Schritt1Firma
          initial={{
            name: tenant.name,
            street: tenant.street ?? "",
            zip: tenant.zip ?? "",
            city: tenant.city ?? "",
            depotAddress: settings.depotAddress as { street: string; zip: string; city: string; lat: number; lng: number } | null,
            serviceAreaCenter: settings.serviceAreaCenter as { lat: number; lng: number },
            serviceAreaKm: settings.serviceAreaKm,
            oeffnungszeitVon,
            oeffnungszeitBis,
          }}
        />
      );
      break;
    case 2:
      inhalt = <Schritt2Telefon kiNummer={telefonnummer?.e164 ?? null} escalationNumber={settings.escalationNumber} />;
      break;
    case 3:
      inhalt = await Schritt3Fahrzeuge();
      break;
    case 4:
      inhalt = await Schritt4Fahrer();
      break;
    case 5:
      inhalt = await Schritt5Disposition();
      break;
    case 6:
      inhalt = (
        <Schritt6Ki initial={{ voiceId: settings.voiceId, greeting: settings.greeting, escalationNumber: settings.escalationNumber }} />
      );
      break;
    case 7: {
      const fahrer = await fahrerFuerTestanrufLaden();
      inhalt = <Schritt7Testanruf kiNummer={telefonnummer?.e164 ?? null} fahrer={fahrer} />;
      break;
    }
    case 8: {
      const schedule = settings.aiSchedule as { modus?: AiZeitplanModus } | null;
      const aktuellerModus: AiZeitplanModus = settings.aiActive ? (schedule?.modus ?? "IMMER") : "AUS";
      inhalt = <Schritt8LiveSchalten aktuellerModus={aktuellerModus} />;
      break;
    }
    default:
      notFound();
  }

  return (
    <EinrichtungLayout schritt={schritt} erledigtBis={Math.max(tenant.setupStep, schritt)} firmenname={tenant.name}>
      {inhalt}
    </EinrichtungLayout>
  );
}
