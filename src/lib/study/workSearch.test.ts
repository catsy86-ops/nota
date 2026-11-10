import { describe, expect, it } from "vitest";
import MiniSearch from "minisearch";
import { buildWorkIndex } from "./workSearch";
import { siteDirectory, type SiteCard } from "./sites";
import type { JournalEntry } from "./yStudy";

const entry = (id: string, text: string, site: string, extra: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id, at: 1_000, kind: "ok", topic: null, text, site, siteId: site.startsWith("Lipowa") ? "l" : "p", checked: [], images: [], ...extra });

const card = (id: string, name: string, extra: Partial<SiteCard> = {}): SiteCard =>
  ({ id, name, address: "", investor: "", created: 1, ...extra }) as SiteCard;

const journal = [
  entry("1", "Wymieniony zawór kulowy w łazience", "Lipowa 5", { images: ["img1"] }),
  entry("2", "Zawór zwrotny przy liczniku", "Polna 2"),
  entry("3", "Pion kanalizacji", "Lipowa 5", { captions: { img9: "Zakryte przed wylewką" }, images: ["img9"] }),
];
const dir = siteDirectory({
  l: card("l", "Lipowa 5", { shortages: [{ id: "s1", text: "Rura PEX 16", qty: "50 m", status: "missing", at: 5 }] }),
  p: card("p", "Polna 2", { docs: [{ id: "d1", name: "Projekt instalacji.pdf", size: 1, type: "application/pdf", at: 7 }] }),
}, journal);
const index = buildWorkIndex(MiniSearch, dir, journal);
const keys = (q: string) => index.search(q).map((h) => h.key);

describe("workSearch", () => {
  it("„zawór Lipowa” znajduje wpis z zaworem na tej budowie, nie z innej", () => {
    expect(keys("zawór Lipowa")).toEqual(["entry:1"]);
  });

  it("bez polskich znaków i z literówką", () => {
    expect(keys("zawor")).toEqual(expect.arrayContaining(["entry:1", "entry:2"]));
    expect(keys("kanalizcji")).toContain("entry:3");
  });

  it("podpisy zdjęć, braki i nazwy dokumentów", () => {
    expect(keys("wylewką")).toContain("entry:3");
    expect(keys("pex")).toContain("shortage:l:s1");
    expect(keys("projekt")).toContain("doc:p:d1");
  });

  it("opis trafienia ma budowę i znacznik zdjęć", () => {
    const hit = index.search("zawór Lipowa")[0];
    expect(hit).toMatchObject({ kind: "entry", siteId: "l", siteName: "Lipowa 5", hasPhotos: true });
  });

  it("puste zapytanie nic nie zwraca", () => {
    expect(index.search("  ")).toEqual([]);
  });
});
