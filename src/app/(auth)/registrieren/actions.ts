"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { registrierungErlaubt } from "@/core/einrichtung/registrierungsLimit";
import { istEindeutigkeitsFehler } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { HANDYNUMMER_UNGUELTIG, willkommenGruss } from "@/core/einrichtung/texte";
import { weiterleitungsnummerE164 } from "@/core/einrichtung/rufnummer";

const DEUTSCHLAND_MITTE = { lat: 51.1657, lng: 10.4515 };

export type RegistrierenEingabe = {
  firmenname: string;
  vorname: string;
  nachname: string;
  email: string;
  handynummer: string;
};

const registrierenSchema = z.object({
  firmenname: z.string().trim().min(1),
  vorname: z.string().trim().min(1),
  nachname: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  handynummer: z.string().trim().min(1),
});

/**
 * Erste Anmeldung eines neuen Fahrdienstes: legt Mandant + ersten ADMIN-Nutzer an
 * (docs/09-bauplan.md Phase 9). Einziger Weg, einen neuen Mandanten anzulegen – better-auth hat
 * eigenes Sign-up deaktiviert (disableSignUp: true), damit niemand sich sonst Zugriff verschafft.
 * Die Anmeldung selbst läuft danach ganz normal über /anmeldung (E-Mail-Code).
 *
 * Prüfbericht S2-011/S3-020: Mandant, Einstellungen und Nutzer entstehen in EINER Transaktion;
 * die Eindeutigkeit der E-Mail entscheidet die Datenbank (P2002) – zwei gleichzeitige Anfragen
 * hinterlassen keinen verwaisten Mandanten mehr, die zweite bekommt eine verständliche Antwort.
 */
export async function firmaRegistrieren(
  eingabe: RegistrierenEingabe,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const geprueft = registrierenSchema.safeParse(eingabe);
  if (!geprueft.success) {
    const emailFehler = geprueft.error.issues.some((i) => i.path[0] === "email");
    return { ok: false, fehler: emailFehler ? "Bitte eine gültige E-Mail-Adresse angeben." : "Bitte alle Felder ausfüllen." };
  }
  const { firmenname, vorname, nachname, email } = geprueft.data;
  // Maßnahme M-47 Punkt 3 (S2-019): Die Handynummer wird die erste Weiterleitungsnummer der KI –
  // nur eine echte Rufnummer, gespeichert als E.164 (vorher wie eingegeben, z. B. "0171 2345678").
  const handynummer = weiterleitungsnummerE164(geprueft.data.handynummer);
  if (!handynummer) return { ok: false, fehler: HANDYNUMMER_UNGUELTIG };

  // Maßnahme M-23 Punkt 2: Ratenbegrenzung je Anschluss – vor jeder Datenbankabfrage zur E-Mail,
  // damit sich auch nicht massenhaft prüfen lässt, welche Adressen schon registriert sind.
  if (!(await registrierungErlaubt(await anschlussKennung()))) {
    return { ok: false, fehler: "Zu viele Registrierungen von diesem Anschluss. Bitte später erneut versuchen." };
  }

  const vorhanden = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (vorhanden) {
    return { ok: false, fehler: "Diese E-Mail-Adresse ist schon registriert. Bitte stattdessen anmelden." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: firmenname,
          settings: {
            create: {
              greeting: willkommenGruss(firmenname),
              voiceId: "Clara",
              escalationNumber: handynummer,
              openingHours: { "mo-fr": "07:00-18:00" },
              serviceAreaCenter: DEUTSCHLAND_MITTE,
            },
          },
        },
      });
      await tx.user.create({
        data: {
          id: randomUUID(),
          tenantId: tenant.id,
          email,
          name: `${vorname} ${nachname}`,
          phone: handynummer,
          role: "ADMIN",
          emailVerified: true,
        },
      });
    });
  } catch (fehler) {
    if (istEindeutigkeitsFehler(fehler)) {
      return { ok: false, fehler: "Diese E-Mail-Adresse ist schon registriert. Bitte stattdessen anmelden." };
    }
    throw fehler;
  }

  return { ok: true };
}

/** Anschluss des Aufrufers (erste Adresse aus x-forwarded-for bzw. x-real-ip), sonst "unbekannt". */
async function anschlussKennung(): Promise<string> {
  try {
    const kopf = await headers();
    return kopf.get("x-forwarded-for")?.split(",")[0]?.trim() || kopf.get("x-real-ip") || "unbekannt";
  } catch {
    // Außerhalb einer Anfrage (Skripte, Tests).
    return "unbekannt";
  }
}
