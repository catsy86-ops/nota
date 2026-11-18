import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import { GC_GRACE_MS } from "@/lib/imageStore";
import { resetStudyForTests } from "@/lib/study/data";
import { addJournalEntry, setProblemFault } from "@/lib/study/journalActions";
import { saveSiteCard, setSiteDocs, setSiteSignature } from "@/lib/study/siteActions";
import { createPlan } from "@/lib/plans/plansStore";
import type { Note } from "@/lib/types/note";

/**
 * Z-6 (punkty 1–2, `docs/zlecenia-fable-2026-11-15.md` zadanie 6): każdy plik zapisujący do `imageStore` ma czytelnika
 * w liście odśmiecania (`yjsStore.referencedImages()` i — dla stanu lokalnego urządzenia — `journalImageRefs()`).
 *
 * Test statyczny: nowy plik z `putBlob`/`putBytes`/`putDataUrl` wywala test, dopóki ktoś nie dopisze go do `WRITERS`
 * razem ze ścieżką odczytu (i, gdy to nowa struktura danych, przypadku w teście dynamicznym niżej).
 */
const WRITERS: Record<string, string> = {
  "src/components/AddNoteBar.tsx": "notatka: imageHashes (szkic tylko w stanie Reacta, chroni go karencja)",
  "src/components/NoteReader.tsx": "notatka: imageHashes",
  "src/hooks/useNoteImages.ts": "notatka: imageHashes",
  "src/lib/attachments.ts": "notatka: attachments; dokumenty budowy (PDF)",
  "src/lib/import/commit.ts": "notatka: imageHashes",
  "src/lib/shareInbox.ts": "notatka: imageHashes (skrzynka udostępniania)",
  "src/lib/imageSync.ts": "obrazy wskazane przez manifest innego urządzenia (syncableRefs)",
  "src/lib/sync/relayBlobs.ts": "obrazy wskazane przez manifest (syncableRefs)",
  "src/lib/plans/imageImport.ts": "analiza planu: image/work (planRefsIn)",
  "src/components/study/JournalEntrySheet.tsx": "wpis dziennika: images (szkic: journalImageRefs)",
  "src/components/study/PhotoDayDialog.tsx": "wpis dziennika: images",
  "src/components/study/SitePointsPanel.tsx": "wpis dziennika: images (punkt)",
  "src/components/study/SiteFaultsPanel.tsx": "wpis dziennika: after (usterka)",
  "src/components/study/SiteDocsPanel.tsx": "dokumenty budowy: studySiteItems docs",
  "src/components/study/SiteSignatureDialog.tsx": "karta budowy: signature.image",
  "src/components/study/useJournalPhotoEdits.ts": "wpis dziennika: images/drawnFrom (edycja: journalImageRefs)",
  "src/lib/study/photoEntry.ts": "wpis dziennika: images",
  "src/lib/study/photoShrink.ts": "wpis dziennika: images (podmiana na mniejsze)",
  "src/lib/study/siteDocsAdd.ts": "dokumenty budowy: studySiteItems docs",
  "src/lib/study/sitePackageIo.ts": "paczka budowy: wpisy, dokumenty, podpis",
  "src/lib/debts/store.ts": "dowód długu: mapa debtProofs (debtProofRefsIn)",
};

const ROOT = resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("Z-6.2: lista plików zapisujących obrazy", () => {
  it("zgadza się z zatwierdzoną listą (nowy zapis wymaga czytelnika w odśmiecaniu)", () => {
    const found = sourceFiles(join(ROOT, "src"))
      .filter((p) => /\.(putBlob|putBytes|putDataUrl)\(/.test(readFileSync(p, "utf8")))
      .map((p) => relative(ROOT, p).replace(/\\/g, "/"))
      .filter((p) => p !== "src/lib/imageStore.ts")
      .sort();
    expect(found).toEqual(Object.keys(WRITERS).sort());
  });
});

const bytes = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) & 0xff);

