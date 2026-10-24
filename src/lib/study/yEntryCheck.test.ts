import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { DEFAULT_CHECK_ITEMS, recordKey } from "./entryCheck";
import { createYEntryCheck } from "./yEntryCheck";

describe("lista przed wejściem — dokument Yjs", () => {
  const pair = () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on("update", (u: Uint8Array) => Y.applyUpdate(b, u));
    b.on("update", (u: Uint8Array) => Y.applyUpdate(a, u));
    return [createYEntryCheck(a), createYEntryCheck(b)] as const;
  };

  it("bez własnej listy daje domyślną; własna przechodzi na drugi telefon", () => {
    const [a, b] = pair();
    expect(a.get().custom).toBe(false);
    expect(a.get().items).toEqual(DEFAULT_CHECK_ITEMS);
    a.setItems([{ id: "k-1", text: "Klucz" }]);
    expect(b.get()).toMatchObject({ custom: true, items: [{ id: "k-1", text: "Klucz" }] });
    b.setItems(null);
    expect(a.get().custom).toBe(false);
  });

  it("odhaczenia różnych budów scalają się, a stare dni wypadają", () => {
    const [a, b] = pair();
    a.setRecord({ site: "s1", day: "2026-01-02", done: ["ochrona"] });
    b.setRecord({ site: "s2", day: "2026-10-22", done: ["rece"], at: 5 });
    a.setRecord({ site: "s1", day: "2026-10-22", done: ["ochrona"] });
    const keys = [...b.get().records.values()].map((r) => `${r.site}/${r.day}`).sort();
    expect(keys).toEqual(["s1/2026-10-22", "s2/2026-10-22"]);
  });

  it("kopia: scala bez nadpisywania tego, co już jest", () => {
    const [a] = pair();
    a.setItems([{ id: "k-1", text: "Klucz" }]);
    a.setRecord({ site: "s1", day: "2026-10-22", done: ["ochrona"], at: 1 });
    const dump = JSON.parse(JSON.stringify(a.dump()));
    const [c] = pair();
    c.setRecord({ site: "s1", day: "2026-10-22", done: [] });
    c.mergeDump(dump);
    expect(c.get().items).toEqual([{ id: "k-1", text: "Klucz" }]);
    expect([...c.get().records.values()][0].done).toEqual([]);
    c.mergeDump("śmieć");
    expect(c.get().records.size).toBe(1);
  });

  it("zapis zostawia pola z nowszej wersji, a wyjście przechodzi na drugi telefon", () => {
    const [a, b] = pair();
    const doc = new Y.Doc();
    const c = createYEntryCheck(doc);
    doc.getMap("studyEntryCheck").set(recordKey("s1", "2026-10-22"), { site: "s1", day: "2026-10-22", done: [], at: 5, przyszle: "x" });
    c.setRecord({ site: "s1", day: "2026-10-22", done: ["ochrona"], at: 5, leftAt: 9 });
    expect(doc.getMap("studyEntryCheck").get(recordKey("s1", "2026-10-22"))).toMatchObject({ przyszle: "x", leftAt: 9, done: ["ochrona"] });

    a.setRecord({ site: "s2", day: "2026-10-22", done: [], at: 5, leftAt: 9 });
    expect([...b.get().records.values()][0]).toMatchObject({ at: 5, leftAt: 9 });
  });
});
