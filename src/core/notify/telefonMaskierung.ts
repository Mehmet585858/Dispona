/** Maskiert eine Telefonnummer für die Übersicht, z. B. "+49240412345" -> "+4924041· · · · ·". */
export function telefonMaskiert(nummer: string): string {
  if (nummer.length <= 6) return nummer;
  const sichtbar = nummer.slice(0, nummer.length - 4);
  return `${sichtbar}· · · ·`;
}
