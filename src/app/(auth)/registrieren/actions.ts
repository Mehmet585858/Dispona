"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { willkommenGruss } from "@/core/einrichtung/texte";

const DEUTSCHLAND_MITTE = { lat: 51.1657, lng: 10.4515 };

export type RegistrierenEingabe = {
  firmenname: string;
  vorname: string;
  nachname: string;
  email: string;
  handynummer: string;
};

/**
 * Erste Anmeldung eines neuen Fahrdienstes: legt Mandant + ersten ADMIN-Nutzer an
 * (docs/09-bauplan.md Phase 9). Einziger Weg, einen neuen Mandanten anzulegen – better-auth hat
 * eigenes Sign-up deaktiviert (disableSignUp: true), damit niemand sich sonst Zugriff verschafft.
 * Die Anmeldung selbst läuft danach ganz normal über /anmeldung (E-Mail-Code).
 */
export async function firmaRegistrieren(
  eingabe: RegistrierenEingabe,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const firmenname = eingabe.firmenname.trim();
  const vorname = eingabe.vorname.trim();
  const nachname = eingabe.nachname.trim();
  const email = eingabe.email.trim().toLowerCase();
  const handynummer = eingabe.handynummer.trim();

  if (!firmenname || !vorname || !nachname || !email || !handynummer) {
    return { ok: false, fehler: "Bitte alle Felder ausfüllen." };
  }

  const vorhanden = await prisma.user.findUnique({ where: { email } });
  if (vorhanden) {
    return { ok: false, fehler: "Diese E-Mail-Adresse ist schon registriert. Bitte stattdessen anmelden." };
  }

  const tenant = await prisma.tenant.create({
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

  await prisma.user.create({
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

  return { ok: true };
}
