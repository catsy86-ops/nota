import { describe, expect, it } from "vitest";
import { buildSitePackage } from "./sitePackage";
import { applySitePackage, importTargets } from "./sitePackageIo";
import { getSitePoints } from "./pointsStore";
import { newPoint } from "./points";

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
