import { describe, expect, it } from "vitest";
import { decryptNoteString, decryptString, encryptNoteStringV2, encryptString, looksLikeVaultToken, noteAad } from "./vault";

// V-3 (plan Skarbca 3.1), krok 1: format v2 z epoką w AAD. Zapis pozostaje v1 do bramki wersji.
async function key(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

describe("format skarbca v2 (V-3, krok 1)", () => {
  it("v1 nadal odszyfrowuje się przez decryptNoteString (AAD bez epoki)", async () => {
    const k = await key();
    const v1 = await encryptString(k, "treść", noteAad("n1"));
    expect(v1.startsWith("v1.")).toBe(true);
    expect(await decryptNoteString(k, v1, "n1", 7)).toBe("treść");
  });

  it("v2 odszyfrowuje się tylko z tą samą epoką i tym samym id notatki", async () => {
    const k = await key();
    const v2 = await encryptNoteStringV2(k, "sekret", "n1", 3);
    expect(v2.startsWith("v2.")).toBe(true);
    expect(await decryptNoteString(k, v2, "n1", 3)).toBe("sekret");
    await expect(decryptNoteString(k, v2, "n1", 4)).rejects.toThrow();
    await expect(decryptNoteString(k, v2, "n2", 3)).rejects.toThrow();
  });

  it("szyfrogram v2 nie odszyfruje się zwykłym decryptString (inny AAD)", async () => {
    const k = await key();
    const v2 = await encryptNoteStringV2(k, "x", "n1", 1);
    await expect(decryptString(k, v2, noteAad("n1"))).rejects.toThrow();
  });

  it("rozpoznawanie tokenów przyjmuje v1 i v2", () => {
    const body = "A".repeat(16) + "." + "B".repeat(22);
    expect(looksLikeVaultToken(`v1.${body}`)).toBe(true);
    expect(looksLikeVaultToken(`v2.${body}`)).toBe(true);
    expect(looksLikeVaultToken(`v3.${body}`)).toBe(false);
  });
});
