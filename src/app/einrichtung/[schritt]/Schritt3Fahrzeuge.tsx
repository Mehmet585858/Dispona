import { fahrzeugeLaden } from "@/app/dispo/fahrzeuge/actions";
import { FahrzeugeClient } from "@/app/dispo/fahrzeuge/FahrzeugeClient";

export async function Schritt3Fahrzeuge() {
  const fahrzeuge = await fahrzeugeLaden();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        Tragen Sie mindestens ein Fahrzeug ein – einzeln oder als Liste (CSV-Import).
      </p>
      <FahrzeugeClient fahrzeuge={fahrzeuge} />
    </div>
  );
}
