import { describe, it, expect } from "vitest";
import { editDemotesTopic, editSavedMessage, newEntryMessage, shouldOfferSiteGeo } from "./entrySheetRules";

describe("komunikaty po zapisie", () => {
  it("problem na temacie „Umiem” mówi, że temat wraca do powtórki", () => {
    expect(newEntryMessage("problem", true)).toBe("Zapisano problem — temat wraca do powtórki");
    expect(newEntryMessage("problem", false)).toBe("Zapisano wpis");
    expect(newEntryMessage("ok", true)).toBe("Zapisano wpis");
    expect(editSavedMessage(true)).toBe("Zapisano zmiany — temat wraca do powtórki");
    expect(editSavedMessage(false)).toBe("Zapisano zmiany");
  });
});

describe("editDemotesTopic", () => {
  const done = { kind: "problem" as const, topic: "t1" };
  it("nowy problem na temacie „Umiem” cofa go", () => {
    expect(editDemotesTopic({ kind: "problem", topic: "t1" }, { kind: "ok", topic: "t1" }, true)).toBe(true);
  });
  it("problem, który już był na tym temacie, nie cofa go drugi raz", () => {
    expect(editDemotesTopic({ kind: "problem", topic: "t1" }, done, true)).toBe(false);
  });
  it("temat niedokończony albo brak tematu — bez cofania", () => {
    expect(editDemotesTopic({ kind: "problem", topic: "t1" }, undefined, false)).toBe(false);
    expect(editDemotesTopic({ kind: "problem", topic: "" }, undefined, true)).toBe(false);
  });
});

describe("shouldOfferSiteGeo", () => {
  it("proponuje, gdy wpis ma lokalizację, budowa jest, a karta nie ma lokalizacji", () => {
    expect(shouldOfferSiteGeo({ lat: 1, lng: 2 }, "s1", false)).toBe(true);
  });
  it("nie proponuje bez lokalizacji wpisu, bez budowy albo gdy karta ją ma", () => {
    expect(shouldOfferSiteGeo(null, "s1", false)).toBe(false);
    expect(shouldOfferSiteGeo({ lat: 1, lng: 2 }, undefined, false)).toBe(false);
    expect(shouldOfferSiteGeo({ lat: 1, lng: 2 }, "s1", true)).toBe(false);
  });
});
