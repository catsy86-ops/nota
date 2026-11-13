import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { JournalEntry } from "@/lib/study/yStudy";

// Dziennik podstawiany przez mock: panel czyta tylko `useStudy().journal`.
let journal: JournalEntry[] = [];
vi.mock("@/lib/study/store", () => ({ useStudy: () => ({ journal }) }));

const { QuoteVsActualPanel } = await import("./QuoteVsActualPanel");
const { setFittingPrice } = await import("@/lib/study/pricingStore");
const { yjsStore } = await import("@/lib/yjsStore");
import type { Job, QuoteItem } from "@/lib/study/jobs";
import type { SiteInfo } from "@/lib/study/sites";

const item = (id: string, kind: QuoteItem["kind"], qty: number, price: number): QuoteItem => ({ id, kind, name: id, qty, unit: "szt.", price, order: 0 });
const job = (items: QuoteItem[]): Job => ({ status: "done", statusAt: 1, created: 1, items });
const SITE = "s1";
const site = (over: Partial<SiteInfo> = {}) => ({ id: SITE, name: "Lipowa 5", address: "", investor: "", created: 1, stored: true, count: 0, open: 0, first: null, last: null, ...over }) as SiteInfo;
const entry = (fittings: JournalEntry["fittings"]): JournalEntry => ({
  id: "e1", at: new Date(2026, 10, 10, 12).getTime(), kind: "ok", topic: null, text: "montaż",
  site: "Lipowa 5", siteId: SITE, checked: [], images: [], fittings,
});
// Wycena: robocizna 200 zł, materiał w cenach zakupu 250 zł.
const items = [item("r", "labor", 2, 100), item("m", "material", 1, 250)];

beforeEach(async () => {
  localStorage.clear();
  journal = [];
  await yjsStore.resetForTests();
});
afterEach(() => cleanup());

describe("QuoteVsActualPanel (5.2)", () => {
  it("bez zużytego materiału z ceną i bez godzin nie pokazuje nic, tak samo wycena bez pozycji", () => {
    const { container } = render(<QuoteVsActualPanel site={site()} job={job(items)} />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    journal = [entry([{ name: "Kolano 16", qty: 1 }])];
    setFittingPrice("Kolano 16", 4);
    const empty = render(<QuoteVsActualPanel site={site()} job={job([])} />);
    expect(empty.container).toBeEmptyDOMElement();
  });

  it("materiał drożej niż w wycenie: różnica ze znakiem i słowami, zużycie w cenach zakupu", () => {
    journal = [entry([{ name: "Kolano 16", qty: 70 }])];
    setFittingPrice("Kolano 16", 4);
    render(<QuoteVsActualPanel site={site()} job={job(items)} />);
    expect(screen.getByTestId("qva-material-diff")).toHaveTextContent("+30 zł ponad wycenę");
    expect(screen.getByTestId("qva-material")).toHaveTextContent("wyceniono 250 zł · zużyto 280 zł");
    expect(screen.queryByTestId("qva-labor")).toBeNull();
    expect(screen.queryByTestId("qva-total")).toBeNull();
  });

  it("robocizna z godzin i stawki oraz suma różnic", () => {
    journal = [entry([{ name: "Kolano 16", qty: 50 }])];
    setFittingPrice("Kolano 16", 4);
    render(<QuoteVsActualPanel site={site({ hours: [{ id: "2026-11-10", minutes: 210 }], rate: 80 })} job={job(items)} />);
    expect(screen.getByTestId("qva-material-diff")).toHaveTextContent("−50 zł poniżej wyceny");
    expect(screen.getByTestId("qva-labor")).toHaveTextContent("wyceniono 200 zł · 3 h 30 min × 80 zł = 280 zł");
    expect(screen.getByTestId("qva-labor-diff")).toHaveTextContent("+80 zł ponad wycenę");
    expect(screen.getByTestId("qva-total")).toHaveTextContent("+30 zł ponad wycenę");
  });

  it("godziny bez stawki: podpowiedź zamiast różnicy, bez sumy", () => {
    render(<QuoteVsActualPanel site={site({ hours: [{ id: "2026-11-10", minutes: 120 }] })} job={job(items)} />);
    expect(screen.getByTestId("qva-labor")).toHaveTextContent("2 h przepracowano");
    expect(screen.getByTestId("qva-labor")).toHaveTextContent("Wpisz stawkę godzinową");
    expect(screen.queryByTestId("qva-labor-diff")).toBeNull();
    expect(screen.queryByTestId("qva-total")).toBeNull();
  });

  it("zgodność z wyceną to „zgodnie z wyceną”, a pozycje bez ceny są policzone", () => {
    journal = [entry([{ name: "Kolano 16", qty: 1 }, { name: "Bez ceny", qty: 1 }])];
    setFittingPrice("Kolano 16", 250);
    render(<QuoteVsActualPanel site={site()} job={job(items)} />);
    expect(screen.getByTestId("qva-material-diff")).toHaveTextContent("zgodnie z wyceną");
    expect(screen.getByTestId("qva-material")).toHaveTextContent("bez ceny: 1");
  });
});
