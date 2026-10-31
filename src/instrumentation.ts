import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Maßnahme M-03: fehlende Pflichtschlüssel lassen den Start in Produktion scheitern, statt
    // dass Anmeldung, Push oder Webhook später still versagen.
    const { umgebungPruefen } = await import("./lib/umgebung");
    umgebungPruefen(process.env, process.env.NODE_ENV);
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
