import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, magicLink } from "better-auth/plugins";
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
        // TODO Phase 1b: echten E-Mail-Versand anschließen (EMAIL_SERVER).
      },
    }),
    // Fahrer: Einmal-Link, später per SMS.
    magicLink({
      disableSignUp: true,
      expiresIn: 10 * 60,
      async sendMagicLink({ email, url }) {
        if (istEntwicklung) {
          console.log(`[Entwicklung] Einmal-Link für ${email}: ${url}`);
          return;
        }
        // TODO Phase 5: echten SMS-Versand über SmsProvider anschließen.
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
