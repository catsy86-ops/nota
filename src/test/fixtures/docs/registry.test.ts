import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Y from "yjs";
import { createYjsStore } from "@/lib/yjsStore";
import { DOC_MIGRATIONS } from "@/lib/migrations/registry";
import { runDocMigrations, type RunnerDeps } from "@/lib/migrations/runner";

/**
 * D3.2: wzorzec każdej wydanej wersji formatu przechodzi przez cały rejestr migracji (`DOC_MIGRATIONS`) i potem
 * czyta się bez utraty. Dziś rejestr jest pusty — test jest siatką: każda dopisana migracja dokumentu od razu przechodzi
 * przez wszystkie wzorce. Do tego: `check` każdej migracji przechodzi, a drugi przebieg niczego nie robi (znaczniki).
 */
const DIR = resolve(process.cwd(), "src/test/fixtures/docs");
const versions = readdirSync(DIR).filter((f) => /^\d+\.update$/.test(f)).map((f) => Number(f.split(".")[0])).sort((a, b) => a - b);

function deps(): RunnerDeps {
  const fails = new Map<string, number>();
  return {
    lock: (fn) => fn(),
    snapshot: async () => {},
    failures: { get: (id) => fails.get(id) ?? 0, set: (id, n) => { fails.set(id, n); } },
    log: () => {},
    version: "test",
  };
}

describe("wzorce dokumentu przez rejestr migracji (D3.2)", () => {
  it.each(versions)("wersja %i → bieżąca: wszystkie migracje zrobione, check czysty, drugi przebieg pusty, dane całe", async (v) => {
    const store = createYjsStore(`fixture-reg-${v}-${crypto.randomUUID()}`);
    Y.applyUpdate(store.doc, new Uint8Array(readFileSync(resolve(DIR, `${v}.update`))));
    const before = store.projectNotes().map((n) => n.id).sort();

    const first = await runDocMigrations(store.doc, DOC_MIGRATIONS, deps());
    expect(first.failed).toEqual([]);
    for (const m of DOC_MIGRATIONS) expect(m.check(store.doc), m.id).toBeNull();
    const second = await runDocMigrations(store.doc, DOC_MIGRATIONS, deps());
    expect(second.done).toEqual([]);

    expect(store.projectNotes().map((n) => n.id).sort()).toEqual(before);
    expect(before).toEqual(["n1", "n2", "n3", "n4", "n5", "n6"]);
    expect(store.projectFolders().map((f) => f.id).sort()).toEqual(["f1", "f2"]);
    expect(store.projectLabels()).toEqual(expect.arrayContaining(["dom", "dom/kuchnia", "pilne"]));
  });
});
