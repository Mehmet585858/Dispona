# Fahrdienst-KI – Bau-Paket für Claude Code

Dieses Paket enthält alles, damit Claude Code die Software Schritt für Schritt baut:
KI am Telefon, eigene Disposition mit Automodus und eigene Fahrer-App.
Du musst nicht programmieren können: Du gibst Claude Code die Aufträge aus
`docs/09-bauplan.md` der Reihe nach, prüfst das Ergebnis und gibst den nächsten.

## Was im Paket steckt

| Datei | Inhalt |
| --- | --- |
| `CLAUDE.md` | Projektregeln, liest Claude Code automatisch bei jedem Start |
| `docs/01-produkt.md` | Was das Produkt kann und was nicht |
| `docs/02-architektur.md` | Aufbau, Ablauf einer Bestellung, Fahrer-Benachrichtigung |
| `docs/03-datenmodell.md` | Alle Datenbank-Tabellen |
| `docs/04-voice-agent.md` | Gesprächsablauf, Anweisungen für die KI-Stimme, Werkzeuge |
| `docs/05-disposition.md` | Fahrzeugwahl, Bestätigen, Automodus, Plan für morgen |
| `docs/06-oberflaeche.md` | Bildschirme, Farben, Schrift, Bedienregeln |
| `docs/07-adapter.md` | Export für die Abrechnung; spätere Anbindung (DMRZ u. a.) |
| `docs/08-datenschutz-sicherheit.md` | DSGVO, Hosting, Sicherheit |
| `docs/09-bauplan.md` | 13 Bauphasen mit fertigen Aufträgen zum Einfügen |
| `docs/10-browser-erweiterung.md` | zurückgestellt: Idee für Kunden, die in DMRZ disponieren wollen |

## So startest du

1. **Claude Code installieren.** Anleitung: https://docs.claude.com (Bereich Claude Code). Du brauchst ein Claude-Abo mit Claude Code oder einen API-Zugang.
2. **Node.js installieren** (Version 20 oder neuer) von https://nodejs.org.
3. **Ordner anlegen**, z. B. `Dokumente/fahrdienst-ki`, und den Inhalt dieses Pakets hineinkopieren.
4. **Terminal öffnen** in diesem Ordner und `claude` eingeben.
5. **Ersten Auftrag einfügen:** Phase 0 aus `docs/09-bauplan.md` kopieren und abschicken.
6. Nach jeder Phase: ausprobieren wie in „So prüfst du“ beschrieben. Passt es, nächste Phase. Passt es nicht, Claude Code sagen, was nicht stimmt.

## Tipps

- Arbeite eine Phase nach der anderen ab, nie mehrere auf einmal.
- Starte für jede Phase eine neue Sitzung in Claude Code (`/clear`).
- Speichere nach jeder fertigen Phase einen Stand mit Git („Speichere den Stand als Phase X fertig“).
- Für Phase 5 (SMS), Phase 6 (Telefon) und Phase 12 (Server) brauchst du Konten bei externen Diensten; Claude Code sagt dir vorher, welche und was sie kosten.
- Sammle beim Pilot-Fahrdienst früh: Fahrzeuge mit Ausstattung, Fahrer mit Handynummern, Schichtmuster, häufige Ziele – als Excel-Liste für den Import in Phase 2.
- Teste die Fahrer-App auf Android **und** iPhone; auf dem iPhone funktionieren Push-Nachrichten nur, wenn die App zum Home-Bildschirm hinzugefügt wurde.
- Die Bildschirm-Entwürfe (Einrichtung, Disponent, Fahrer-App) sind die Vorlage für das Aussehen. Lege Screenshots davon in `docs/entwuerfe/`.
