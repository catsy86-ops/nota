import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { clearSecurityForTests, getSecurityEvents } from "@/lib/diagnostics";
import { SCHEMA_VERSION } from "@/lib/formatSchema";
import { DOC_FORMAT_MAP, docFormatStatus, docWritable, ignoreDocFormat, readDocFormat, requireFeature, resetDocFormatForTests } from "./docFormat";

beforeEach(() => {
  resetDocFormatForTests();
  clearSecurityForTests();
});

describe("docFormat (D1.3)", () => {
  it("wymaganie tylko w górę; dwa urządzenia dopisujące równolegle dają ten sam wynik", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    requireFeature(a, "vault-files", 4);
    requireFeature(b, "vault-files", 5);
    requireFeature(a, "vault-files", 3);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(readDocFormat(a)).toEqual(readDocFormat(b));
    requireFeature(a, "vault-files", 6);
    expect(readDocFormat(a).get("vault-files")).toBe(6);
  });

  it("niezaufane wartości: zła nazwa, zła wartość i nadmiar cech pominięte", () => {
    const d = new Y.Doc();
    const m = d.getMap(DOC_FORMAT_MAP);
    m.set("Zła nazwa", 4);
    m.set("ok", "dużo");
    m.set("za-duzo", 5000);
    m.set("dobra", 4);
    for (let i = 0; i < 60; i++) m.set(`f${i}`, 1);
    const read = readDocFormat(d);
    expect(read.has("Zła nazwa")).toBe(false);
    expect(read.has("ok")).toBe(false);
    expect(read.has("za-duzo")).toBe(false);
    expect(read.size).toBeLessThanOrEqual(50);
    expect(requireFeature(d, "Zła", 4)).toBe(false);
    expect(requireFeature(d, "x", Number.NaN)).toBe(false);
  });

  it("cecha wymagająca nowszej wersji blokuje zapis tej cechy, nie innych; baner ją zgłasza", () => {
    const d = new Y.Doc();
    requireFeature(d, "vault-files", SCHEMA_VERSION + 1);
    requireFeature(d, "stara", SCHEMA_VERSION);
    expect(docWritable(d, "vault-files")).toBe(false);
    expect(docWritable(d, "stara")).toBe(true);
    expect(docWritable(d, "nieopisana")).toBe(true);
    expect(docFormatStatus(d).tooNew).toEqual([{ feature: "vault-files", required: SCHEMA_VERSION + 1, known: false }]);
    expect(getSecurityEvents()).toHaveLength(0);
  });

  it("wymaganie podejrzanie wysokie: jeden wpis bezpieczeństwa; „Ignoruj i pisz” odblokowuje", () => {
    const d = new Y.Doc();
    requireFeature(d, "atak", SCHEMA_VERSION + 50);
    docFormatStatus(d);
    docFormatStatus(d);
    expect(getSecurityEvents().filter((e) => e.kind === "doc-format-claim")).toHaveLength(1);
    expect(docWritable(d, "atak")).toBe(false);
    ignoreDocFormat(true);
    expect(docWritable(d, "atak")).toBe(true);
    expect(docFormatStatus(d).ignored).toBe(true);
    ignoreDocFormat(false);
    expect(docWritable(d, "atak")).toBe(false);
  });
});
