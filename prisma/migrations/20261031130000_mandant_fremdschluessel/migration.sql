-- Maßnahme M-11 (Prüfbericht S2-008): Fremdschlüssel dürfen nur auf Zeilen DESSELBEN Mandanten zeigen.
--
-- withTenant() filtert nur die Zieltabelle. Ein Fremdschlüssel in `data` (Fahrgast, Ort, Fahrer,
-- Fahrzeug, …) wurde nur geprüft, wo ein Aufrufer referenzenPruefen() aufrief – ein neuer Codepfad
-- hätte die Lücke wieder geöffnet. Diese Trigger prüfen jeden INSERT/UPDATE der betroffenen Spalten
-- in der Datenbank selbst: auch innerhalb von Transaktionen (dort sieht eine Prüfung über einen
-- zweiten Client gerade angelegte Zeilen nicht) und auch für den rohen Prisma-Client.
--
-- Regel: Existiert die referenzierte Zeile und gehört sie einem ANDEREN Mandanten → Fehler
-- (SQLSTATE 23503, Text beginnt mit FREMDE_REFERENZ). Fehlende Zeilen sind Sache der normalen
-- Fremdschlüssel (wo vorhanden); dieser Trigger ändert daran nichts.
--
-- Bestandsdaten: Es wird nichts umgeschrieben. Die Trigger feuern bei UPDATE nur, wenn sich
-- tenantId oder eine der geprüften Spalten ändert – eine (nicht erwartete) alte Fremdreferenz
-- blockiert also keine Statuswechsel. Am Ende meldet die Migration per NOTICE, ob es solche
-- Bestandszeilen gibt (nur Anzahl, keine Inhalte).
--
-- Prisma bildet Trigger und Funktionen nicht im Schema ab; `prisma migrate diff` bleibt leer.

CREATE OR REPLACE FUNCTION dispona_mandant_referenzen_pruefen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  i integer := 0;
  spalte text;
  tabelle text;
  wert text;
  fremder_mandant text;
  zeile jsonb := to_jsonb(NEW);
BEGIN
  -- TG_ARGV: Paare aus Spaltenname und referenzierter Tabelle.
  WHILE i < TG_NARGS LOOP
    spalte := TG_ARGV[i];
    tabelle := TG_ARGV[i + 1];
    wert := zeile ->> spalte;
    IF wert IS NOT NULL THEN
      EXECUTE format('SELECT "tenantId" FROM %I WHERE id = $1', tabelle) INTO fremder_mandant USING wert;
      IF fremder_mandant IS NOT NULL AND fremder_mandant <> NEW."tenantId" THEN
        RAISE EXCEPTION 'FREMDE_REFERENZ %.% gehört zu einem anderen Mandanten', TG_TABLE_NAME, spalte
          USING ERRCODE = '23503';
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Ride_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "passengerId", "pickupPlaceId", "dropoffPlaceId", "vehicleId", "seriesId", "returnOfId", "callId", "driverId"
  ON "Ride" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen(
    'passengerId', 'Passenger', 'pickupPlaceId', 'Place', 'dropoffPlaceId', 'Place', 'vehicleId', 'Vehicle',
    'seriesId', 'RideSeries', 'returnOfId', 'Ride', 'callId', 'Call', 'driverId', 'Driver');

CREATE TRIGGER "Shift_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "driverId", "vehicleId"
  ON "Shift" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('driverId', 'Driver', 'vehicleId', 'Vehicle');

CREATE TRIGGER "VehicleLocation_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "vehicleId"
  ON "VehicleLocation" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('vehicleId', 'Vehicle');

CREATE TRIGGER "PushSubscription_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "driverId"
  ON "PushSubscription" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('driverId', 'Driver');

CREATE TRIGGER "Driver_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "userId"
  ON "Driver" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('userId', 'user');

CREATE TRIGGER "Passenger_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "homePlaceId"
  ON "Passenger" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('homePlaceId', 'Place');

CREATE TRIGGER "Approval_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "passengerId"
  ON "Approval" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('passengerId', 'Passenger');

CREATE TRIGGER "RideStatusEvent_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "rideId", "byUserId"
  ON "RideStatusEvent" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('rideId', 'Ride', 'byUserId', 'user');

CREATE TRIGGER "RideSeries_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "passengerId"
  ON "RideSeries" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('passengerId', 'Passenger');

CREATE TRIGGER "Suggestion_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "rideId", "chosenVehicleId", "decidedByUserId"
  ON "Suggestion" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('rideId', 'Ride', 'chosenVehicleId', 'Vehicle', 'decidedByUserId', 'user');

CREATE TRIGGER "VoiceToolCall_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "callId"
  ON "VoiceToolCall" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('callId', 'Call');

CREATE TRIGGER "Notification_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "rideId"
  ON "Notification" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('rideId', 'Ride');

CREATE TRIGGER "AuditLog_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "userId"
  ON "AuditLog" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('userId', 'user');

-- Bestandsprüfung (nur Anzahl, keine Inhalte): Fahrten mit Fahrgast oder Ort eines anderen Mandanten.
DO $$
DECLARE
  anzahl integer;
BEGIN
  SELECT count(*) INTO anzahl
  FROM "Ride" r
  LEFT JOIN "Passenger" p ON p.id = r."passengerId"
  LEFT JOIN "Place" a ON a.id = r."pickupPlaceId"
  LEFT JOIN "Place" z ON z.id = r."dropoffPlaceId"
  WHERE p."tenantId" <> r."tenantId" OR a."tenantId" <> r."tenantId" OR z."tenantId" <> r."tenantId";
  IF anzahl > 0 THEN
    RAISE NOTICE 'M-11: % Bestandsfahrt(en) mit Fahrgast/Ort eines anderen Mandanten gefunden – bitte prüfen.', anzahl;
  END IF;
END;
$$;
