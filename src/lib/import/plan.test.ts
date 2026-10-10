import { describe, it, expect } from "vitest";
import { buildImportPlan } from "./plan";
import { memorySource } from "./collect";
import {
  KEEP_IMAGE_JSON, KEEP_LIST_JSON, KEEP_TEXT_HTML, KEEP_TEXT_JSON, KEEP_TRASHED_JSON,
  MD_PLAIN_NOTE, OBSIDIAN_NOTE,
} from "./__fixtures__/samples";

describe("buildImportPlan — Keep", () => {
  it("łączy JSON, pomija HTML tej samej notatki i kosz, zbiera etykiety", async () => {
    const plan = await buildImportPlan([
      memorySource("Takeout/Keep/Urodziny.json", KEEP_TEXT_JSON),
      memorySource("Takeout/Keep/Urodziny.html", KEEP_TEXT_HTML),
      memorySource("Takeout/Keep/Zakupy.json", KEEP_LIST_JSON),
      memorySource("Takeout/Keep/Kosz.json", KEEP_TRASHED_JSON),
      memorySource("Takeout/Keep/Labels.txt", "Rodzina\nWażne"),
    ]);
    expect(plan.notes.map((n) => n.title).sort()).toEqual(["Urodziny", "Zakupy"]);
    expect(plan.counts).toMatchObject({ keep: 2, duplicates: 1, trashed: 1, ignored: 1, failed: 0 });
    expect(plan.labels).toEqual(["Rodzina", "Ważne"]);
    expect(plan.folders).toEqual([]);
  });

  it("załączniki: obraz z paczki jest dołączony, brakujący i nieobrazkowy dają ostrzeżenia", async () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const withBytes = await buildImportPlan([
      memorySource("Keep/Paragon.json", KEEP_IMAGE_JSON),
      memorySource("Keep/paragon.jpg", jpg),
    ]);
    expect(withBytes.imageCount).toBe(1);
    expect(withBytes.notes[0].images).toHaveLength(1);
    expect(withBytes.warnings.join(" ")).toContain("innych niż obrazy");
    expect(withBytes.warnings.join(" ")).not.toContain("nie ma w wybranych");

    const without = await buildImportPlan([memorySource("Keep/Paragon.json", KEEP_IMAGE_JSON)]);
    // Notatka ma tylko tytuł, więc zostaje; obrazu brak i jest o tym ostrzeżenie.
    expect(without.notes).toHaveLength(1);
    expect(without.imageCount).toBe(0);
    expect(without.warnings.join(" ")).toContain("nie ma w wybranych");
  });

  it("uszkodzony plik nie przerywa reszty; obcy JSON i ukryte foldery są pomijane", async () => {
    const plan = await buildImportPlan([
      memorySource("Keep/zly.json", "{ucięty"),
      memorySource("Keep/ok.json", KEEP_LIST_JSON),
      memorySource("Vault/.obsidian/app.json", JSON.stringify({ title: "x", color: "RED" })),
      memorySource("Keep/config.json", JSON.stringify({ a: 1 })),
    ]);
    expect(plan.notes).toHaveLength(1);
    expect(plan.counts.failed).toBe(1);
    expect(plan.failures[0].path).toBe("Keep/zly.json");
    expect(plan.warnings.join(" ")).toContain("nie wygląda na notatki Google Keep");
  });

  it("pomija duplikaty względem istniejących notatek i w paczce", async () => {
    const existing = [{ title: "Zakupy", content: "", checklist: [{ text: "mleko" }, { text: "chleb" }], createdAt: 1699990000000 }];
    const plan = await buildImportPlan([
      memorySource("a/Zakupy.json", KEEP_LIST_JSON),
      memorySource("a/Urodziny.json", KEEP_TEXT_JSON),
      memorySource("b/Urodziny kopia.json", KEEP_TEXT_JSON),
    ], existing);
    expect(plan.notes.map((n) => n.title)).toEqual(["Urodziny"]);
    expect(plan.counts.duplicates).toBe(2);
  });
});

describe("buildImportPlan — Markdown", () => {
  it("podkatalogi → foldery, korzeń wybranego folderu jest pomijany", async () => {
    const plan = await buildImportPlan([
      memorySource("Vault/Plan projektu.md", OBSIDIAN_NOTE),
      memorySource("Vault/Prywatne/Pomysł.md", MD_PLAIN_NOTE, 1700000000000),
      memorySource("Vault/Prywatne/Głębiej/Jeszcze/Dalej/Zbyt.md", "treść"),
    ]);
    expect(plan.counts.markdown).toBe(3);
    const byTitle = Object.fromEntries(plan.notes.map((n) => [n.title, n.folderPath]));
    expect(byTitle["Plan projektu"]).toEqual([]);
    expect(byTitle["Pomysł"]).toEqual(["Prywatne"]);
    expect(byTitle["Zbyt"]).toEqual(["Prywatne", "Głębiej", "Jeszcze / Dalej"]);
    expect(plan.folders).toHaveLength(2);
    expect(plan.labels).toEqual(["pilne", "praca"]);
  });

  it("pojedynczy plik .md bez folderu; pusty plik zachowuje tytuł z nazwy", async () => {
    const plan = await buildImportPlan([memorySource("n.md", "treść"), memorySource("pusty.md", "")]);
    expect(plan.notes).toHaveLength(2);
    expect(plan.notes[0].folderPath).toEqual([]);
    expect(plan.notes[1].title).toBe("pusty");
  });

  it("ostrzega o osadzonych obrazach i honoruje limit rozmiaru pliku", async () => {
    const big = memorySource("duzy.md", "x");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    const plan = await buildImportPlan([memorySource("a.md", "![[foto.png]]\ntekst"), big]);
    expect(plan.warnings.join(" ")).toContain("osadzonych obrazów");
    expect(plan.counts.failed).toBe(1);
  });
});
