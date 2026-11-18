import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYDebts } from "./yDebts";
import { cleanProof, debtProofRefsIn } from "./proofs";
import { sizeCappedRefsIn } from "@/lib/plans/planRefs";

// L4.3 / Z-17.6: zdjęcie dowodu przy wpisie długu.

const REF = "a".repeat(64);
const REF2 = "b".repeat(64);
const entry = { id: "d1", person: "Ola", kind: "lent" as const, amount: 5000, at: "2026-11-18", note: "", created: 1 };

describe("dowody długów", () => {
  it("cleanProof odrzuca zły klucz, zły czas i śmieci", () => {
    expect(cleanProof({ ref: REF, at: 1 })).toEqual({ ref: REF, at: 1 });
    expect(cleanProof({ ref: "../x", at: 1 })).toBeNull();
    expect(cleanProof({ ref: REF, at: -1 })).toBeNull();
    expect(cleanProof(null)).toBeNull();
  });

  it("dowód tylko przy istniejącym wpisie; zamiana i usunięcie", () => {
    const y = createYDebts(new Y.Doc());
    expect(y.setProof("d1", REF)).toBe(false);
    y.add(entry);
    expect(y.setProof("d1", REF, 10)).toBe(true);
    expect(y.proofs().get("d1")).toEqual({ ref: REF, at: 10 });
    y.setProof("d1", REF2, 11);
    expect(y.proofs().get("d1")?.ref).toBe(REF2);
    y.setProof("d1", null);
    expect(y.proofs().has("d1")).toBe(false);
  });

  it("usunięcie wpisu zdejmuje dowód, „Cofnij” go oddaje", () => {
    const doc = new Y.Doc();
    const y = createYDebts(doc);
    y.add(entry);
    y.setProof("d1", REF, 10);
    const prev = y.remove("d1")!;
    expect(debtProofRefsIn(doc).has(REF)).toBe(false);
    y.restore(prev);
    expect(y.proofs().get("d1")).toEqual({ ref: REF, at: 10 });
  });

  it("kopia: zrzut i scalenie tylko do istniejących wpisów bez dowodu", () => {
    const a = createYDebts(new Y.Doc());
    a.add(entry);
    a.setProof("d1", REF, 10);
    const dump = JSON.parse(JSON.stringify(a.dumpProofs()));
    const bDoc = new Y.Doc();
    const b = createYDebts(bDoc);
    b.mergeProofs(dump);
    expect(b.proofs().size).toBe(0);
    b.add(entry);
    b.mergeProofs({ ...dump, obcy: { ref: REF2, at: 1 } });
    expect(b.proofs().get("d1")?.ref).toBe(REF);
    expect(debtProofRefsIn(bDoc).has(REF2)).toBe(false);
  });

  it("dowód z innego urządzenia wychodzi tylko do 2 MB prawdziwego rozmiaru (sizeCappedRefsIn)", () => {
    const doc = new Y.Doc();
    doc.getMap("debts").set("d1", entry);
    doc.getMap("debtProofs").set("d1", { ref: REF, at: 1 });
    expect(sizeCappedRefsIn(doc).has(REF)).toBe(true);
  });

  it("sierota (dowód bez wpisu) nie trzyma pliku i nie jedzie do innych urządzeń", () => {
    const doc = new Y.Doc();
    doc.getMap("debtProofs").set("obcy", { ref: REF2, at: 1 });
    expect(debtProofRefsIn(doc).has(REF2)).toBe(false);
    expect(sizeCappedRefsIn(doc).has(REF2)).toBe(false);
  });
});
