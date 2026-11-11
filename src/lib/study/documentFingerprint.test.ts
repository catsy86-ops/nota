import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  computeDocumentHash,
  formatFingerprint,
  generateDocumentFingerprint,
  verifyDocumentFingerprint,
} from "./documentFingerprint";

describe("documentFingerprint", () => {
  it("computeDocumentHash: oblicza SHA-256 dla tekstu", async () => {
    const hash = await computeDocumentHash("hello world");
    expect(hash).toHaveLength(64); // SHA-256 = 256 bitów = 64 znaki hex
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("computeDocumentHash: zwraca inny hash dla różnych tekstów", async () => {
    const hash1 = await computeDocumentHash("hello");
    const hash2 = await computeDocumentHash("world");
    expect(hash1).not.toBe(hash2);
  });

  it("computeDocumentHash: zwraca ten sam hash dla tego samego tekstu", async () => {
    const text = "test content";
    const hash1 = await computeDocumentHash(text);
    const hash2 = await computeDocumentHash(text);
    expect(hash1).toBe(hash2);
  });

  it("formatFingerprint: formatuje datę i skrót", () => {
    const fp = {
      hash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      date: new Date("2026-11-10").getTime(),
    };
    const formatted = formatFingerprint(fp);
    expect(formatted).toContain("ABCDEF0123456789");
    expect(formatted).toContain("…");
  });

  it("generateDocumentFingerprint: zwraca hash i timestamp", async () => {
    const before = Date.now();
    const fp = await generateDocumentFingerprint("test");
    const after = Date.now();

    expect(fp.hash).toHaveLength(64);
    expect(fp.date).toBeGreaterThanOrEqual(before);
    expect(fp.date).toBeLessThanOrEqual(after);
  });

  it("verifyDocumentFingerprint: potwierdza oryginalny dokument", async () => {
    const text = "dokument oryginalny";
    const fp = await generateDocumentFingerprint(text);
    const valid = await verifyDocumentFingerprint(text, fp);
    expect(valid).toBe(true);
  });

  it("verifyDocumentFingerprint: odrzuca zmieniony dokument", async () => {
    const text = "dokument oryginalny";
    const fp = await generateDocumentFingerprint(text);
    const modified = "dokument zmieniony";
    const valid = await verifyDocumentFingerprint(modified, fp);
    expect(valid).toBe(false);
  });

  it("verifyDocumentFingerprint: odrzuca nawet małą zmianę", async () => {
    const text = "test";
    const fp = await generateDocumentFingerprint(text);
    const modified = "test."; // jeden znak
    const valid = await verifyDocumentFingerprint(modified, fp);
    expect(valid).toBe(false);
  });
});

describe("documentFingerprint: wektor referencyjny i brak Web Crypto", () => {
  it("SHA-256 zgodny ze znanym wektorem (FIPS 180-2: \"abc\")", async () => {
    expect(await computeDocumentHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await computeDocumentHash("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("bez crypto.subtle: policzenie rzuca, a sprawdzenie odmawia", async () => {
    vi.stubGlobal("crypto", {});
    try {
      await expect(computeDocumentHash("abc")).rejects.toThrow(/Web Crypto/);
      await expect(verifyDocumentFingerprint("abc", { hash: "x", date: 0 })).resolves.toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
