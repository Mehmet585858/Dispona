import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("verschlüsselt und entschlüsselt einen Text wieder zum Original", () => {
    const original = "Erika Schmitz, Transportschein vorhanden, Rollstuhl";
    const verschlüsselt = encrypt(original);
    expect(verschlüsselt).not.toContain(original);
    expect(decrypt(verschlüsselt)).toBe(original);
  });

  it("erzeugt für denselben Text jedes Mal einen anderen Geheimtext (zufälliger IV)", () => {
    const original = "gleicher Text";
    expect(encrypt(original)).not.toBe(encrypt(original));
  });

  it("lehnt einen manipulierten Geheimtext ab", () => {
    const verschlüsselt = encrypt("vertraulich");
    const [iv, tag, text] = verschlüsselt.split(":");
    const manipuliert = [iv, tag, text.slice(0, -2) + "zz"].join(":");
    expect(() => decrypt(manipuliert)).toThrow();
  });
});
