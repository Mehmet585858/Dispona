-- Prüfbericht S2-013: Telefonnummern von Fahrgästen einheitlich im Suchschlüssel-Format
-- (E.164-ähnlich) speichern. Dieselben Regeln wie telefonNormalisieren() in
-- src/core/passengers/suche.ts. Verändert nur die Schreibweise, löscht nichts; Einträge ohne
-- Ziffern fallen weg (waren nie als Nummer nutzbar).
CREATE OR REPLACE FUNCTION dispona_telefon_normalisieren(roh text) RETURNS text AS $$
DECLARE
  plus boolean := left(btrim(roh), 1) = '+';
  z text := regexp_replace(roh, '[^0-9]', '', 'g');
BEGIN
  IF z = '' THEN RETURN NULL; END IF;
  IF plus THEN
    z := '+' || z;
  ELSIF z LIKE '00%' THEN
    z := '+' || substr(z, 3);
  ELSIF z LIKE '0%' THEN
    z := '+49' || substr(z, 2);
  END IF;
  IF z LIKE '+490%' THEN
    z := '+49' || substr(z, 5);
  END IF;
  RETURN z;
END
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Passenger" p
SET phones = neu.liste
FROM (
  SELECT id,
         COALESCE(
           (SELECT array_agg(DISTINCT n) FROM unnest(phones) AS u(ph), LATERAL (SELECT dispona_telefon_normalisieren(ph) AS n) x WHERE n IS NOT NULL),
           '{}'::text[]
         ) AS liste
  FROM "Passenger"
) neu
WHERE p.id = neu.id AND p.phones IS DISTINCT FROM neu.liste;

DROP FUNCTION dispona_telefon_normalisieren(text);
