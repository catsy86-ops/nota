import { beforeEach, describe, expect, it } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import { isImageRef } from "@/lib/imageStore";
import { commitImportPlan, undoImport } from "./commit";
import { buildImportPlan } from "./plan";
import { memorySource } from "./collect";
import { KEEP_IMAGE_JSON, KEEP_LIST_JSON, KEEP_TEXT_JSON, OBSIDIAN_NOTE, MD_PLAIN_NOTE } from "./__fixtures__/samples";

beforeEach(async () => {
  await yjsStore.ready();
  await yjsStore.resetForTests();
  await yjsStore.ready();
});

describe("commitImportPlan", () => {
  it("zapisuje notatki z oryginalnymi czasami, etykietami, folderami i obrazami; cofnięcie sprząta", async () => {
    const plan = await buildImportPlan([
      memorySource("Keep/Urodziny.json", KEEP_TEXT_JSON),
      memorySource("Keep/Zakupy.json", KEEP_LIST_JSON),
      memorySource("Keep/Paragon.json", KEEP_IMAGE_JSON),
      memorySource("Keep/paragon.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])),
      memorySource("Vault/Plan projektu.md", OBSIDIAN_NOTE),
      memorySource("Vault/Prywatne/Pomysł.md", MD_PLAIN_NOTE, 1700000000000),
    ]);
    // Różne katalogi główne => brak wspólnego korzenia do pominięcia (foldery tylko z plików Markdown).
    const result = await commitImportPlan(plan);
    expect(result.noteIds).toHaveLength(plan.notes.length);
    expect(result.imageCount).toBe(1);

    const notes = yjsStore.projectNotes();
    const urodziny = notes.find((n) => n.title === "Urodziny")!;
    expect(urodziny.createdAt).toBe(1615982591000);
    expect(urodziny.updatedAt).toBe(1616000000000);
    expect(urodziny.pinned).toBe(true);
    expect(urodziny.color).toBe("sand");
    expect(urodziny.labels).toEqual(["Rodzina", "Ważne"]);
    const zakupy = notes.find((n) => n.title === "Zakupy")!;
    expect(zakupy.archived).toBe(true);
    expect(zakupy.checklist.map((c) => [c.text, c.checked])).toEqual([["mleko", true], ["chleb", false]]);
    const paragon = notes.find((n) => n.title === "Paragon")!;
    expect(paragon.images).toHaveLength(1);
    expect(isImageRef(paragon.images[0])).toBe(true);
    expect(yjsStore.projectLabels()).toEqual(expect.arrayContaining(["Rodzina", "Ważne", "praca", "pilne"]));

    undoImport(result);
    expect(yjsStore.projectNotes()).toHaveLength(0);
    expect(yjsStore.projectFolders()).toHaveLength(0);
    expect(yjsStore.projectLabels()).toHaveLength(0);
  });

  it("ponownie używa istniejącego folderu i nie usuwa go przy cofnięciu", async () => {
    const now = Date.now();
    yjsStore.upsertFolder({ id: "f1", name: "prywatne", color: "default", emoji: null, parentId: null, order: 0, createdAt: now });
    const plan = await buildImportPlan([
      memorySource("Vault/Prywatne/Pomysł.md", MD_PLAIN_NOTE),
      memorySource("Vault/Inne/Coś.md", "tekst"),
    ]);
    const result = await commitImportPlan(plan);
    expect(yjsStore.projectFolders().map((f) => f.name).sort()).toEqual(["Inne", "prywatne"]);
    expect(yjsStore.projectNotes().find((n) => n.title === "Pomysł")!.folderId).toBe("f1");
    undoImport(result);
    expect(yjsStore.projectFolders().map((f) => f.id)).toEqual(["f1"]);
  });
});

describe("commitImportPlan — właściwości z frontmattera props", () => {
  const ZAKUPY = '---\ntitle: "Zakupy"\nprops: {"Cena": "12,50", "Termin": "2026-03-01", "Status": "w toku"}\n---\nTreść';
  const INNE = '---\ntitle: "Inne"\nprops: {"cena": "7", "Status": "nieznany"}\n---\nx';

  it("dopasowuje pola po nazwie, wnioskuje typy nowych i pomija wartości spoza opcji; cofnięcie usuwa tylko nowe pola", async () => {
    yjsStore.upsertPropDef({ id: "st1", name: "Status", type: "select", options: ["w toku", "zamknięte"], order: 0 });
    const plan = await buildImportPlan([
      memorySource("Vault/Zakupy.md", ZAKUPY),
      memorySource("Vault/Inne.md", INNE),
    ]);
    const result = await commitImportPlan(plan);
    expect(result.createdPropDefIds).toHaveLength(2);

    const defs = yjsStore.projectPropDefs();
    const cena = defs.find((d) => d.name === "Cena")!;
    expect(cena.type).toBe("number");
    expect(defs.find((d) => d.name === "Termin")!.type).toBe("date");
    expect(defs.find((d) => d.name === "Status")!.id).toBe("st1");
    expect(defs.filter((d) => d.name.toLowerCase() === "cena")).toHaveLength(1);

    const notes = yjsStore.projectNotes();
    const zakupy = notes.find((n) => n.title === "Zakupy")!;
    expect(zakupy.props).toEqual({ [cena.id]: 12.5, [defs.find((d) => d.name === "Termin")!.id]: "2026-03-01", st1: "w toku" });
    const inne = notes.find((n) => n.title === "Inne")!;
    expect(inne.props).toEqual({ [cena.id]: 7 });

    undoImport(result);
    expect(yjsStore.projectPropDefs().map((d) => d.id)).toEqual(["st1"]);
  });

  it("nie usuwa nowego pola, jeśli notatka spoza importu ma w nim wartość", async () => {
    const keep = await commitImportPlan(await buildImportPlan([memorySource("Vault/Pomysł.md", MD_PLAIN_NOTE)]));
    const result = await commitImportPlan(await buildImportPlan([memorySource("Vault/Zakupy.md", ZAKUPY)]));
    const cena = yjsStore.projectPropDefs().find((d) => d.name === "Cena")!;
    yjsStore.patchNote(keep.noteIds[0], { props: { [cena.id]: 99 } });
    undoImport(result);
    expect(yjsStore.projectPropDefs().map((d) => d.id)).toContain(cena.id);
  });
});
