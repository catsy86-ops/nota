import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { logKey } from "./model";
import { createYSupplements, SUPPLEMENTS_ORIGIN } from "./ySupplements";

const sup = (id: string, name = id) => ({ id, name, dose: "1 łyżka", when: "rano" as const, created: 1 });

describe("createYSupplements", () => {
  it("dodaje odżywkę i zwraca ją w liście", () => {
    const doc = new Y.Doc();
    const y = createYSupplements(doc);
    expect(y.add(sup("s1", "Kreatyna"))).toBe(true);
    expect(y.get().map((s) => s.name)).toEqual(["Kreatyna"]);
  });

  it("nie dodaje duplikatu id", () => {
    const y = createYSupplements(new Y.Doc());
    y.add(sup("s1"));
    expect(y.add(sup("s1"))).toBe(false);
  });

  it("odhaczenie zapisuje klucz dnia i id, a odznaczenie go zdejmuje", () => {
    const y = createYSupplements(new Y.Doc());
    y.add(sup("s1"));
    y.setTaken("2026-10-20", "s1", true);
    expect(y.getTaken().has(logKey("2026-10-20", "s1"))).toBe(true);
    y.setTaken("2026-10-20", "s1", false);
    expect(y.getTaken().size).toBe(0);
  });

  it("usunięcie odżywki zdejmuje jej odhaczenia, a nie ruszą się cudze", () => {
    const y = createYSupplements(new Y.Doc());
    y.add(sup("s1"));
    y.add(sup("s2"));
    y.setTaken("2026-10-20", "s1", true);
    y.setTaken("2026-10-20", "s2", true);
    y.remove("s1");
    expect(Array.from(y.getTaken())).toEqual([logKey("2026-10-20", "s2")]);
  });

  it("śmieci w mapie od peera są pomijane przy odczycie", () => {
    const doc = new Y.Doc();
    const y = createYSupplements(doc);
    y.add(sup("s1"));
    doc.getMap("supplements").set("zepsute", { id: "zepsute", name: "", when: "rano" });
    expect(y.get().map((s) => s.id)).toEqual(["s1"]);
  });

  it("zmiany idą z origin Odżywek, a subskrybent dostaje powiadomienie", () => {
    const doc = new Y.Doc();
    const y = createYSupplements(doc);
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => origins.push(tr.origin));
    let calls = 0;
    const off = y.subscribe(() => calls++);
    y.add(sup("s1"));
    expect(origins).toContain(SUPPLEMENTS_ORIGIN);
    expect(calls).toBeGreaterThan(0);
    off();
  });
});
