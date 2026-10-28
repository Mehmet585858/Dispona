import { redirect } from "next/navigation";

/** Fahrplan und Start sind zu einem Dashboard unter /dispo zusammengeführt. */
export default async function FahrtenPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; ansicht?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.datum) query.set("datum", params.datum);
  if (params.ansicht) query.set("ansicht", params.ansicht);
  const suffix = query.toString();
  redirect(suffix ? `/dispo?${suffix}` : "/dispo");
}
