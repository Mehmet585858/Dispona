export interface SmsProvider {
  name: string;
  send(toE164: string, text: string): Promise<{ id: string }>;
}
