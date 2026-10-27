// Getrennt von actions.ts: "use server"-Dateien dürfen nur async Funktionen exportieren, keine
// Konstanten (https://nextjs.org/docs/messages/invalid-use-server-value).
export const STIMMEN = [
  { voiceId: "de-freundlich-1", name: "Stimme 1", beschreibung: "Warm und ruhig" },
  { voiceId: "de-klar-1", name: "Stimme 2", beschreibung: "Freundlich und klar" },
  { voiceId: "de-sachlich-1", name: "Stimme 3", beschreibung: "Sachlich und zügig" },
] as const;
