# 04a – Vapi-Notizen (Recherche vor Phase 6)

Stand: 27.10.2026, anhand der aktuellen Vapi-Dokumentation (nicht aus dem Gedächtnis). Ziel: prüfen, ob die Annahmen in `docs/04-voice-agent.md` noch stimmen, bevor wir `VoiceProvider` für Vapi bauen.

**Kurzfassung für die Entscheidung:** Technisch passt Vapi gut zu unserem Plan (Server-URL, Werkzeuge, Transfer, Zusammenfassung – siehe unten). Die eine echte Lücke: **Datenverarbeitung nur in der EU ist bei Vapi kein Standard-Feature**, sondern an ein teures Vertriebspaket gebunden (siehe „Datenverarbeitung in der EU"). Das sollten wir klären, bevor wir dem Pilot-Fahrdienst „Ihre Daten bleiben in der EU" versprechen.

---

## 1. Konfiguration pro Mandant (bei jedem Anruf neu)

Passt genau zu unserem Plan. Ist auf der angerufenen Nummer **kein** fest hinterlegter Assistent eingestellt, schickt Vapi bei jedem eingehenden Anruf `assistant-request` an unsere Server-URL. Wir antworten – **hartes Zeitlimit 7,5 Sekunden, nicht einstellbar** – mit einer von vier Möglichkeiten:

- `{assistantId}` – einen gespeicherten Assistenten wiederverwenden
- `{assistant: {...}}` – einen kompletten Assistenten für genau diesen Anruf bauen (Begrüßung, Modell, Stimme, Werkzeuge) – das ist unser Fall: pro Mandant anhand der angerufenen Nummer
- `{destination: {...}}` – sofort weiterleiten, ohne KI (z. B. KI aus → direkt an `escalationNumber`)
- `{error: "..."}` – Anruf ablehnen/Fehlermeldung

Quelle: https://docs.vapi.ai/server-url/events

## 2. Server-URL / Webhooks – welche Nachrichten es gibt

Jede Nachricht kommt als `POST` mit `{ message: { type, call, phoneNumber, customer, assistant, artifact, timestamp, ... } }`.

**Vier Typen erwarten eine sofortige Antwort** (wir müssen antworten, sonst stockt das Gespräch):
`assistant-request`, `tool-calls`, `transfer-destination-request`, `knowledge-base-request`.

**Alle anderen sind „Feuer und vergessen"** (nur zur Kenntnisnahme, keine Antwort nötig): `end-of-call-report`, `status-update`, `transcript`, `hang`, …

Reihenfolge, welche Server-URL gilt, wenn mehrere hinterlegt sind: Assistent → Telefonnummer → Organisation (eine vierte, noch speziellere Ebene auf Werkzeug-Ebene wird in Foren erwähnt, aber nicht offiziell dokumentiert).

→ Für uns reicht **eine** Server-URL auf Organisationsebene, die alle Mandanten bedient (Mandant wird anhand der angerufenen Nummer im Request bestimmt, wie in `docs/04-voice-agent.md` vorgesehen).

Quelle: https://docs.vapi.ai/server-url/events

## 3. Werkzeuge (Tools)

`tool-calls` enthält eine Liste `toolCallList` (`id`, `function.name`, `function.arguments`). Antwort: HTTP 200 mit `{ results: [{ toolCallId, result: "Text" } | { toolCallId, error: "Text" }] }`.

**Korrektur zu `docs/04-voice-agent.md`:** Es gibt **kein dokumentiertes festes Zeitlimit von 1,5 Sekunden**. Im Dashboard lässt sich ein Timeout je Werkzeug einstellen, und Vapi hat einen „Request Delayed"-Füllsatz, den die KI sagt, wenn ein Werkzeug länger braucht, sowie einen „Async Mode" für Werkzeuge, deren Ergebnis nicht sofort gebraucht wird. Schnell bleibt trotzdem wichtig, damit sich das Gespräch natürlich anfühlt – nur eben kein hartes Abbruch-Limit wie bei `assistant-request` (7,5 Sek.).

Quellen: https://docs.vapi.ai/server-url/events, https://docs.vapi.ai/tools/custom-tools

## 4. Gespräch an einen Menschen übergeben (Transfer)

Werkzeug `transferCall` mit Zielnummer. Fehlt die Zielnummer im Aufruf, fragt Vapi mit `transfer-destination-request` nach; wir antworten mit `{ destination: { type: "number", number: "+49..." }, message: {...} }`. Beim Ziel lässt sich auch die angezeigte Anrufer-Nummer (`callerId`) setzen.

Der eigentliche Übergabe-Status bei Telefon-/SIP-Anrufen zeigt sich als `status-update` mit `status: "forwarding"` – ein eigener `transfer-update`-Typ existiert zwar, gilt laut Doku aber nur für KI-zu-KI-Übergaben, nicht für die Übergabe an einen echten Menschen.

Quelle: https://docs.vapi.ai/server-url/events

## 5. Ende des Gesprächs (End-of-Call-Report)

`end-of-call-report` enthält `endedReason`, `call` und `artifact` (darin: `recording`, `transcript` als Text, `messages` mit Sprecher + Text). Eine fertige „strukturierte Zusammenfassung" liefert Vapi hier **nicht von sich aus** – die 3-Zeilen-Zusammenfassung für den Disponenten müssen wir wie geplant selbst aus dem Transkript erzeugen (über das Sprachmodell von Vapi oder die Claude API).

Quelle: https://docs.vapi.ai/server-url/events

## 6. Signaturprüfung

Keine einzelne feste Methode – hängt davon ab, welche „Custom Credential" im Dashboard (Integrations → Server Configuration) an die Server-URL gehängt wird:

- Bearer-Token (Standard, im Header `Authorization`)
- Bearer-Token, ältere Variante (im Header `X-Vapi-Secret`)
- OAuth2
- HMAC (Signatur in einem selbst benannten Header, z. B. `x-signature`, SHA-256 über `{timestamp}.{body}`, als Hex – die genauen Prüfschritte stehen nicht in der Doku, Vergleich läuft wie bei jedem HMAC-Verfahren üblich)

**Wichtig:** Die Zugangsdaten werden nur angehängt, wenn die Server-URL **im Dashboard auf Organisationsebene** hinterlegt ist. Wird sie stattdessen per API gesetzt, kommen keine Auth-Header mit – dann müsste unser Endpunkt sich anders absichern.

→ Für uns: Server-URL im Dashboard eintragen (nicht nur per API), Bearer-Token oder HMAC wählen, `verifyWebhook()` entsprechend bauen.

Quelle: https://docs.vapi.ai/server-url/server-authentication

## 7. Datenverarbeitung in der EU – die eine wichtige Lücke

- Vapi wirbt in den FAQ mit „GDPR compliant" und SOC 2 Typ II, verweist für Details auf ein Trust Portal (security.vapi.ai) – ohne Details in den FAQ selbst.
- **Die EU-Region ist an das „Premier Success Package" gebunden** – ein Vertriebspaket, kein Tarif zum Selbst-Buchen, laut Vapis eigener Doku zum Datenfluss.
- Selbst mit EU-Region: die Verarbeitung (Erkennen von Gesprächspausen/Unterbrechungen) läuft laut Doku auf „US/EU-Infrastruktur" (nicht rein EU), System-Protokolle bleiben immer auf Vapis eigener Infrastruktur unabhängig von der Region, und **Aufnahmen/Transkripte liegen standardmäßig auf Vapis eigener Infrastruktur** – echte Speicherung in der EU-Region braucht einen eigenen S3/GCS/Azure-Speicher plus einen Sprachmodell-/Sprachanbieter mit Sitz in der EU.
- Datenübertragung in die USA läuft über Standardvertragsklauseln (SCC).

**Für uns bedeutet das:** Bevor wir dem Pilot-Fahrdienst zusagen „Gesundheitsdaten bleiben in der EU" (wichtig bei Fahrgast-Daten!), müssen wir **direkt mit Vapis Vertrieb klären**, was das „Premier Success Package" kostet und ob ein eigener EU-Speicher technisch für uns machbar ist. Auf den günstigen Tarifen ist das so nicht zu haben.

Quellen: https://docs.vapi.ai/security-and-privacy/data-flow, https://docs.vapi.ai/faq, https://security.vapi.ai/

## 8. Deutsche Sprache (Spracherkennung und Stimme)

Keine offizielle, belastbare Empfehlung speziell für Deutsch gefunden. Vapi bietet u. a. Deepgram und ElevenLabs Scribe als Spracherkennung an, beide werben mit Deutsch-Unterstützung – ein offizieller Vergleich fehlt.

→ Vor dem Festlegen: beide mit echten deutschen Testgesprächen ausprobieren (ältere Anrufer, Zahlen, Adressen), nicht nur Werbeaussagen glauben.

## 9. Rufumleitung von der bestehenden Nummer + Übermittlung der Anrufernummer

- Vapi verkauft **nur US-Nummern direkt**. Eine deutsche Nummer muss **importiert** werden – entweder über einen Partner-Anbieter (z. B. DIDWW, siehe https://docs.vapi.ai/phone-numbers/didww) oder über einen eigenen SIP-Trunk („BYO SIP Trunk Number" im Dashboard).
- **Praktischer Weg:** Eine echte deutsche Nummer bei einem Anbieter wie Telnyx oder DIDWW anmieten/portieren, diese per SIP in Vapi einbinden, und dann die **Rufumleitung** der bestehenden Geschäftsnummer des Fahrdienstes auf diese deutsche Vapi-Nummer einrichten. So entstehen keine Auslandsweiterleitungskosten, die bei direkter Weiterleitung auf eine ausländische (nicht-deutsche) Nummer anfallen würden.
- Unbestätigter Hinweis aus einem Forum: bei einer über Telnyx importierten deutschen Nummer scheiterten abgehende Anrufe im E.164-Format (+49…), funktionierten aber im Format 00+49… – vor dem Festlegen selbst testen.
- **Übermittlung der Anrufernummer:** Die eingehende Nachricht enthält ein `customer`-Objekt mit `{{customer.number}}` (im internationalen Format) – genau das, was unser Werkzeug `fahrgast_suchen` für `{{anrufernummer}}` braucht. Mehrere Forenbeiträge berichten aber, dass dieses Feld je nach SIP-Einrichtung leer/„N/A" ankommen kann. **Muss mit dem echten Rufumleitungs-Aufbau getestet werden**, nicht nur aus der Doku übernommen.

Quellen: https://docs.vapi.ai/phone-numbers/didww, mehrere Community-/Support-Beiträge (nicht offiziell, daher als unbestätigt markiert)

## 10. Konto und Kosten

| Tarif | Grundgebühr | Sonstiges |
| --- | --- | --- |
| Ohne Success Package | 0 €/Monat | 0,05 $/Min. Vapi-Gebühr, 5 $ Startguthaben, 1 Telefonnummer inklusive |
| Core | 29 $/Monat | 5 Telefonnummern |
| Pro | ab 999 $/Monat | 10 % der Hosting-Gebühr |
| Premier | Verhandelt mit Vertrieb | **einzige Stufe mit EU-Region** |

Dazu kommen durchgereichte Minutenpreise: Spracherkennung (Deepgram) ca. 0,0095–0,0099 $/Min., Sprachmodell (OpenAI) ca. 0,0077–0,0452 $/Min. je nach Modell, Stimme (ElevenLabs) ca. 0,0146–0,0238 $/Min. Die Telefonie selbst ist über Vapis eigene Technik kostenlos inbegriffen, oder separat bepreist, wenn wir einen eigenen Anbieter (z. B. Telnyx, günstigster Posten mit 0,0055 $/Min.) einbinden.

**Grobe Schätzung für den Pilot** (geringes Anrufaufkommen, deutlich unter 500 Minuten/Monat): **ca. 25–80 € im Monat** auf dem kostenlosen oder Core-Tarif – ohne deutsche Nummer (siehe Punkt 9) und ohne EU-Region/Premier.

Quelle: https://vapi.ai/pricing

---

## Was das für unseren Bauplan bedeutet

- Die Architektur aus `docs/02-architektur.md` und `docs/04-voice-agent.md` passt weiterhin: `VoiceProvider`-Schnittstelle, drei Endpunkte (`assistant-request`, `tools`, `events`), Signaturprüfung. Kein Umbau nötig.
- Eine Korrektur: „Werkzeuge antworten unter 1,5 Sekunden" ist keine harte Vapi-Vorgabe, bleibt aber als eigene Zielmarke sinnvoll (Gespräch soll flüssig bleiben).
- Zwei Punkte brauchen **echtes Ausprobieren**, nicht nur Doku-Lektüre, sobald eine Testnummer eingerichtet ist: ob die Anrufernummer wirklich zuverlässig ankommt, und ob die deutsche Rufumleitung sauber funktioniert.
- Die EU-Datenfrage ist ein Geschäfts-/Vertriebsthema, kein technisches – das sollte vor dem Testanruf mit Vapi direkt geklärt werden, nicht erst beim Pilot-Fahrdienst.
