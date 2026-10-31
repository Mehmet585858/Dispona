/**
 * Push- und SMS-Texte an Fahrer: nie Namen oder Hinweise, nur Uhrzeit und Ort
 * (docs/02-architektur.md, docs/08-datenschutz-sicherheit.md).
 */

function kurzOrt(label: string): string {
  // Nur der erste Teil vor dem Komma, z. B. "Dialysezentrum Aachen, ..." -> "Dialysezentrum Aachen".
  return label.split(",")[0].trim();
}

export function neueFahrtText(uhrzeit: string, vonOrt: string, nachOrt: string): string {
  return `Neue Fahrt ${uhrzeit} ${kurzOrt(vonOrt)} → ${kurzOrt(nachOrt)}. Bitte App öffnen.`;
}

export function geaenderteFahrtText(uhrzeit: string): string {
  return `Fahrt ${uhrzeit} wurde geändert. Bitte App öffnen.`;
}

export function fahrtEntzogenText(uhrzeit: string): string {
  // Bewusst neutral (nicht "einem anderen Fahrzeug zugeteilt"): der Grund kann auch ein
  // Schichtende sein, das bei einer Zeitänderung keinen Fahrer mehr für diese Fahrt übrig lässt.
  return `Fahrt ${uhrzeit} wurde Ihnen entzogen. Bitte App öffnen.`;
}

export function stornierteFahrtText(uhrzeit: string): string {
  return `Fahrt ${uhrzeit} entfällt. Bitte App öffnen.`;
}

export function keineBestaetigungAlarmText(uhrzeit: string): string {
  return `Fahrer hat Fahrt ${uhrzeit} nicht bestätigt. Bitte prüfen.`;
}

export function keinFahrzeugAlarmText(uhrzeit: string): string {
  return `Für Fahrt ${uhrzeit} ist noch kein Fahrzeug gefunden. Bitte prüfen.`;
}

/** Einmal-Link für die Fahrer-App per SMS – nur der Link, keine Namen, keine Fahrtdaten. */
export function anmeldeLinkText(url: string): string {
  return `Anmelde-Link für die Fahrer-App (10 Minuten gültig): ${url}`;
}
