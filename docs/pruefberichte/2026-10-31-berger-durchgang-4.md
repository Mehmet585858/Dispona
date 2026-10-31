# Prüfbericht Dispona – Durchgang 4 – 31.10.2026 – Prüfer: K. Berger

Geprüft wurde der Branch `origin/claude/behebung-durchgang-2` (Stand `aa4e6e7`) in einer eigenen Arbeitskopie `/tmp/pruef4` mit eigener Postgres-16-Instanz. Beides ist nach der Prüfung wieder gelöscht.

**Zum Ablageort:** Die Datei unter `docs/pruefberichte/` hat Berger nicht selbst angelegt. Seine Rolle verbietet Änderungen am Repository, und seine Arbeitsanweisung untersagt Berichtsdateien. Der Bericht wurde vollständig als Text übergeben. Diese Datei wurde von M. Reiter (Projektleitung) gemäß Bergers eigenem Ablage-Vorschlag angelegt: `docs/pruefberichte/2026-10-31-berger-durchgang-4.md`.

**Hinweis zum Hauptverzeichnis (von Berger):** `/home/user/Dispona` wurde während seiner Prüfung von einem anderen Vorgang auf den Branch `claude/behebung-pilot-blocker` umgeschaltet und enthielt dort nicht festgeschriebene Änderungen. Diese stammen nicht von Berger. Von ihm kamen dort nur `git fetch` und das Anlegen und Entfernen der Arbeitskopie.

## Urteil in einem Satz

Pilotstart weiterhin **nein**. Die 23 Maßnahmen sind überwiegend so umgesetzt wie beschrieben, alle 398 Tests laufen sauber durch. Zwei neue Wege, auf denen Fahrten verloren gehen, sind aber über die normale Oberfläche erreichbar:
- Eine Fahrt lässt sich manuell einem Fahrzeug ohne Schicht oder einem ausgefallenen bzw. deaktivierten Fahrer geben. Sie steht dann als „disponiert" da, ohne dass ein Alarm kommt.
- Wer eine Serienpause verkürzt oder eine Serienänderung zurücknimmt, verliert die betroffenen Dialysetermine still und dauerhaft.

## Zahlen

S1: 2 | S2: 5 | S3: 5 | S4: 4 | Verdachte: 4 (V-017 bis V-020)
Geprüfte Dateien: ca. 65 | Ausgeführte Tests/Befehle: ca. 110
- Gesamtlauf: 398/398 grün, dazu 3 Läufe in gemischter Reihenfolge (Seeds 11/7/99) ebenfalls 398/398. Lint 0 Fehler, Typecheck grün.
- 25 Einzel-Nachprüfläufe aus der Tabelle des Protokolls, M-04 dreimal.
- 4 eigene Prüfdateien mit 22 Testfällen gegen Postgres, alle Testdaten mit PRUEF_ gekennzeichnet.
- 3 Builds, `next start` unter TZ=UTC, ca. 20 curl-Aufrufe (Webhook, Cron, Server Action), ca. 15 psql-Abfragen.

## Die drei gefährlichsten Befunde

1. **„Zuweisen" nimmt jedes Fahrzeug, auch ohne Fahrer (S1-008).** Der Disponent wählt im Fahrt-Fenster ein Fahrzeug, für das gerade keine Schicht läuft. Die Fahrt steht dann auf „disponiert", hat aber keinen Fahrer. Es gibt keine Push, keine Bestätigungs-SMS, keinen Kein-Fahrzeug-Alarm, und in „Braucht Sie" erscheint sie auch nicht. Wählt er das Fahrzeug eines Fahrers, der „Ich falle aus" gedrückt hat oder deaktiviert wurde, geht die Fahrt genau an diesen Fahrer zurück.
2. **Verkürzte Serienpause = verlorene Dialysetermine (S1-009).** Der Patient kommt früher aus dem Krankenhaus, das Büro trägt die Pause kürzer ein. Die schon stornierten Tage werden nie wieder angelegt. Dasselbe gilt für „Wochentage ändern und zurück" und für „versehentlich beendet, Enddatum wieder verlängert". Die KI kann eine Serie am Telefon beenden. Rückgängig machen geht nicht.
3. **Patientennamen auf dem Sperrbildschirm des Fahrers und am Telefon (S2-025, S2-026).** Heißt ein Ort „Wohnung Müller" oder „Müller, Hans", steht „Wohnung Müller" bzw. „Müller" in Push und SMS. Am Telefon bekommt ein unbekannter Anrufer, der „Hauptstraße 5" oder „Wohnung Müller" sagt, Bezeichnung und volle Adresse vorgelesen.

## Vollständigkeit dieses Berichts

Dieser Bericht enthält die Kurzfassung, wie Berger sie im Prüfauftrag übergeben hat: Urteil, Zahlen und die drei gefährlichsten Befunde im Volltext, sowie die weiteren Befund-Kennungen, die im Auftrag an die Projektleitung namentlich genannt wurden (siehe `docs/pruefberichte/2026-10-30-massnahmenliste.md`, Maßnahmen M-72 ff.).

**Der vollständige Bericht mit allen Einzelbefunden (S2-027 bis S2-029, S3-034 bis S3-038, S4-020 bis S4-023), der Nachprüfungstabelle M-01 bis M-23, der Zusatzprüfung 1 (Status der alten Befunde M-46 bis M-65 auf dem Branch) und den Verdachten V-017 bis V-020 im Volltext (Fundorte, Beweise, Reproduktionsschritte) liegt nur im Chat-Verlauf der auftraggebenden Sitzung vor und ist hier nicht abgelegt. Bei Bedarf dort erneut anfordern.** Die Maßnahmenliste wurde auf Basis der hier vorliegenden Kurzfassung und der im Auftrag namentlich genannten Befund-IDs mit Kurztitel aktualisiert; bei den nicht im Detail vorliegenden Befunden ist dort vermerkt, dass die Einzelheiten nachzutragen sind, sobald der Volltext vorliegt.
