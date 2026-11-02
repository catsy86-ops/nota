import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./journalEntry";
import {
  buildSitePackage, collisionName, fromFileAuthor, parseSitePackage, planImport, SITE_PACKAGE_FORMAT,
  SITE_PACKAGE_VERSION, sitePackageName, type SitePackage,
} from "./sitePackage";

const NOW = Date.UTC(2026, 10, 2, 12);
const DAY = 24 * 60 * 60 * 1000;
const IMG = "a".repeat(64);
const IMG2 = "b".repeat(64);
const PNG = "data:image/png;base64,iVBORw0KGgo=";

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "e1", at: NOW - DAY, kind: "note", topic: "t1", text: "Podejścia w łazience", site: "Lipowa 5", siteId: "lipowa-5",
  checked: ["c1"], images: [IMG], ...over,
});

const card = {
  id: "lipowa-5", name: "Lipowa 5", address: "Lipowa 5, Kraków", access: "brama 1234",
  stages: [{ id: "podejscia", name: "Podejścia", done: NOW - DAY }],
  shortages: [{ id: "s1", text: "Rura PEX 16", qty: "50 m", status: "missing" as const, at: NOW - DAY }],
  plan: [{ id: "p1", text: "Próba w kuchni", at: NOW - DAY }],
};

function pkg(over: Partial<SitePackage> = {}): SitePackage {
  return {
    ...buildSitePackage(card, {
      entries: [entry({ geo: { lat: 50, lng: 19, acc: 5 } as JournalEntry["geo"], owner: "Marek", drawnFrom: { [IMG]: IMG2 } })],
      rooms: [{ id: "r1", name: "Łazienka", order: 0 }],
      points: [{ id: "pt1", room: "r1", type: "umywalka", sides: ["z", "c", "k"], steps: { podejscie: NOW - DAY }, order: 0 }],
    }, { by: "Marek", now: NOW, access: false }),
    ...over,
  };
}

const parse = (p: unknown) => parseSitePackage(JSON.stringify(p), NOW);

describe("buildSitePackage", () => {
  it("bez lokalizacji, odpowiedzialnego, oryginałów rysunków, danych Nauki i kodu dostępu", () => {
    const p = pkg();
    const e = p.entries[0];
    expect(e.geo).toBeUndefined();
    expect(e.owner).toBeUndefined();
    expect(e.drawnFrom).toBeUndefined();
    expect(e.siteId).toBeUndefined();
    expect(e.topic).toBeNull();
    expect(e.checked).toEqual([]);
    expect(p.site.access).toBeUndefined();
    expect(p.format).toBe(SITE_PACKAGE_FORMAT);
  });

  it("kod dostępu tylko na wyraźny wybór", () => {
    const p = buildSitePackage(card, { entries: [], rooms: [], points: [] }, { now: NOW, access: true });
    expect(p.site.access).toBe("brama 1234");
  });
});

