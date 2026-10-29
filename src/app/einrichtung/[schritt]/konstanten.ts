// Getrennt von actions.ts: "use server"-Dateien dürfen nur async Funktionen exportieren, keine
// Konstanten (https://nextjs.org/docs/messages/invalid-use-server-value).
//
// voiceId sind echte Namen aus Vapis eigenem Sprachanbieter ("Vapi Voices", provider: "vapi" in
// buildAssistantConfig) - im Vapi-Dashboard unter einem Assistenten > Stimme > Vapi einsehbar.
// Vorher standen hier erfundene Platzhalter ("de-freundlich-1" etc.), die ElevenLabs nie kannte.
export const STIMMEN = [
  { voiceId: "Clara", name: "Stimme 1", beschreibung: "Warm und ruhig" },
  { voiceId: "Emma", name: "Stimme 2", beschreibung: "Freundlich und klar" },
  { voiceId: "Kai", name: "Stimme 3", beschreibung: "Sachlich und zügig" },
] as const;
