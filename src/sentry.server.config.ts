// Fehler-Monitoring auf dem Server (docs/09-bauplan.md Phase 12 "Fehlerüberwachung ohne
// personenbezogene Daten"). Ohne SENTRY_DSN (z. B. lokal) initialisiert sich das SDK nicht und
// tut nichts – kein Fehler, keine Einrichtung nötig für die Entwicklung.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Keine IP-Adresse, keine Cookies/Header/Query-Parameter, keine Request-/Response-Bodies
  // (könnten Fahrgastdaten aus Formularen enthalten), keine lokalen Variablenwerte in
  // Stack-Traces (könnten Name/Adresse/Telefonnummer aus Variablen wie "fahrgast" zeigen) und
  // keine Datenbank-Query-Daten. Unsere Fehlermeldungen selbst enthalten laut
  // docs/11-sicherheitsbericht.md Punkt 5 ohnehin keine Klardaten, aber das SDK soll so wenig
  // wie möglich von sich aus mitschicken.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  beforeSend(event) {
    delete event.user;
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.data;
    }
    return event;
  },
});
