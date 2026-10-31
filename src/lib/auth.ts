import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, magicLink } from "better-auth/plugins";
import { anmeldeCodeZustellen } from "./anmeldeCode";
import { anmeldeLinkZustellen } from "./anmeldeLink";
import { prisma } from "./prisma";

const istEntwicklung = process.env.NODE_ENV !== "production";

export const auth = betterAuth({
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.APP_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Fahrer sollen laut docs/08-datenschutz-sicherheit.md 30 Tage angemeldet bleiben (Gerät,
  // kein Login pro Fahrt); fürs Büro gilt die kürzere 12-Stunden-Grenze aus derselben Doku –
  // die setzt src/proxy.ts zusätzlich durch (better-auth kennt keine rollenabhängige Sitzungsdauer).
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      tenantId: { type: "string", input: false },
      role: { type: "string", input: false },
      phone: { type: "string", required: false, input: false },
    },
  },
  plugins: [
    // Büro (ADMIN, DISPONENT): E-Mail mit Einmal-Code.
    emailOTP({
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 10 * 60,
      async sendVerificationOTP({ email, otp }) {
        if (istEntwicklung) {
          console.log(`[Entwicklung] Einmal-Code für ${email}: ${otp}`);
          return;
        }
        // Prüfbericht S4-013 / Maßnahme M-03: ohne RESEND_API_KEY (oder bei einem Fehler des
        // Mail-Dienstes) bekommt die Anmeldeseite eine definierte Antwort (503 + Meldung) statt
        // "Code gesendet" – der Fehler stand vorher nur im Server-Log.
        try {
          await anmeldeCodeZustellen({ email, otp });
        } catch (fehler) {
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: fehler instanceof Error ? fehler.message : "Der Anmelde-Code konnte nicht gesendet werden.",
          });
        }
      },
    }),
    // Fahrer: Einmal-Link per SMS (src/lib/anmeldeLink.ts).
    magicLink({
      disableSignUp: true,
      expiresIn: 10 * 60,
      async sendMagicLink({ email, url }) {
        if (istEntwicklung) {
          console.log(`[Entwicklung] Einmal-Link für ${email}: ${url}`);
          return;
        }
        // Produktion: per SMS an die Handynummer des Fahrerkontos. Wirft, wenn kein
        // SMS-Anbieter eingerichtet ist – better-auth gibt den Fehler an die Anmeldeseite
        // weiter statt "Link gesendet" zu melden (Prüfbericht S1-002).
        try {
          await anmeldeLinkZustellen({ email, url });
        } catch (fehler) {
          // Als definierte API-Antwort (503 + Meldung) statt als nackter Serverfehler, damit die
          // Anmeldeseite dem Fahrer sagen kann, warum kein Link kam.
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: fehler instanceof Error ? fehler.message : "Der Anmelde-Link konnte nicht gesendet werden.",
          });
        }
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
