import { describe, expect, it } from "vitest";
import { storageStatus } from "./storageStatus";

describe("status zdjęć budowy", () => {
  it("świeża kopia i trwały magazyn: bez ostrzeżenia", () => {
    expect(storageStatus(0, true)).toEqual({ text: "kopia pełna: dziś", warn: false });
    expect(storageStatus(3, true)).toEqual({ text: "kopia pełna: 3 dni temu", warn: false });
    expect(storageStatus(1, null).text).toBe("kopia pełna: 1 dzień temu");
  });
  it("brak kopii albo kopia starsza niż 7 dni: ostrzeżenie", () => {
    expect(storageStatus(null, true)).toMatchObject({ warn: true, text: "kopii pełnej jeszcze nie zrobiono" });
    expect(storageStatus(7, true).warn).toBe(false);
    expect(storageStatus(8, true).warn).toBe(true);
  });
  it("magazyn nietrwały: ostrzeżenie nawet ze świeżą kopią", () => {
    const s = storageStatus(0, false);
    expect(s.warn).toBe(true);
    expect(s.text).toContain("przeglądarka może usunąć dane");
  });
});
