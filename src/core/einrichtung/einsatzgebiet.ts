/** Mitte des Einsatzgebiets eines Mandanten für das Geocoding mit Regionsbezug (Maßnahme M-06, S2-007). */
import { withTenant } from "@/lib/db";
import type { LatLng } from "@/providers/routing/types";

export async function einsatzgebietMitteLaden(tenantId: string): Promise<LatLng | undefined> {
  const settings = await withTenant(tenantId).tenantSettings.findUnique({
    where: { tenantId },
    select: { serviceAreaCenter: true },
  });
  const mitte = settings?.serviceAreaCenter as { lat?: unknown; lng?: unknown } | null | undefined;
  return mitte && typeof mitte.lat === "number" && typeof mitte.lng === "number" ? { lat: mitte.lat, lng: mitte.lng } : undefined;
}
