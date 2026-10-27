import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Klinik ruft wegen einer Entlassung an",
  kategorie: "Praxis/Klinik ruft an",
  anrufernummer: "+492401555111",
  beschreibung: "Das Uniklinikum organisiert die Heimfahrt eines Patienten nach der Entlassung, Zeitpunkt noch nicht ganz fest.",
  anrufer: [
    "Hallo, hier ist die Station 4 vom Uniklinikum Aachen, es geht um eine Entlassung.",
    "Patientin ist Maria Wagner, sie soll heute Nachmittag nach Hause, genaue Uhrzeit steht noch nicht fest, schätzungsweise 15 Uhr.",
    "Sie braucht einen Tragestuhl.",
    "Ziel ist ihre Wohnadresse, die müsste bei Ihnen hinterlegt sein.",
    "Ja, Abholung bitte an der Station 4.",
  ],
  erwartetesErgebnis:
    "Da die Abholzeit nur geschätzt ist, fragt die KI aktiv nach einer möglichst genauen Uhrzeit oder markiert es als vorläufig und sagt die Bestätigung über bestaetigungsweg zu. Transportart TRAGESTUHL.",
};

export default gespraech;
