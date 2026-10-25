import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, draftHasContent, sanitizeDraft } from "./draft";
import { cleanSite, findSiteByName, siteDirectory } from "./sites";
import type { JournalEntry } from "./yStudy";

// Szkic wpisu i katalog budów (Etap 5 § 5.6): odporność na zepsute dane z zapisu.
describe("draft: szkic wpisu", () => {
  it("bez zapisanych danych wraca domyślny szkic", () => {
    expect(sanitizeDraft(EMPTY_DRAFT, null)).toBe(EMPTY_DRAFT);
    expect(sanitizeDraft(EMPTY_DRAFT, "zepsute")).toBe(EMPTY_DRAFT);
  });

  it("nieznany rodzaj wpisu wraca jako „ok”, a liczba w temacie odrzucona", () => {
    const d = sanitizeDraft(EMPTY_DRAFT, { kind: "dziwny", topic: 5, text: "Montaż" });
    expect(d.kind).toBe("ok");
    expect(d.topic).toBe("");
    expect(d.text).toBe("Montaż");
  });

  it("szkic z samymi spacjami nie ma treści", () => {
    expect(draftHasContent({ ...EMPTY_DRAFT, text: "   " })).toBe(false);
    expect(draftHasContent({ ...EMPTY_DRAFT, text: "x" })).toBe(true);
  });
});

describe("sites: katalog budów", () => {
  it("cleanSite odrzuca rekord bez id i bez nazwy", () => {
    expect(cleanSite({ name: "Lipowa" })).toBeNull();
    expect(cleanSite({ id: "a", name: "   " })).toBeNull();
    expect(cleanSite(null)).toBeNull();
  });

  it("cleanSite zachowuje nazwę i pola podstawowe", () => {
    const c = cleanSite({ id: "a", name: "Lipowa 5", address: "ul. Lipowa 5", created: 10 });
    expect(c).toMatchObject({ id: "a", name: "Lipowa 5", address: "ul. Lipowa 5", created: 10 });
  });

  it("siteDirectory łączy karty i wpisy dziennika bez duplikatów", () => {
    const card = { id: "k1", name: "Lipowa 5", address: "", investor: "", created: 1 } as never;
    const entry = { id: "e", at: 5, kind: "ok", topic: null, text: "x", site: "Lipowa 5", siteId: "k1", checked: [], images: [] } as unknown as JournalEntry;
    const dir = siteDirectory({ k1: card }, [entry]);
    expect(dir.filter((s) => s.id === "k1")).toHaveLength(1);
    expect(findSiteByName(dir, "lipowa 5")?.id).toBe("k1");
  });
});
