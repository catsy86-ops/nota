import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
