import { describe, it, expect } from "vitest";
import { composeSiteLists, stripLists } from "./siteItems";
import type { SiteCard } from "./sites";

// Klucz wpisu mapy: budowa, rodzaj, id — rozdzielone znakiem \u0001 (jak w `siteItems.ts`).
const key = (site: string, kind: string, id: string) => `${site}\u0001${kind}\u0001${id}`;

describe("composeSiteLists", () => {
  it("etapy idą po zapisanej kolejności, bez pola order w wyniku", () => {
    const lists = composeSiteLists([
      [key("A", "stage", "s2"), { name: "Tynki", order: 2 }],
      [key("A", "stage", "s1"), { name: "Rury", order: 1, done: 3 }],
    ]).get("A");
    expect(lists?.stages).toEqual([
      { id: "s1", name: "Rury", done: 3 },
      { id: "s2", name: "Tynki" },
    ]);
  });

  it("sam znacznik „meta” daje pustą listę — budowa ma wtedy jawnie zero pozycji", () => {
    const lists = composeSiteLists([[key("A", "meta", "stage"), true]]).get("A");
    expect(lists).toEqual({ stages: [] });
  });

  it("pomija wpisy bez id, bez rodzaju i nie-obiekty", () => {
    const out = composeSiteLists([
      [`A\u0001stage`, { name: "bez id" }],
      [key("A", "stage", "s1"), "nie obiekt"],
      [key("A", "nieznany", "x"), { name: "obcy rodzaj" }],
    ]);
    expect(out.has("A")).toBe(false);
  });

  it("listy różnych budów są rozdzielone", () => {
    const out = composeSiteLists([
      [key("A", "stage", "s1"), { name: "a", order: 1 }],
      [key("B", "stage", "s1"), { name: "b", order: 1 }],
    ]);
    expect(out.get("A")?.stages?.[0]?.name).toBe("a");
    expect(out.get("B")?.stages?.[0]?.name).toBe("b");
  });
});

describe("stripLists", () => {
  it("zdejmuje listy z karty, zostawia resztę", () => {
    const card = { id: "A", name: "Lipowa", stages: [], shortages: [], orders: [], hours: [], docs: [], service: [], contact: "x" } as unknown as SiteCard;
    expect(stripLists(card)).toEqual({ id: "A", name: "Lipowa", contact: "x" });
  });
});

describe("composeSiteLists — braki ponad limit (charakteryzacja)", () => {
  it("składanie nie przycina: 41 braków zostaje posortowanych rosnąco po czasie", () => {
    const entries: [string, unknown][] = Array.from({ length: 41 }, (_, i) => [
      key("A", "short", `b${i + 1}`),
      { id: `b${i + 1}`, text: `Brak ${i + 1}`, qty: "", status: "missing", at: i + 1 },
    ]);
    const shortages = composeSiteLists(entries).get("A")?.shortages ?? [];
    expect(shortages).toHaveLength(41);
    expect(shortages[0].id).toBe("b1");
    expect(shortages[40].id).toBe("b41");
  });
});
