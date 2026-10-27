import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/** /einrichtung springt immer zum zuletzt erreichten Schritt (Tenant.setupStep). */
export default async function EinrichtungPage() {
  const { tenantId } = await requireSession();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { setupStep: true } });
  redirect(`/einrichtung/${tenant.setupStep}`);
}
