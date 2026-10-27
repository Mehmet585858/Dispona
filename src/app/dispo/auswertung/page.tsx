import { kennzahlenLaden } from "./actions";
import { AuswertungClient } from "./AuswertungClient";

export default async function AuswertungPage({
  searchParams,
}: {
  searchParams: Promise<{ montag?: string }>;
}) {
  const { montag } = await searchParams;
  const { montagIso, kennzahlen } = await kennzahlenLaden(montag);
  return <AuswertungClient montagIso={montagIso} kennzahlen={kennzahlen} />;
}
