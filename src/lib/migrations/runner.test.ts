import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { DOC_MIGRATIONS, DOC_MIGRATIONS_MAP, LOCAL_MIGRATIONS, MIGRATION_ID_RE, isMigrationOrigin, type DocMigration } from "./registry";
import { MAX_FAILURES, runDocMigrations } from "./runner";

/** Wzorzec „zmiana nazwy pola”: kopiuj `old` → `neu`, stare zostaje (zasada 2). */
const rename: DocMigration = {
  id: "2026-11-rename-test",
  scope: "dokument",
  description: "test",
  since: 3,
  run: (doc) => {
    const m = doc.getMap<Record<string, unknown>>("items");
    m.forEach((v, k) => { if (v.neu === undefined) m.set(k, { ...v, neu: v.old }); });
  },
  check: (doc) => {
    let bad: string | null = null;
    doc.getMap<Record<string, unknown>>("items").forEach((v, k) => { if (v.neu === undefined) bad = k; });
    return bad ? `brak neu w ${bad}` : null;
  },
};

function deps(over: Partial<Parameters<typeof runDocMigrations>[2]> = {}) {
  const fails: Record<string, number> = {};
  return {
    fails,
    d: {
      lock: <T,>(fn: () => Promise<T>) => fn(),
      snapshot: vi.fn(async () => {}),
      failures: { get: (id: string) => fails[id] ?? 0, set: (id: string, n: number) => { fails[id] = n; } },
      log: vi.fn(),
      onGiveUp: vi.fn(),
      now: () => 1000,
      version: "test",
      ...over,
    },
  };
}

function seeded() {
  const doc = new Y.Doc();
  doc.getMap("items").set("a", { old: 1 });
  doc.getMap("items").set("b", { old: 2 });
  return doc;
}

describe("rejestr migracji (D2.1, D2.3)", () => {
  it("poprawne, unikalne identyfikatory", () => {
    const ids = [...DOC_MIGRATIONS, ...LOCAL_MIGRATIONS].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(MIGRATION_ID_RE);
  });
});

describe("wykonawca migracji (D2.2)", () => {
  it("migruje przez kopię roboczą, jednym update z origin migration:<id>, ze znacznikiem i migawką", async () => {
    const doc = seeded();
    const origins: unknown[] = [];
    doc.on("update", (_u: Uint8Array, origin: unknown) => origins.push(origin));
    const { d } = deps();
    const r = await runDocMigrations(doc, [rename], d);
    expect(r.done).toEqual([rename.id]);
    expect(d.snapshot).toHaveBeenCalledOnce();
    expect(origins).toEqual(["migration:2026-11-rename-test"]);
    expect(isMigrationOrigin(origins[0])).toBe(true);
    expect(doc.getMap("items").get("a")).toEqual({ old: 1, neu: 1 });
    expect(doc.getMap(DOC_MIGRATIONS_MAP).get(rename.id)).toEqual({ at: 1000, version: "test" });
  });

  it("drugie uruchomienie nic nie robi — bez blokady i migawki", async () => {
    const doc = seeded();
    await runDocMigrations(doc, [rename], deps().d);
    const lock = vi.fn((fn: () => Promise<unknown>) => fn());
    const { d } = deps({ lock: lock as never });
    expect((await runDocMigrations(doc, [rename], d)).done).toEqual([]);
    expect(lock).not.toHaveBeenCalled();
    expect(d.snapshot).not.toHaveBeenCalled();
  });

  it("błąd na kopii nie zmienia żywego dokumentu; po 3 porażkach rezygnacja", async () => {
    const broken: DocMigration = { ...rename, id: "2026-11-broken", run: (doc) => { doc.getMap("items").set("a", { zepsute: true }); throw new Error("x"); } };
    const doc = seeded();
    const before = Y.encodeStateAsUpdate(doc);
    const { d, fails } = deps();
    for (let i = 0; i < MAX_FAILURES; i++) expect((await runDocMigrations(doc, [broken], d)).failed).toEqual([broken.id]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(fails[broken.id]).toBe(MAX_FAILURES);
    expect(d.onGiveUp).toHaveBeenCalledWith(broken.id);
    expect((await runDocMigrations(doc, [broken], d)).skipped).toEqual([broken.id]);
  });

  it("nieudane sprawdzenie też nic nie zapisuje", async () => {
    const lying: DocMigration = { ...rename, id: "2026-11-lying", run: () => {} };
    const doc = seeded();
    const before = Y.encodeStateAsUpdate(doc);
    expect((await runDocMigrations(doc, [lying], deps().d)).failed).toEqual([lying.id]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it("bez migawki brak migracji", async () => {
    const doc = seeded();
    const { d } = deps({ snapshot: vi.fn(async () => { throw new Error("brak OPFS"); }) });
    const r = await runDocMigrations(doc, [rename], d);
    expect(r.done).toEqual([]);
    expect(doc.getMap(DOC_MIGRATIONS_MAP).size).toBe(0);
  });

  it("D3.3: dwa urządzenia migrują niezależnie — po wymianie stan identyczny, edycja z międzyczasu zostaje", async () => {
    const a = seeded();
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    b.getMap("items").set("c", { old: 3 });
    await runDocMigrations(a, [rename], deps().d);
    await runDocMigrations(b, [rename], deps().d);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(a.getMap("items").toJSON()).toEqual(b.getMap("items").toJSON());
    expect(a.getMap("items").toJSON()).toMatchObject({ a: { old: 1, neu: 1 }, b: { old: 2, neu: 2 } });
    expect(a.getMap("items").get("c")).toMatchObject({ old: 3 });
    expect(a.getMap(DOC_MIGRATIONS_MAP).has(rename.id)).toBe(true);
  });
});
