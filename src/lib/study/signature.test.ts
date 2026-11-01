import { describe, expect, it } from "vitest";
import { cleanSignature, SIGNATURE_NAME_MAX } from "./signature";
import { cleanSite, siteKey } from "./sites";
import { buildHandover, handoverText } from "./handover";

const IMG = "a".repeat(64);
const sig = { image: IMG, name: "Jan Kowalski", at: new Date(2026, 10, 1, 15).getTime() };

describe("podpis klienta (P2.4)", () => {
  it("cleanSignature przyjmuje tylko klucz obrazu i moment, skraca imię", () => {
    expect(cleanSignature(sig)).toEqual(sig);
    expect(cleanSignature({ ...sig, name: "  Jan   Kowalski " })).toEqual(sig);
    expect(cleanSignature({ ...sig, name: "x".repeat(200) })?.name).toHaveLength(SIGNATURE_NAME_MAX);
    expect(cleanSignature({ ...sig, name: 5 })?.name).toBe("");
    // Obcy klucz (np. data URL albo adres) i brak momentu — odrzucone, karta zostaje bez podpisu.
    expect(cleanSignature({ ...sig, image: "data:image/png;base64,AAAA" })).toBeUndefined();
    expect(cleanSignature({ ...sig, image: "https://example.com/p.png" })).toBeUndefined();
    expect(cleanSignature({ ...sig, at: 0 })).toBeUndefined();
    expect(cleanSignature(null)).toBeUndefined();
  });

  it("karta budowy zachowuje podpis, a uszkodzony pomija", () => {
    const base = { id: "b-1", name: "Lipowa 5", address: "", investor: "", created: 1 };
    expect(cleanSite({ ...base, signature: sig })?.signature).toEqual(sig);
    expect(cleanSite({ ...base, signature: { image: "zly" } })).not.toHaveProperty("signature");
  });

  it("protokół niesie podpis; tekst mówi tylko, kto i kiedy podpisał", () => {
    const card = { id: siteKey("Lipowa 5"), name: "Lipowa 5", address: "", investor: "Jan Kowalski" };
    expect(buildHandover([], card).signature).toBeNull();
    const h = buildHandover([], { ...card, signature: sig });
    expect(h.signature).toEqual(sig);
    const text = handoverText(h);
    expect(text).toContain("Odbiór podpisał: Jan Kowalski, 01.11.2026");
    expect(text).not.toContain(IMG);
    expect(handoverText(buildHandover([], { ...card, signature: { ...sig, name: "" } }))).toContain("Odbiór podpisał: inwestor,");
  });
});

describe("podpis klienta — imię bez znaków sterujących", () => {
  it("usuwa przełączniki kierunku tekstu i znaki sterujące", () => {
    expect(cleanSignature({ ...sig, name: "Jan\u202E ikswoloK\u0007" })?.name).toBe("Jan ikswoloK");
    expect(cleanSignature({ ...sig, name: "Anna\u2066 Nowak\u2069" })?.name).toBe("Anna Nowak");
  });
});
