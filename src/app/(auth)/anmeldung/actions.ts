"use server";

import { prisma } from "@/lib/prisma";
import { isRole } from "@/lib/roles";

type Ergebnis = { gefunden: true; methode: "code" | "link" } | { gefunden: false };

/** Schaut nach, ob die E-Mail-Adresse bekannt ist und welche Anmelde-Methode zur Rolle passt. */
export async function ermittleAnmeldeMethode(email: string): Promise<Ergebnis> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { role: true },
  });
  if (!user || !isRole(user.role)) {
    return { gefunden: false };
  }
  return { gefunden: true, methode: user.role === "FAHRER" ? "link" : "code" };
}
