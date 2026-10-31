import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Anrufer will nach mehreren Missverständnissen einen Menschen",
  kategorie: "Anrufer will Menschen",
  anrufernummer: "+491709990011",
  beschreibung: "Die KI versteht eine unklare Angabe wiederholt nicht, der Anrufer wird ungeduldig.",
  anrufer: [
    "Ich brauch ne Fahrt zu dem Dings, Sie wissen schon, dem Ärztehaus.",
    "Na dem mit dem komischen Namen, hab ich grad vergessen.",
    "Ach, vergessen Sie's, geben Sie mir einfach jemanden von Ihnen am Telefon.",
  ],
  erwartetesErgebnis:
    "Nach wiederholtem Nichtverstehen (laut Systemanweisung: nach drei Versuchen) bietet die KI selbst die Weiterleitung (transferCall, Maßnahme M-47) oder rueckruf_anlegen an, statt endlos weiter nachzufragen; sobald der Anrufer explizit einen Menschen will, wird sofort weitergeleitet.",
};

export default gespraech;
