import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { prisma } from "@/lib/prisma";

/**
 * Einmaliger, manuell ausgelöster Aufruf (CRON_SECRET-gesichert, wie die laufenden Cron-Jobs) -
 * bereinigt Bestandsdaten, die vor dem Fix in src/core/disposition/zuweisen.ts entstanden sind:
 * Fahrten, die längst ein Fahrzeug haben, aber noch das veraltete Problem "KEIN_FAHRZEUG" und/
 * oder einen veralteten autoSkipReason aus einem früheren, inzwischen überholten Automodus-
 * Versuch tragen - beides ließ die Fahrt fälschlich dauerhaft in "Braucht Sie" stehen. Nach
 * einmaligem Gebrauch wieder entfernt (dasselbe Muster wie schon einmal in dieser Session).
 * Mandantenübergreifend wie die anderen Cron-Jobs - deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const betroffen = await prisma.ride.findMany({
    where: {
      vehicleId: { not: null },
      OR: [{ problems: { has: "KEIN_FAHRZEUG" } }, { autoSkipReason: { not: null } }],
    },
    select: { id: true, problems: true },
  });

  for (const fahrt of betroffen) {
    await prisma.ride.update({
      where: { id: fahrt.id },
      data: {
        problems: fahrt.problems.filter((p) => p !== "KEIN_FAHRZEUG"),
        autoSkipReason: null,
      },
    });
  }

  return NextResponse.json({ bereinigt: betroffen.length });
}
