-- Maßnahme M-21 (Prüfbericht S2-013, V-006) für Fahrerkonten: User.phone einheitlich im
-- Suchschlüssel-Format (+49…), dieselben Regeln wie telefonNormalisieren() in
-- src/core/passengers/suche.ts und wie die Migration 20261031090000 für Fahrgäste. Die technische
-- Anmelde-E-Mail der Fahrer (fahrer-<ziffern>@fahrer.intern) wird aus derselben normalisierten
-- Nummer gebildet, damit eine erneute Einladung derselben Nummer in anderer Schreibweise als
-- Dublette erkannt wird. Nur Fahrerkonten mit technischer E-Mail; Sitzungen hängen an der
-- Nutzer-ID und bleiben gültig. Kollidieren zwei Konten (gleiche Nummer, verschiedene
-- Schreibweise), bricht die Migration an der Eindeutigkeit der E-Mail ab – das ist gewollt, dann
-- muss das Büro eines der beiden Konten vorher bereinigen.
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

UPDATE "user" u
SET phone = dispona_telefon_normalisieren(u.phone),
    email = CASE
      WHEN u.email LIKE 'fahrer-%@fahrer.intern'
        THEN 'fahrer-' || regexp_replace(dispona_telefon_normalisieren(u.phone), '[^0-9]', '', 'g') || '@fahrer.intern'
      ELSE u.email
    END
WHERE u.role = 'FAHRER'
  AND u.phone IS NOT NULL
  AND dispona_telefon_normalisieren(u.phone) IS NOT NULL
  AND (
    u.phone IS DISTINCT FROM dispona_telefon_normalisieren(u.phone)
    OR (u.email LIKE 'fahrer-%@fahrer.intern'
        AND u.email IS DISTINCT FROM 'fahrer-' || regexp_replace(dispona_telefon_normalisieren(u.phone), '[^0-9]', '', 'g') || '@fahrer.intern')
  );

DROP FUNCTION dispona_telefon_normalisieren(text);
