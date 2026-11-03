import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createYjsStore } from "./yjsStore";
import { clearAllStorage } from "@/lib/notesStore";
import { fallbackRepeat } from "@/lib/reminderRepeat";
import { REMINDER_FIELDS } from "@/lib/reminderSpec";
import { createYStudy, type JournalEntry } from "@/lib/study/yStudy";
import type { Note } from "@/hooks/useNotes";

/**
 * Zgodność danych ze starszą wersją (Plan-nowy 1.4). Dokument pisze bieżący kod, a „starsza wersja”
 * to drugi Y.Doc, który zmienia dane tak jak dawny kod: surowymi operacjami Yjs na znanych sobie polach.
 * Po wymianie stanu nic nie może zginąć poza wyjątkami opisanymi w testach `wyjątek:`.
 *
 * Wersje odtworzone z historii:
 * - przed Terminy 3.2 (b1beade): `reminderSpec` bez `reminderLead`,
 * - przed Terminy 3.1 (01c9ac8): `reminderSpec` bez `reminderRule`,
 * - przed 9020901: zapis wpisu dziennika kasował każde pole spoza swojej listy (dlatego od tej wersji kasuje tylko znane).
 */

/** Dwa urządzenia i wymiana stanu w obie strony. */
function link(a: Y.Doc, b: Y.Doc) {
  return () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Rewizja", content: "Treść", color: "sky", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: ["budowa"], reminder: null, priority: "high", images: [],
    checklist: [{ id: "c1", text: "Klej", checked: false }], folderId: null, order: 3, createdAt: 1, updatedAt: 1,
    ...overrides,
  };
}

/** Notatka ze wszystkimi nowszymi polami, jakie zna ta wersja. */
const RICH: Partial<Note> = {
  reminder: new Date(2026, 10, 4, 7, 0).getTime(),
  reminderRule: { kind: "weekdays", days: [1, 3] },
  reminderLead: 60,
  aliases: ["Pion"],
  icon: "🔧",
  cover: "paper",
  favorite: true,
  wide: true,
  parentId: "rodzic",
  attachments: [{ hash: "a".repeat(64), name: "faktura.pdf", type: "application/pdf", size: 10 }],
};

/** Zmiana terminu tak, jak robiła ją wersja znająca tylko `known` pola przypomnienia (dawny `mergeSpec`). */
function olderSetReminder(y: Y.Map<unknown>, known: readonly string[], reminder: number) {
  const raw = (y.get("reminderSpec") ?? {}) as Record<string, unknown>;
  const spec: Record<string, unknown> = {};
  for (const k of known) if (raw[k] !== undefined) spec[k] = raw[k];
  spec.reminder = reminder;
  delete spec.reminderBase;
  y.doc!.transact(() => {
    y.set("reminder", reminder);
    y.set("reminderSpec", spec);
  });
}

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
});

describe("zgodność notatek ze starszą wersją", () => {
  function setup() {
    const store = createYjsStore(`compat-${crypto.randomUUID()}`);
    store.upsertNote(makeNote(RICH));
    const older = new Y.Doc();
    const sync = link(store.doc, older);
    sync();
    const yNote = older.getMap<Y.Map<unknown>>("notes").get("n1")!;
    const project = () => store.projectNotes().find((n) => n.id === "n1")!;
    return { store, sync, yNote, project };
  }

  it("zmiana tytułu, przypięcia i listy w starszej wersji nie gubi nowszych pól", () => {
    const { sync, yNote, project } = setup();
    const before = project();
    expect(before.reminderLead).toBe(60);
    expect(before.attachments).toHaveLength(1);

    // Dawny `patchNote`: pole po polu na tej samej Y.Map.
    yNote.doc!.transact(() => {
      yNote.set("title", "Rewizja — po zmianie");
      yNote.set("pinned", true);
      yNote.set("updatedAt", 2);
      (yNote.get("checklist") as Y.Map<Y.Map<unknown>>).get("c1")!.set("checked", true);
    });
    sync();

    expect(project()).toEqual({
      ...before,
      title: "Rewizja — po zmianie",
      pinned: true,
      updatedAt: 2,
      checklist: [{ ...before.checklist[0], checked: true }],
    });
  });

  it("starsza wersja czyta termin: pola sprzed `reminderSpec` i zapasowy rodzaj powtarzania są aktualne", () => {
    const { store, sync, yNote } = setup();
    const t = new Date(2026, 10, 5, 8, 0).getTime();
    store.patchNote("n1", { reminder: t, reminderRule: { kind: "every", every: 3 } });
    sync();
    // Wersja sprzed `reminderSpec` czyta osobne pola.
    expect(yNote.get("reminder")).toBe(t);
    expect(yNote.get("reminderRepeat")).toBe(fallbackRepeat({ kind: "every", every: 3 }));
    // Wersja z `reminderSpec`, ale bez reguły, bierze z niego termin i zapasowy rodzaj.
    const spec = yNote.get("reminderSpec") as Record<string, unknown>;
    expect(spec.reminder).toBe(t);
    expect(spec.reminderRepeat).toBe(fallbackRepeat({ kind: "every", every: 3 }));
  });

  it("wyjątek: zmiana terminu w wersji sprzed Terminy 3.2 zdejmuje wcześniejsze przypomnienie, regułę zostawia", () => {
    const { sync, yNote, project } = setup();
    const t = new Date(2026, 10, 6, 9, 0).getTime();
    olderSetReminder(yNote, REMINDER_FIELDS.filter((f) => f !== "reminderLead"), t);
    sync();
    const after = project();
    expect(after.reminder).toBe(t);
    expect(after.reminderLead).toBeUndefined();
    expect(after.reminderRule).toEqual(RICH.reminderRule);
  });

  it("wyjątek: zmiana terminu w wersji sprzed Terminy 3.1 zdejmuje regułę, ale seria trwa w zapasowym rodzaju", () => {
    const { sync, yNote, project } = setup();
    const t = new Date(2026, 10, 6, 9, 0).getTime();
    olderSetReminder(yNote, REMINDER_FIELDS.filter((f) => f !== "reminderLead" && f !== "reminderRule"), t);
    sync();
    const after = project();
    expect(after.reminder).toBe(t);
    expect(after.reminderRule).toBeUndefined();
    expect(after.reminderRepeat).toBe(fallbackRepeat(RICH.reminderRule!));
  });

  it("pole z nowszej wersji w notatce przetrwa edycję w tej wersji", () => {
    const { store, sync, yNote } = setup();
    yNote.set("futureField", { x: 1 });
    sync();
    store.patchNote("n1", { title: "Nowy", reminder: null, color: "peach" });
    store.patchNote("n1", { checklist: [{ id: "c1", text: "Klej PCV", checked: true }] });
    sync();
    expect(yNote.get("futureField")).toEqual({ x: 1 });
  });
});

