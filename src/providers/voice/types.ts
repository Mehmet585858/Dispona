// VoiceProvider-Schnittstelle (docs/02-architektur.md, docs/04-voice-agent.md). Austauschbar,
// erster Anbieter Vapi (vapi.ts). Nie direkt gegen Vapi-Typen programmieren, nur gegen dieses Interface.

export type TenantVoiceSettings = {
  tenantId: string;
  firmenname: string;
  ort: string;
  greeting: string;
  voiceId: string;
  escalationNumber: string;
  anrufernummer?: string;
  bestaetigungsweg: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  id: string;
  result?: string;
  error?: string;
};

export type CallReport = {
  providerCallId: string;
  fromNumber?: string;
  toNumber: string;
  startedAt: Date;
  durationSec?: number;
  transcript?: string;
  recordingUrl?: string;
  endedReason?: string;
};

export interface VoiceProvider {
  name: string;
  /** Prüft, ob eine Webhook-Anfrage wirklich vom Anbieter kommt. */
  verifyWebhook(req: Request): Promise<boolean>;
  /** Baut die anbieter-spezifische Assistant-Konfiguration für genau diesen Anruf. */
  buildAssistantConfig(settings: TenantVoiceSettings): unknown;
  /** Liest Werkzeugaufrufe aus dem Anfrage-Körper. Leeres Array, wenn der Body keine enthält. */
  parseToolCall(body: unknown): ToolCall[];
  /** Formt unsere Werkzeug-Ergebnisse ins anbieter-spezifische Antwortformat. */
  formatToolResult(results: ToolResult[]): unknown;
  /** Liest den Gesprächsbericht aus dem Anfrage-Körper, oder null, wenn der Body keiner ist. */
  parseEndOfCall(body: unknown): CallReport | null;
  /** Prüft, ob der angerufene Teil des Bodys ein Vapi "assistant-request" ist. */
  istAssistantRequest(body: unknown): boolean;
  /** Liest die angerufene Nummer (E.164) aus einem "assistant-request"-Body. */
  angerufeneNummer(body: unknown): string | null;
  /** Liest die Anrufernummer (E.164), falls übermittelt. */
  anrufernummer(body: unknown): string | null;
  /** Liest die anbieter-eigene Anruf-ID, falls im Body vorhanden. */
  anrufId(body: unknown): string | null;
  transferCall?(callId: string, toNumber: string): Promise<void>;
}
