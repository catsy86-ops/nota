import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Y from "yjs";
import { createYjsStore } from "@/lib/yjsStore";
import { SCHEMA_VERSION } from "@/lib/formatSchema";

/** D3.1: wzorce dokumentu każdej wydanej wersji formatu czytane bieżącym kodem. Generator: `generate.test.ts`. */
const DIR = resolve(process.cwd(), "src/test/fixtures/docs");
const versions = readdirSync(DIR).filter((f) => /^\d+\.update$/.test(f)).map((f) => Number(f.split(".")[0])).sort((a, b) => a - b);

describe("wzorce dokumentu (D3.1)", () => {
  it("bieżąca wersja formatu ma wzorzec — podniesienie SCHEMA_VERSION dodaje go w tym samym commicie", () => {
    expect(existsSync(resolve(DIR, `${SCHEMA_VERSION}.update`))).toBe(true);
    expect(versions).toEqual(Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1));
  });

  it.each(versions)("wersja %i wczytuje się bez utraty notatek, folderów i etykiet", (v) => {
    const store = createYjsStore(`fixture-${v}-${crypto.randomUUID()}`);
    Y.applyUpdate(store.doc, new Uint8Array(readFileSync(resolve(DIR, `${v}.update`))));
    const notes = store.projectNotes();
    expect(notes.map((n) => n.id).sort()).toEqual(["n1", "n2", "n3", "n4", "n5", "n6"]);
    const byId = Object.fromEntries(notes.map((n) => [n.id, n]));
    expect(byId.n1).toMatchObject({ title: "Zakupy", pinned: true, labels: ["dom"] });
    expect(byId.n2).toMatchObject({ folderId: "f2", priority: "high" });
    expect(byId.n2.labels.slice().sort()).toEqual(["dom/kuchnia", "pilne"]);
    expect(byId.n3.checklist).toEqual([{ id: "c1", text: "rury", checked: true }, { id: "c2", text: "kształtki", checked: false, indent: 1 }]);
    expect(byId.n4).toMatchObject({ archived: true, color: "sand" });
    expect(byId.n5.trashed).toBe(true);
    expect(byId.n6).toMatchObject({ title: "Zażółć gęślą jaźń", content: "[[Zakupy]] ^blok1" });
    expect(store.projectFolders().map((f) => [f.id, f.parentId])).toEqual(expect.arrayContaining([["f1", null], ["f2", "f1"]]));
    expect(store.projectLabels()).toEqual(expect.arrayContaining(["dom", "dom/kuchnia", "pilne"]));
  });
});
