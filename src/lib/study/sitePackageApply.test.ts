import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { buildSitePackage } from "./sitePackage";
import { applySitePackage, importTargets } from "./sitePackageIo";
import { getSitePoints } from "./pointsStore";
import { newPoint } from "./points";
import { siteKey } from "./sites";

// W1 (audyt 2026-11-11): punkty w pomieszczeniach, które przychodzą razem z paczką, nie mogą znikać po cichu.
describe("applySitePackage — pomieszczenia i punkty", () => {
  it("zapisuje punkty w nowych pomieszczeniach z paczki", async () => {
    const pkg = buildSitePackage(
      { id: "kowalska-3", name: "Kowalska 3", address: "Kowalska 3" },
      {
        entries: [],
        rooms: [{ id: "r1", name: "Łazienka", order: 0 }, { id: "r2", name: "Kuchnia", order: 1 }],
        points: [newPoint("p1", "r1", "umywalka", 0), newPoint("p2", "r1", "wc", 1), newPoint("p3", "r2", "zlewozmywak", 0)],
      },
      { now: Date.now(), access: false },
    );
    const target = importTargets(pkg).options.at(-1)!;
    const res = await applySitePackage(pkg, target);
    expect(res.counts.points).toBe(3);
    const saved = getSitePoints(target.id);
    expect(saved.rooms.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    expect(saved.points.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("parseSitePackage — limit wpisów (W2)", () => {
  it("ponad limit zostają najnowsze wpisy, a pominięte są policzone", async () => {
    const { parseSitePackage, SITE_PACKAGE_ENTRIES_MAX } = await import("./sitePackage");
    const now = 2_000_000_000_000;
    const total = SITE_PACKAGE_ENTRIES_MAX + 25;
    const entries = Array.from({ length: total }, (_, i) => ({ id: `e${i}`, at: now - (total - i) * 1000, kind: "ok", text: `w${i}`, site: "Kowalska 3", images: [] }));
    const pkg = buildSitePackage({ id: "kowalska-3", name: "Kowalska 3", address: "" }, { entries: [], rooms: [], points: [] }, { now, access: false });
    const r = parseSitePackage(JSON.stringify({ ...pkg, entries }), now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pkg.entries).toHaveLength(SITE_PACKAGE_ENTRIES_MAX);
    expect(r.pkg.entriesSkipped).toBe(25);
    expect(r.pkg.entries.some((e) => e.id === `e${total - 1}`)).toBe(true); // najnowszy zostaje
    expect(r.pkg.entries.some((e) => e.id === "e0")).toBe(false); // najstarszy odpada
  });
});

describe("remapEntryImages — wymiary i podpisy przy eksporcie (W3)", () => {
  const e = (extra: object = {}) => ({ id: "e1", at: 1, kind: "ok", topic: null, text: "t", site: "S", checked: [], images: ["a", "b"], ...extra }) as never;
  const dim = [{ from: [0, 0] as [number, number], to: [1, 1] as [number, number], text: "30 cm" }];

  it("przenosi podpisy, wymiary i „po naprawie” na nowe klucze, odrzuca te bez zdjęcia w paczce", async () => {
    const { remapEntryImages } = await import("./sitePackageIo");
    const out = remapEntryImages(e({ after: ["a"], captions: { a: "przed", b: "po" }, dimensions: { a: dim, b: dim } }), new Map([["a", "A2"]]));
    expect(out.images).toEqual(["A2"]);
    expect(out.after).toEqual(["A2"]);
    expect(out.captions).toEqual({ A2: "przed" });
    expect(out.dimensions).toEqual({ A2: dim });
  });

  it("bez zdjęć w paczce nie zostaje żaden klucz zdjęcia", async () => {
    const { remapEntryImages } = await import("./sitePackageIo");
    const out = remapEntryImages(e({ after: ["a"], captions: { a: "x" }, dimensions: { a: dim } }), new Map());
    expect(out.images).toEqual([]);
    expect(out).not.toHaveProperty("captions");
    expect(out).not.toHaveProperty("dimensions");
    expect(out).not.toHaveProperty("after");
  });
});

describe("eksport → import paczki (T7)", () => {
  // jsdom nie ma Blob.arrayBuffer() — jak w budowaCompression.test.ts używamy natywnych klas Node.
  beforeAll(() => { vi.stubGlobal("Blob", NodeBlob); vi.stubGlobal("File", NodeFile); });
  afterAll(() => { vi.unstubAllGlobals(); });
  const entry = (id: string, at: number) => ({ id, at, kind: "ok", topic: null, text: `Wpis ${id}`, site: "Zielona 9", checked: [], images: [] });
  const base = () => buildSitePackage(
    { id: "zielona-9", name: "Zielona 9", address: "Zielona 9" },
    { entries: [entry("t7a", 1_700_000_000_000), entry("t7b", 1_700_000_100_000)] as never, rooms: [], points: [] },
    { now: Date.now(), access: false },
  );

  it("ponowny import tej samej paczki nie dubluje wpisów", async () => {
    const { getStudy } = await import("./store");
    const pkg = base();
    const target = importTargets(pkg).options.at(-1)!;
    const first = await applySitePackage(pkg, target);
    expect(first.counts.entries).toBe(2);
    const count = () => getStudy().journal.filter((e) => e.id === "t7a" || e.id === "t7b").length;
    expect(count()).toBe(2);
    const again = importTargets(pkg).options.find((o) => o.exists)!;
    const second = await applySitePackage(pkg, again);
    expect(second.counts.entries).toBe(0);
    expect(count()).toBe(2);
  });

  it("eksport bez zdjęć → odczyt pliku → import do nowej budowy zachowuje wpisy i liczniki", async () => {
    const { exportSitePackage, readSitePackageFile } = await import("./sitePackageIo");
    const out = await exportSitePackage(siteKey("Zielona 9"), { images: false, access: false });
    expect(out.entries).toBeGreaterThanOrEqual(2);
    expect(out.images).toBe(0);
    expect(out.compressed).toBe(false); // mała paczka zostaje zwykłym JSON-em
    const read = await readSitePackageFile(out.file);
    expect(read.ok ? "ok" : read.error).toBe("ok");
    if (!read.ok) return;
    expect(read.pkg.entries.map((e) => e.id)).toEqual(expect.arrayContaining(["t7a", "t7b"]));
    expect(read.pkg.images ?? {}).toEqual({});
  });
});
