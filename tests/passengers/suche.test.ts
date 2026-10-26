import { describe, expect, it } from "vitest";
import {
  fahrgaesteAehnlicheNamen,
  istAehnlicherName,
  levenshteinDistanz,
  telefonNormalisieren,
} from "@/core/passengers/suche";

describe("unscharfe Namenssuche", () => {
  it("findet 'Schmitt', wenn nach 'Schmidt' gesucht wird (Beispiel aus dem Bauplan)", () => {
    expect(istAehnlicherName("Schmidt", "Schmitt")).toBe(true);
  });

  it("erkennt exakt gleiche Namen unabhängig von Groß-/Kleinschreibung", () => {
    expect(istAehnlicherName("Müller", "müller")).toBe(true);
  });

  it("lehnt klar unterschiedliche Namen ab", () => {
    expect(istAehnlicherName("Schmidt", "Hoffmann")).toBe(false);
  });

  it("levenshteinDistanz zählt die nötigen Änderungen", () => {
    expect(levenshteinDistanz("Schmidt", "Schmitt")).toBe(1);
    expect(levenshteinDistanz("Aachen", "Aachen")).toBe(0);
  });

  it("fahrgaesteAehnlicheNamen filtert eine Liste", () => {
    const fahrgaeste = [
      { id: "1", firstName: "Erika", lastName: "Schmitz" },
      { id: "2", firstName: "Hans", lastName: "Schmidt" },
      { id: "3", firstName: "Anna", lastName: "Hoffmann" },
    ];
    const treffer = fahrgaesteAehnlicheNamen(fahrgaeste, "Schmitt");
    expect(treffer.map((f) => f.id).sort()).toEqual(["1", "2"]);
  });
});

describe("telefonNormalisieren", () => {
  it("wandelt eine führende 0 in +49 um", () => {
    expect(telefonNormalisieren("0170 1234567")).toBe("+491701234567");
  });

  it("lässt eine internationale Nummer unverändert (nur Trennzeichen entfernt)", () => {
    expect(telefonNormalisieren("+49 170 1234567")).toBe("+491701234567");
  });
});