describe("zgodność danych Pracy ze starszą wersją", () => {
  const REF_PO = "b".repeat(64);
  const entry = (over: Partial<JournalEntry> = {}): JournalEntry =>
    ({ id: "p1", at: 1000, kind: "problem", topic: null, text: "Przeciek", site: "Lipowa 5", checked: [], images: [], ...over });

  function setup() {
    const doc = new Y.Doc();
    const study = createYStudy(doc);
    const older = new Y.Doc();
    const sync = link(doc, older);
    return { study, older, sync };
  }

  it("pole wpisu z nowszej wersji przetrwa edycję wpisu i usterki w tej wersji", () => {
    const { study, older, sync } = setup();
    study.addEntry(entry());
    sync();
    const raw = older.getMap<Y.Map<unknown>>("studyJournal").get("p1")!;
    raw.set("futureField", "z nowszej wersji");
    sync();

    study.updateEntry({ ...study.get().journal[0], text: "Przeciek pod zlewem" });
    study.setFault("p1", { owner: "Marek", due: "2026-11-10" });
    sync();

    expect(raw.get("futureField")).toBe("z nowszej wersji");
    expect(study.get().journal[0]).toMatchObject({ text: "Przeciek pod zlewem", owner: "Marek", due: "2026-11-10" });
  });

  it("zapis wpisu w wersji z 9020901 (bez pól usterki P2.3) nie kasuje odpowiedzialnego ani terminu", () => {
    const { study, older, sync } = setup();
    study.addEntry(entry());
    study.setFault("p1", { owner: "Marek", due: "2026-11-10", after: [REF_PO] });
    sync();

    // Lista kluczy z 9020901 i jej zapis: kasuje tylko znane pola, których brak w zapisie.
    const KEYS_9020901 = new Set(["id", "at", "kind", "topic", "text", "site", "siteId", "checked", "images", "recordings", "resolved", "solution", "test", "fittings", "stage", "geo"]);
    const raw = older.getMap<Y.Map<unknown>>("studyJournal").get("p1")!;
    const projected: Record<string, unknown> = {};
    for (const k of KEYS_9020901) if (raw.get(k) !== undefined) projected[k] = raw.get(k);
    projected.text = "Przeciek — poprawione na starym telefonie";
    older.transact(() => {
      for (const k of Array.from(raw.keys())) if (projected[k] === undefined && KEYS_9020901.has(k)) raw.delete(k);
      for (const [k, v] of Object.entries(projected)) if (JSON.stringify(raw.get(k)) !== JSON.stringify(v)) raw.set(k, v);
    });
    sync();

    expect(study.get().journal[0]).toMatchObject({
      text: "Przeciek — poprawione na starym telefonie", owner: "Marek", due: "2026-11-10", after: [REF_PO],
    });
  });

  it("pole karty budowy z nowszej wersji przetrwa zapis karty w tej wersji", () => {
    const { study, older, sync } = setup();
    study.saveSite({ id: "s1", name: "Lipowa 5", address: "", investor: "", created: 1 });
    sync();
    const raw = older.getMap<Y.Map<unknown>>("studySites").get("s1")!;
    raw.set("futureField", "z nowszej wersji");
    sync();

    study.saveSite({ ...study.get().sites.s1, investor: "Kowalski" });
    sync();

    expect(raw.get("futureField")).toBe("z nowszej wersji");
    expect(study.get().sites.s1.investor).toBe("Kowalski");
  });

  it("usunięte pole karty znane tej wersji nadal się kasuje", () => {
    const { study } = setup();
    study.saveSite({ id: "s1", name: "Lipowa 5", address: "", investor: "", created: 1, phone: "+48500100200" });
    study.saveSite({ id: "s1", name: "Lipowa 5", address: "", investor: "", created: 1 });
    expect(study.get().sites.s1.phone).toBeUndefined();
  });
});