describe("parseSitePackage", () => {
  it("odczytuje własną paczkę", () => {
    const r = parse(pkg());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pkg.site.name).toBe("Lipowa 5");
    expect(r.pkg.entries).toHaveLength(1);
    expect(r.pkg.by).toBe("Marek");
  });

  it("odrzuca obcy format, inną wersję i budowę bez nazwy", () => {
    expect(parseSitePackage("{nie json", NOW).ok).toBe(false);
    expect(parse({ format: "coś" }).ok).toBe(false);
    const v = parse({ ...pkg(), version: SITE_PACKAGE_VERSION + 1 });
    expect(v.ok || v.error).toMatch(/innej wersji/);
    expect(parse({ ...pkg(), site: { id: "x", name: "  " } }).ok).toBe(false);
  });

  it("czasy z przyszłości (ponad dzień) odpadają", () => {
    const far = NOW + 2 * DAY;
    const r = parse(pkg({
      entries: [entry({ id: "ok" }), entry({ id: "future", at: far }), entry({ id: "bad-resolved", kind: "problem", resolved: 9e15 })],
      stages: [{ id: "a", name: "A", done: far }, { id: "b", name: "B" }],
      shortages: [{ id: "s", text: "x", qty: "", status: "missing", at: NOW, changed: far }],
      plan: [{ id: "p", text: "x", at: far }],
      points: [{ id: "pt", room: "r1", type: "umywalka", sides: [], steps: { podejscie: far }, order: 0 }],
    }));
    if (!r.ok) throw new Error(r.error);
    expect(r.pkg.entries.map((e) => e.id)).toEqual(["ok"]);
    expect(r.pkg.stages.map((s) => s.id)).toEqual(["b"]);
    expect(r.pkg.shortages).toEqual([]);
    expect(r.pkg.plan).toEqual([]);
    expect(r.pkg.points).toEqual([]);
  });

  it("zdjęcia tylko te, do których odwołują się wpisy, i tylko base64 obrazu", () => {
    const r = parse(pkg({ images: { [IMG]: PNG, [IMG2]: PNG, ["c".repeat(64)]: "data:text/html;base64,PGI+" } }));
    if (!r.ok) throw new Error(r.error);
    expect(Object.keys(r.pkg.images ?? {})).toEqual([IMG]);
    const svg = parse(pkg({ images: { [IMG]: "data:image/svg+xml;base64,PHN2Zz4=" } }));
    if (!svg.ok) throw new Error(svg.error);
    expect(svg.pkg.images).toBeUndefined();
  });

  it("tekst nazwy bez znaków sterujących", () => {
    const r = parse(pkg({ site: { id: "lipowa-5", name: "Lipowa‮ 5", address: "" } }));
    if (!r.ok) throw new Error(r.error);
    expect(r.pkg.site.name).not.toContain("‮");
  });
});

describe("planImport", () => {
  const empty = { journalIds: new Set<string>(), stages: [], shortages: [], plan: [], rooms: [], points: [] };

  it("nowa budowa: wszystko dochodzi, podpisane „z pliku”, z budową docelową", () => {
    const p = planImport(pkg(), { id: "lipowa-5-od-marka", name: "Lipowa 5 (od Marka)" }, empty);
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({ site: "Lipowa 5 (od Marka)", siteId: "lipowa-5-od-marka", by: "Marek · z pliku" });
    expect(p.shortages[0].by).toBe("Marek · z pliku");
    expect(p.points[0].by).toBe("Marek · z pliku");
    expect(p.rooms).toHaveLength(1);
    expect(p.counts).toMatchObject({ entries: 1, stages: 1, shortages: 1, plan: 1, points: 1, dropped: 0 });
  });

  it("istniejący wpis zostaje, nowsza zmiana listy wygrywa, starsza nie", () => {
    const local = {
      ...empty,
      journalIds: new Set(["e1"]),
      stages: [{ id: "podejscia", name: "Podejścia" }],
      shortages: [{ id: "s1", text: "Rura PEX 16", qty: "50 m", status: "delivered" as const, at: NOW - DAY, changed: NOW }],
    };
    const p = planImport(pkg(), { id: "lipowa-5", name: "Lipowa 5" }, local);
    expect(p.entries).toEqual([]);
    expect(p.stages[0].done).toBe(NOW - DAY);
    expect(p.shortages[0].status).toBe("delivered");
    expect(p.listsChanged.shortages).toBe(false);
  });

  it("punkt bez pomieszczenia odpada, etap spoza budowy znika z wpisu", () => {
    const base = pkg();
    const p = planImport({ ...base, rooms: [], stages: [], entries: [entry({ stage: "obcy", point: "pt1" })] }, { id: "x", name: "X" }, empty);
    expect(p.points).toEqual([]);
    expect(p.counts.dropped).toBe(1);
    expect(p.entries[0].stage).toBeUndefined();
    expect(p.entries[0].point).toBeUndefined();
  });
});

describe("nazwy", () => {
  it("podpis z pliku zawsze z dopiskiem", () => {
    expect(fromFileAuthor(undefined)).toBe("pomocnik · z pliku");
    expect(fromFileAuthor("Marek")).toBe("Marek · z pliku");
  });

  it("nazwa pliku bez znaków zabronionych, nazwa przy kolizji", () => {
    expect(sitePackageName("Lipowa 5/7: dom")).toBe("Lipowa 5 7 dom.budowa");
    expect(sitePackageName("///")).toBe("budowa.budowa");
    expect(collisionName("Lipowa 5", "Marek")).toBe("Lipowa 5 (od Marek)");
  });
});
