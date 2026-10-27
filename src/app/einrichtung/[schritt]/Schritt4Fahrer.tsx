import { datumIso, wochenStart } from "@/core/shifts/week";
import { fahrerLaden, fahrzeugeFuerAuswahl, schichtenFuerWoche } from "@/app/dispo/fahrer/actions";
import { FahrerClient } from "@/app/dispo/fahrer/FahrerClient";

export async function Schritt4Fahrer() {
  const montag = datumIso(wochenStart(new Date()));
  const [fahrer, fahrzeuge, schichten] = await Promise.all([
    fahrerLaden(),
    fahrzeugeFuerAuswahl(),
    schichtenFuerWoche(montag),
  ]);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        Laden Sie Ihre Fahrer ein (SMS/Link) und legen Sie direkt einen Schichtplan für diese Woche an.
      </p>
      <FahrerClient fahrer={fahrer} fahrzeuge={fahrzeuge} anfangsSchichten={schichten} anfangsMontag={montag} />
    </div>
  );
}
