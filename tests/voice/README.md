# tests/voice

20 Testgespräche für die KI am Telefon (docs/09-bauplan.md Phase 6, docs/04-voice-agent.md). Jede
Datei exportiert ein `Testgespraech` (Typ in `src/core/voice/testgespraech.ts`) mit den Zeilen des
Anrufers und dem erwarteten Ergebnis.

Ein Sprachmodell lässt sich nicht deterministisch automatisiert prüfen (`npm test` deckt das nicht
ab) – das sind Vorlagen für den manuellen Testlauf mit `npm run voice:sim`:

1. `npm run voice:sim` starten (braucht `ANTHROPIC_API_KEY` in `.env`, siehe `.env.example`).
2. Bei "Anrufernummer" die `anrufernummer` aus der Testgespräch-Datei eingeben (leer lassen, wenn
   keine angegeben ist).
3. Die `anrufer`-Zeilen der Reihe nach eintippen.
4. Mit dem `erwartetesErgebnis` vergleichen: Hat die KI die richtigen Werkzeuge mit plausiblen
   Angaben aufgerufen? Das Terminal zeigt jeden Werkzeugaufruf und sein Ergebnis mit an.
5. Mit `/dispo/anrufe` im Browser nachprüfen: Call-Eintrag, Zusammenfassung, verknüpfte Fahrt.

| Datei | Kategorie |
| --- | --- |
| 01–05 | normaler Fall |
| 06–07 | Angehörige ruft an |
| 08–09 | Praxis/Klinik ruft an |
| 10–11 | Adresse unklar |
| 12–13 | Notfall |
| 14–15 | Absage |
| 16–17 | Auskunft |
| 18–19 | Anrufer will Menschen |
| 20 | Dialekt/undeutliche Zahlen |
