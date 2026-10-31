/**
 * Text-Chat-Simulator für die KI am Telefon (docs/04-voice-agent.md, docs/09-bauplan.md Phase 6).
 * Nutzt dieselben Anweisungen und Werkzeuge wie ein echter Vapi-Anruf, aber über die Anthropic-API
 * statt über ein echtes Telefongespräch – zum Testen von Gesprächsabläufen ohne Telefonminuten.
 *
 * Aufruf: npm run voice:sim [angerufeneNummer]
 * Beenden: "ende" eingeben.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type Anthropic from "@anthropic-ai/sdk";
import { claudeClient, CLAUDE_MODELL } from "../src/lib/anthropic";
import { prisma } from "../src/lib/prisma";
import { voiceSystemPrompt } from "../src/core/notify/voicePrompt";
import { werkzeugAusfuehren } from "../src/core/voice/werkzeuge";
import { anrufSicherstellen, anrufAbschliessen } from "../src/core/voice/anruf";
import { anrufZusammenfassen } from "../src/core/notify/anrufZusammenfassung";
import type { ToolCall } from "../src/providers/voice/types";

const WERKZEUGE: Anthropic.Tool[] = [
  {
    name: "fahrgast_suchen",
    description: "Fahrgast anhand Telefonnummer, Nachname oder Geburtsdatum suchen.",
    input_schema: {
      type: "object",
      properties: {
        telefon: { type: "string" },
        nachname: { type: "string" },
        geburtsdatum: { type: "string", description: "JJJJ-MM-TT" },
      },
    },
  },
  {
    name: "ort_suchen",
    description: "Bekannten Ort oder Adresse suchen, z. B. 'Dialysezentrum Aachen'.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "fahrt_anlegen",
    description:
      "Neue Fahrt anlegen. passengerId verwenden, wenn über fahrgast_suchen gefunden; sonst fahrgastVorname/fahrgastNachname (und optional Geburtsdatum/Telefon/Krankenkasse) für einen neuen Fahrgast angeben.",
    input_schema: {
      type: "object",
      properties: {
        passengerId: { type: "string" },
        fahrgastVorname: { type: "string" },
        fahrgastNachname: { type: "string" },
        fahrgastGeburtsdatum: { type: "string", description: "JJJJ-MM-TT" },
        fahrgastTelefon: { type: "string" },
        fahrgastKrankenkasse: { type: "string" },
        pickupPlaceId: { type: "string" },
        dropoffPlaceId: { type: "string" },
        datum: { type: "string", description: "JJJJ-MM-TT" },
        abholzeit: { type: "string", description: "HH:MM" },
        terminzeit: { type: "string", description: "HH:MM" },
        rueckfahrt: { type: "boolean" },
        rueckfahrtzeit: { type: "string", description: "HH:MM" },
        transportType: { type: "string", enum: ["SITZEND", "ROLLSTUHL", "TRAGESTUHL", "LIEGEND"] },
        companion: { type: "boolean" },
        assistanceNotes: { type: "string" },
        prescription: { type: "string", enum: ["JA", "NEIN", "UNKLAR", "NICHT_NOETIG"] },
        approval: { type: "string", enum: ["JA", "NEIN", "UNKLAR", "NICHT_NOETIG"] },
      },
      required: ["pickupPlaceId", "dropoffPlaceId", "datum", "abholzeit", "transportType", "prescription", "approval"],
    },
  },
  {
    name: "serie_anlegen",
    description:
      "Serienfahrt anlegen (wiederkehrend, z. B. Dialyse Mo/Mi/Fr). passengerId verwenden, wenn über fahrgast_suchen gefunden; sonst fahrgastVorname/fahrgastNachname für einen neuen Fahrgast angeben.",
    input_schema: {
      type: "object",
      properties: {
        passengerId: { type: "string" },
        fahrgastVorname: { type: "string" },
        fahrgastNachname: { type: "string" },
        fahrgastGeburtsdatum: { type: "string", description: "JJJJ-MM-TT" },
        fahrgastTelefon: { type: "string" },
        fahrgastKrankenkasse: { type: "string" },
        pickupPlaceId: { type: "string" },
        dropoffPlaceId: { type: "string" },
        wochentage: {
          type: "array",
          items: { type: "string", enum: ["MO", "DI", "MI", "DO", "FR", "SA", "SO"] },
          description: "Wochentage, an denen die Fahrt stattfindet",
        },
        abholzeit: { type: "string", description: "HH:MM" },
        terminzeit: { type: "string", description: "HH:MM" },
        rueckfahrt: { type: "boolean" },
        rueckfahrtzeit: { type: "string", description: "HH:MM" },
        bis: { type: "string", description: "JJJJ-MM-TT, Enddatum der Serie" },
        transportType: { type: "string", enum: ["SITZEND", "ROLLSTUHL", "TRAGESTUHL", "LIEGEND"] },
        companion: { type: "boolean" },
        assistanceNotes: { type: "string" },
        prescription: { type: "string", enum: ["JA", "NEIN", "UNKLAR", "NICHT_NOETIG"] },
        approval: { type: "string", enum: ["JA", "NEIN", "UNKLAR", "NICHT_NOETIG"] },
      },
      required: ["pickupPlaceId", "dropoffPlaceId", "wochentage", "abholzeit", "bis", "transportType", "prescription", "approval"],
    },
  },
  {
    name: "fahrt_finden",
    description: "Kommende Fahrten eines Fahrgasts finden.",
    input_schema: {
      type: "object",
      properties: { passengerId: { type: "string" }, datum: { type: "string" } },
      required: ["passengerId"],
    },
  },
  {
    name: "fahrt_aendern",
    description: "Eine bestehende Fahrt ändern (Uhrzeit, Adresse, Transportart, …).",
    input_schema: {
      type: "object",
      properties: {
        rideId: { type: "string" },
        abholzeit: { type: "string" },
        terminzeit: { type: "string" },
        pickupPlaceId: { type: "string" },
        dropoffPlaceId: { type: "string" },
        transportType: { type: "string" },
        companion: { type: "boolean" },
        assistanceNotes: { type: "string" },
      },
      required: ["rideId"],
    },
  },
  {
    name: "fahrt_stornieren",
    description: "Eine Fahrt stornieren.",
    input_schema: {
      type: "object",
      properties: { rideId: { type: "string" }, grund: { type: "string" } },
      required: ["rideId"],
    },
  },
  {
    name: "abholzeit_auskunft",
    description: "Status und geschätzte Abholzeit einer Fahrt erfragen.",
    input_schema: { type: "object", properties: { rideId: { type: "string" } }, required: ["rideId"] },
  },
  {
    name: "an_mensch_weiterleiten",
    description: "Das Gespräch an einen Menschen weiterleiten (z. B. Notfall, Anrufer möchte einen Menschen).",
    input_schema: { type: "object", properties: { grund: { type: "string" } }, required: ["grund"] },
  },
  {
    name: "rueckruf_anlegen",
    description: "Einen Rückruf-Wunsch für den Disponenten hinterlegen.",
    input_schema: {
      type: "object",
      properties: { telefon: { type: "string" }, anliegen: { type: "string" } },
      required: ["telefon", "anliegen"],
    },
  },
];

async function main() {
  const claude = claudeClient();
  if (!claude) {
    console.error("ANTHROPIC_API_KEY fehlt in .env – siehe .env.example. Ohne Schlüssel kein voice:sim.");
    process.exit(1);
  }

  const angerufeneNummer = process.argv[2] ?? "+4924011112222";
  const telefonnummer = await prisma.phoneNumber.findUnique({
    where: { e164: angerufeneNummer },
    select: { tenantId: true },
  });
  if (!telefonnummer) {
    console.error(`Keine Telefonnummer ${angerufeneNummer} gefunden. Zuerst "npm run seed" ausführen.`);
    process.exit(1);
  }
  const [tenant, settings] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: telefonnummer.tenantId } }),
    prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: telefonnummer.tenantId } }),
  ]);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const anrufernummerEingabe = await rl.question("Anrufernummer (Enter für +491701234567): ");
  const anrufernummer = anrufernummerEingabe.trim() || "+491701234567";

  const providerCallId = `sim-${randomUUID()}`;
  const anruf = await anrufSicherstellen(tenant.id, providerCallId, { fromNumber: anrufernummer, toNumber: angerufeneNummer });

  const system = voiceSystemPrompt({
    tenantId: tenant.id,
    firmenname: tenant.name,
    ort: tenant.city ?? "",
    greeting: settings.greeting,
    voiceId: settings.voiceId,
    escalationNumber: settings.escalationNumber,
    anrufernummer,
    bestaetigungsweg: " in Kürze",
  }, { jetzt: new Date() });

  const verlauf: Anthropic.MessageParam[] = [];
  const transkriptZeilen: string[] = [`KI: ${settings.greeting}`];
  console.log(`\nKI: ${settings.greeting}\n`);
  console.log('("ende" eingeben, um das Gespräch zu beenden)\n');

  while (true) {
    const eingabe = await rl.question("Anrufer: ");
    if (eingabe.trim().toLowerCase() === "ende") break;
    transkriptZeilen.push(`Anrufer: ${eingabe}`);
    verlauf.push({ role: "user", content: eingabe });

    let weiter = true;
    while (weiter) {
      const antwort = await claude.messages.create({
        model: CLAUDE_MODELL,
        max_tokens: 1024,
        system,
        tools: WERKZEUGE,
        messages: verlauf,
      });
      verlauf.push({ role: "assistant", content: antwort.content });

      for (const block of antwort.content) {
        if (block.type === "text" && block.text.trim()) {
          console.log(`\nKI: ${block.text}\n`);
          transkriptZeilen.push(`KI: ${block.text}`);
        }
      }

      const werkzeugBloecke = antwort.content.filter((b) => b.type === "tool_use");
      if (werkzeugBloecke.length === 0) {
        weiter = false;
        break;
      }

      const ergebnisse = await Promise.all(
        werkzeugBloecke.map(async (block) => {
          const aufruf: ToolCall = { id: block.id, name: block.name, arguments: block.input as Record<string, unknown> };
          console.log(`  [Werkzeug] ${block.name}(${JSON.stringify(block.input)})`);
          const ergebnis = await werkzeugAusfuehren(tenant.id, anruf.id, aufruf);
          console.log(`  [Ergebnis] ${ergebnis.result ?? ergebnis.error}`);
          return ergebnis;
        }),
      );

      verlauf.push({
        role: "user",
        content: ergebnisse.map((e) => ({
          type: "tool_result" as const,
          tool_use_id: e.id,
          content: e.error ?? e.result ?? "",
          is_error: Boolean(e.error),
        })),
      });

      weiter = antwort.stop_reason === "tool_use";
    }
  }

  rl.close();
  const transcript = transkriptZeilen.join("\n");
  const zusammenfassung = await anrufZusammenfassen(transcript);
  await anrufAbschliessen(
    tenant.id,
    { providerCallId, fromNumber: anrufernummer, toNumber: angerufeneNummer, startedAt: new Date(), transcript },
    zusammenfassung,
  );
  console.log(`\nZusammenfassung: ${zusammenfassung}`);
  console.log("Gespräch beendet und unter /dispo/anrufe gespeichert.");
  process.exit(0);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
