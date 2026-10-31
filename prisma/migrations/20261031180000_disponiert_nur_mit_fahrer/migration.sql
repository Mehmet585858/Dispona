-- Maßnahme M-72 (Prüfbericht Durchgang 4, S1-008): Eine Fahrt im Status DISPONIERT hat immer ein
-- Fahrzeug UND einen Fahrer.
--
-- Die Anwendung (src/core/disposition/zuweisen.ts) weist nur noch zu, wenn für das Fahrzeug zur
-- Abholzeit ein einsatzfähiger Fahrer eingeteilt ist. Dieser Trigger sichert die Folge davon in der
-- Datenbank selbst ab – auch für den rohen Prisma-Client, Skripte und jeden künftigen Codepfad:
-- Es gibt keine DISPONIERT-Zeile ohne "vehicleId" und "driverId". Eine Fahrt, die ihren Fahrer
-- verliert (Ausfall, Umplanung), muss DISPONIERT zuerst verlassen (ERFASST/PROBLEM) – genau so
-- arbeiten fahrzeugZuweisungAufheben, fahrerFaelltAusKern und fahrtAendern.
--
-- Fehler: SQLSTATE 23514 (check_violation), Text beginnt mit DISPONIERT_OHNE_FAHRER, enthält nur
-- die Fahrt-ID (keine Gesundheitsdaten).
--
-- Bestandsdaten: Es wird nichts umgeschrieben. Der Trigger feuert bei UPDATE nur, wenn sich
-- status, vehicleId oder driverId ändern – eine (nicht erwartete) alte DISPONIERT-Zeile ohne Fahrer
-- kann weiterhin jeden anderen Status annehmen. Am Ende meldet die Migration per NOTICE, ob es
-- solche Zeilen gibt (nur Anzahl); sie sollten im Büro neu zugewiesen werden.
--
-- Prisma bildet Trigger und Funktionen nicht im Schema ab; `prisma migrate diff` bleibt leer.
-- Achtung: `prisma db push` (Workaround aus CLAUDE.md) installiert diesen Trigger NICHT – danach
-- `prisma migrate resolve --applied` plus das SQL hier von Hand ausführen.

CREATE OR REPLACE FUNCTION dispona_disponiert_mit_fahrer_pruefen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'DISPONIERT' AND (NEW."vehicleId" IS NULL OR NEW."driverId" IS NULL) THEN
    RAISE EXCEPTION 'DISPONIERT_OHNE_FAHRER Ride % ist disponiert, aber ohne Fahrzeug oder Fahrer', NEW.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Ride_disponiert_mit_fahrer"
  BEFORE INSERT OR UPDATE OF "status", "vehicleId", "driverId"
  ON "Ride" FOR EACH ROW
  EXECUTE FUNCTION dispona_disponiert_mit_fahrer_pruefen();

-- Bestandsprüfung (nur Anzahl, keine Inhalte).
DO $$
DECLARE
  anzahl integer;
BEGIN
  SELECT count(*) INTO anzahl
  FROM "Ride"
  WHERE status = 'DISPONIERT' AND ("vehicleId" IS NULL OR "driverId" IS NULL);
  IF anzahl > 0 THEN
    RAISE NOTICE 'M-72: % Bestandsfahrt(en) stehen auf DISPONIERT ohne Fahrzeug oder Fahrer – bitte im Büro neu zuweisen.', anzahl;
  END IF;
END;
$$;
