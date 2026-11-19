import { it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as Y from "yjs";
import { createYjsStore } from "@/lib/yjsStore";
import { SCHEMA_VERSION } from "@/lib/formatSchema";

/**
 * Generator wzorców dokumentu (D3.1, `docs/plan-migracje-yjs-2026-11-15.md`). Uruchamiany ręcznie, także w starym
 * commicie (`scripts/doc-fixture.ps1 <wersja> <commit>`), więc używa tylko API `createYjsStore` dostępnego od 2026-10:
 *   GEN_DOC_FIXTURE=1 npx vitest run src/test/fixtures/docs/generate.test.ts
 * Zapisuje `src/test/fixtures/docs/<SCHEMA_VERSION>.update` (albo do `GEN_DOC_FIXTURE_OUT`). Dane syntetyczne.
 */
const T0 = 1_760_000_000_000;

function note(id: string, over: Record<string, unknown> = {}) {
  return {
    id, title: `Notatka ${id}`, content: `Treść ${id}\n\n- punkt`, color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [],
    folderId: null, order: 0, createdAt: T0, updatedAt: T0, ...over,
  };
}

it.skipIf(!process.env.GEN_DOC_FIXTURE)("generuje wzorzec dokumentu dla bieżącej wersji formatu", () => {
  const store = createYjsStore(`doc-fixture-${crypto.randomUUID()}`);
  store.doc.clientID = 1001;
  store.upsertFolder({ id: "f1", name: "Praca", color: "default", emoji: null, parentId: null, order: 0, createdAt: T0 } as never);
  store.upsertFolder({ id: "f2", name: "Budowa", color: "default", emoji: "🏗", parentId: "f1", order: 0, createdAt: T0 } as never);
  for (const l of ["dom", "dom/kuchnia", "pilne"]) store.addLabel(l);
  store.upsertNote(note("n1", { title: "Zakupy", labels: ["dom"], pinned: true }) as never);
  store.upsertNote(note("n2", { folderId: "f2", labels: ["pilne", "dom/kuchnia"], priority: "high", order: 1 }) as never);
  store.upsertNote(note("n3", { checklist: [{ id: "c1", text: "rury", checked: true }, { id: "c2", text: "kształtki", checked: false, indent: 1 }] }) as never);
  store.upsertNote(note("n4", { archived: true, color: "sand" }) as never);
  store.upsertNote(note("n5", { trashed: true, trashedAt: T0 + 1000 }) as never);
  store.upsertNote(note("n6", { title: "Zażółć gęślą jaźń", content: "[[Zakupy]] ^blok1" }) as never);
  const out = process.env.GEN_DOC_FIXTURE_OUT ?? resolve(process.cwd(), `src/test/fixtures/docs/${SCHEMA_VERSION}.update`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Y.encodeStateAsUpdate(store.doc));
});