function note(id: string, overrides: Partial<Note>): Note {
  return {
    id, title: "T", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}

describe("Z-6.1: każdy zapis ma czytelnika — bajty przeżywają odśmiecanie po karencji", () => {
  let seed = 0;
  const put = () => yjsStore.images.putBytes(bytes(++seed), "image/png");
  /** Odśmiecanie tak jak w `useNotes` (bez stanu lokalnego dziennika — ten osobno w `study/images.test.ts`). */
  const survives = async (ref: string) => {
    const removed = await yjsStore.images.collectGarbage(yjsStore.referencedImages(), Date.now() + GC_GRACE_MS + 24 * 3600_000);
    expect(removed).toBe(0);
    expect(yjsStore.images.has(ref)).toBe(true);
  };

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 18, 12));
    await yjsStore.resetForTests();
    await yjsStore.images.resetForTests();
    await yjsStore.ready();
    resetStudyForTests();
  });
  afterEach(() => vi.useRealTimers());

  it("kontrola: obraz bez czytelnika jest usuwany", async () => {
    // Bezpiecznik (`collectGarbage`) chroni, gdy kandydatów > połowa i > 20 — jeden plik spokojnie przechodzi.
    const ref = await put();
    expect(await yjsStore.images.collectGarbage(yjsStore.referencedImages(), Date.now() + GC_GRACE_MS + 1)).toBe(1);
    expect(yjsStore.images.has(ref)).toBe(false);
  });

  it("notatka: obraz (AddNoteBar, NoteReader, useNoteImages, import, skrzynka)", async () => {
    const ref = await put();
    yjsStore.upsertNote(note("n1", { images: [ref] }));
    await survives(ref);
  });

  it("notatka: załącznik (attachments)", async () => {
    const ref = await put();
    yjsStore.upsertNote(note("n2", { attachments: [{ hash: ref, name: "a.pdf", type: "application/pdf", size: 64 }] } as Partial<Note>));
    await survives(ref);
  });

  it("wpis dziennika: zdjęcie (photoEntry, PhotoDayDialog, punkty, JournalEntrySheet)", async () => {
    const ref = await put();
    expect(addJournalEntry({ kind: "ok", topic: null, text: "", images: [ref] })).not.toBeNull();
    await survives(ref);
  });

  it("usterka: zdjęcie po naprawie (SiteFaultsPanel)", async () => {
    const entry = addJournalEntry({ kind: "problem", topic: null, text: "Przeciek", images: [] });
    expect(entry).not.toBeNull();
    const ref = await put();
    setProblemFault(entry!.id, { after: [ref] });
    await survives(ref);
  });

  it("dokument budowy (siteDocsAdd, SiteDocsPanel) i podpis klienta (SiteSignatureDialog)", async () => {
    expect(saveSiteCard("s1", { name: "Budowa", address: "", investor: "" })).toBe(true);
    const doc = await put();
    setSiteDocs("s1", [{ id: doc, name: "plan.png", size: 64, type: "image/png", at: Date.now() }]);
    const sig = await put();
    setSiteSignature("s1", { image: sig, name: "Jan", at: Date.now() });
    await survives(doc);
    await survives(sig);
  });

  it("analiza planu: oryginał i kopia robocza (imageImport)", async () => {
    const image = await put();
    const work = await put();
    const img = (ref: string) => ({ ref, type: "image/png" as const, size: 64, w: 10, h: 10 });
    expect(createPlan("Plan", img(image), img(work))).not.toBeNull();
    await survives(image);
    await survives(work);
  });

  it("dowód długu (DebtProof, attachDebtProof)", async () => {
    const ref = await put();
    yjsStore.doc.getMap("debts").set("d1", { id: "d1", person: "Ola", kind: "lent", amount: 100, at: "2026-11-18", note: "", created: 1 });
    yjsStore.doc.getMap("debtProofs").set("d1", { ref, at: Date.now() });
    await survives(ref);
  });

  // Zablokowany skarbiec: notatka prywatna nie może mieć plików — `lockNote` odmawia `has-files`
  // (`privateNotes.test.ts`), więc szyfrogram nigdy nie ukrywa odwołań przed odśmiecaniem.
});
