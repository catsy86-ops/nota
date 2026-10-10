import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYjsStore } from "./yjsStore";
import { safeString, safeStringArray, safeEnum, safeNumber } from "./safeProjection";

/** Peer pisze wprost do Y.Map — dokładnie to, co zrobiłby złośliwy klient y-webrtc. */
function hostileNote(store: ReturnType<typeof createYjsStore>, id: string, fields: Record<string, unknown>) {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(fields)) y.set(k, v);
  store.doc.transact(() => { store.notesMap.set(id, y as Y.Map<unknown>); }, "peer");
}

describe("projekcja danych od peera (A01/A08)", () => {
  it("zły typ pola daje wartość domyślną, nie wyjątek ani obiekt w UI", () => {
    const store = createYjsStore(`hostile-${crypto.randomUUID()}`);
    hostileNote(store, "x", {
      title: { evil: true }, content: 42, color: "url(javascript:alert(1))", pinned: "yes",
      trashedAt: "never", labels: [{ a: 1 }, "ok", 5], reminder: NaN, priority: "ultra",
      imageHashes: [{}, "a".repeat(64)], folderId: 12, order: "1", createdAt: {}, updatedAt: null,
      reminderRepeat: "hourly", reminderDay: 99, dailyDate: "<script>", checklist: "nie mapa",
    });
    const [n] = store.projectNotes();
    expect(n.title).toBe("");
    expect(n.content).toBe("");
    expect(n.color).toBe("default");
    expect(n.pinned).toBe(false);
    expect(n.trashedAt).toBeNull();
    expect(n.labels).toEqual(["ok"]);
    expect(n.reminder).toBeNull();
    expect(n.priority).toBe("none");
    expect(n.images).toEqual(["a".repeat(64)]);
    expect(n.folderId).toBeNull();
    expect(n.order).toBe(0);
    expect(n.createdAt).toBe(0);
    expect(n.reminderRepeat).toBeUndefined();
    expect(n.reminderDay).toBeUndefined();
    expect(n.dailyDate).toBeUndefined();
    expect(n.checklist).toEqual([]);
  });

  it("legacy tablica checklisty: elementy nie-obiekty i bez id odpadają", () => {
    const store = createYjsStore(`hostile-cl-${crypto.randomUUID()}`);
    hostileNote(store, "x", { checklist: [{ id: "1", text: { x: 1 }, checked: 1 }, null, "s", { text: "bez id" }] });
    expect(store.projectNotes()[0].checklist).toEqual([{ id: "1", text: "", checked: false }]);
  });

  it("pole locked bez poprawnego szyfrogramu nie czyni notatki prywatną", () => {
    const store = createYjsStore(`hostile-lock-${crypto.randomUUID()}`);
    hostileNote(store, "a", { locked: true, vault: { not: "a string" }, title: "jawny" });
    const [n] = store.projectNotes();
    expect(n.locked).toBeUndefined();
    expect(n.title).toBe("jawny");
  });

  it("notatka prywatna: projekcja zawsze pusta, nawet gdy peer dopisał jawne pola", () => {
    const store = createYjsStore(`hostile-priv-${crypto.randomUUID()}`);
    hostileNote(store, "a", { locked: true, vault: "v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB", title: "sekret", labels: ["tajna"], imageHashes: ["a".repeat(64)] });
    const [n] = store.projectNotes();
    expect(n.locked).toBe(true);
    expect(n.title).toBe("");
    expect(n.content).toBe("");
    expect(n.labels).toEqual([]);
    expect(n.images).toEqual([]);
  });

  it("folder od peera: zły typ nazwy/koloru/emoji", () => {
    const store = createYjsStore(`hostile-f-${crypto.randomUUID()}`);
    const y = new Y.Map<unknown>();
    y.set("name", ["x"]); y.set("color", "evil"); y.set("emoji", { a: 1 }); y.set("parentId", 5); y.set("order", Infinity); y.set("createdAt", "x");
    store.doc.transact(() => { store.foldersMap.set("f", y as Y.Map<unknown>); }, "peer");
    const [f] = store.projectFolders();
    expect(f).toMatchObject({ id: "f", name: "", color: "default", emoji: null, parentId: null, order: 0, createdAt: 0, updatedAt: 0 });
  });

  it("ogranicza długość tytułu i liczbę etykiet", () => {
    const store = createYjsStore(`hostile-big-${crypto.randomUUID()}`);
    hostileNote(store, "x", { title: "t".repeat(100_000), labels: Array.from({ length: 5000 }, (_, i) => `l${i}`) });
    const [n] = store.projectNotes();
    expect(n.title.length).toBe(20_000);
    expect(n.labels.length).toBe(200);
  });
});

describe("safeProjection", () => {
  it("helpery", () => {
    expect(safeString(1, "d")).toBe("d");
    expect(safeString("abcdef", "", 3)).toBe("abc");
    expect(safeStringArray("x", 5, 5)).toEqual([]);
    expect(safeEnum("z", ["a", "b"] as const, "a")).toBe("a");
    expect(safeNumber(Infinity, 7)).toBe(7);
  });
});
