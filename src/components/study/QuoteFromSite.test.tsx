import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { JournalEntry } from "@/lib/study/yStudy";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

// Dziennik podstawiany przez mock: panel czyta tylko `useStudy().journal`.
let journal: JournalEntry[] = [];
vi.mock("@/lib/study/store", () => ({ useStudy: () => ({ journal }) }));

const { QuoteFromSite } = await import("./QuoteFromSite");
const { getJobs, saveQuoteItem, setJobMeta, useJob } = await import("@/lib/study/jobsStore");
const { addPoint, addRoom } = await import("@/lib/study/pointsStore");
const { setPointRate } = await import("@/lib/study/billingStore");
const { setFittingPrice } = await import("@/lib/study/pricingStore");
const { yjsStore } = await import("@/lib/yjsStore");
import type { SiteInfo } from "@/lib/study/sites";

const SITE = "s1";
const site = { id: SITE, name: "Lipowa 5", address: "", investor: "", created: 1, stored: true, count: 0, open: 0, first: null, last: null } as SiteInfo;
const items = () => getJobs().get(SITE)?.items ?? [];
const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "e1", at: new Date(2026, 10, 10, 12).getTime(), kind: "ok", topic: null, text: "montaż",
  site: "Lipowa 5", siteId: SITE, checked: [], images: [], ...over,
});

function Host() {
  const job = useJob(SITE);
  return job ? <QuoteFromSite site={site} job={job} /> : null;
}
const undo = () => (toastMock.mock.calls.at(-1)![1] as { action: { onClick: () => void } }).action.onClick();

beforeEach(async () => {
  localStorage.clear();
  toastMock.mockClear();
  toastMock.info.mockClear();
  journal = [];
  await yjsStore.resetForTests();
  setJobMeta(SITE, { status: "quote" });
});
afterEach(() => cleanup());

describe("QuoteFromSite (4.4)", () => {
  it("bez punktów i bez zużytego materiału nie pokazuje nic", () => {
    const { container } = render(<Host />);
    expect(container).toBeEmptyDOMElement();
  });

  it("„Z punktów”: pozycje robocizny ze stawek, „Cofnij” je usuwa, ponowne kliknięcie nie dubluje", () => {
    const room = addRoom(SITE, "Łazienka")!;
    addPoint(SITE, room.id, "umywalka");
    addPoint(SITE, room.id, "umywalka");
    addPoint(SITE, room.id, "wc-stelaz");
    setPointRate(SITE, null, 100);
    setPointRate(SITE, "umywalka", 150);
    render(<Host />);
    expect(screen.getByTestId("quote-from-points")).toHaveTextContent("Z punktów (2)");

    fireEvent.click(screen.getByTestId("quote-from-points"));
    expect(items().map((i) => [i.name, i.qty, i.unit, i.price, i.kind])).toEqual([
      ["Umywalka — punkt", 2, "pkt", 150, "labor"],
      ["WC (stelaż) — punkt", 1, "pkt", 100, "labor"],
    ]);
    expect(toastMock.mock.calls.at(-1)![0]).toBe("Dodano z punktów: 2 pozycje");

    act(() => undo());
    expect(items()).toEqual([]);

    fireEvent.click(screen.getByTestId("quote-from-points"));
    fireEvent.click(screen.getByTestId("quote-from-points"));
    expect(items()).toHaveLength(2);
    expect(toastMock.info).toHaveBeenCalledWith("Nic nie dodano — już w wycenie: Umywalka — punkt, WC (stelaż) — punkt");
  });

  it("punkty bez stawki nie są dodawane i są wymienione w komunikacie", () => {
    const room = addRoom(SITE, "Kuchnia")!;
    addPoint(SITE, room.id, "zlew");
    render(<Host />);
    fireEvent.click(screen.getByTestId("quote-from-points"));
    expect(items()).toEqual([]);
    expect(toastMock.info).toHaveBeenCalledWith("Nic nie dodano — bez stawki: Zlew");
  });

  it("„Z zużytego materiału”: kształtki w sztukach i rury w metrach z cennika; bez ceny wymienione w opisie", () => {
    journal = [entry({ fittings: [{ name: "Kolano 16", qty: 12 }, { name: "Dziwna kształtka", qty: 1 }], pipes: [{ name: "Rura PEX 16×2", cm: 1250 }] })];
    setFittingPrice("Kolano 16", 4.5);
    setFittingPrice("Rura PEX 16×2", 3.2);
    saveQuoteItem(SITE, { id: "q0", kind: "labor", name: "Robocizna", qty: 1, unit: "usł.", price: 500, order: 0 });
    render(<Host />);
    expect(screen.queryByTestId("quote-from-points")).toBeNull();
    expect(screen.getByTestId("quote-from-usage")).toHaveTextContent("Z zużytego materiału (2)");

    fireEvent.click(screen.getByTestId("quote-from-usage"));
    expect(items().filter((i) => i.kind === "material").map((i) => [i.name, i.qty, i.unit, i.price])).toEqual([
      ["Kolano 16", 12, "szt.", 4.5],
      ["Rura PEX 16×2", 12.5, "m", 3.2],
    ]);
    // Nowe pozycje trafiają za istniejącymi.
    expect(items().map((i) => i.name)).toEqual(["Robocizna", "Kolano 16", "Rura PEX 16×2"]);
    expect((toastMock.mock.calls.at(-1)![1] as { description: string }).description).toBe("bez ceny: Dziwna kształtka");
  });
});

describe("QuoteFromSite: limit pozycji (code-review)", () => {
  it("pozycje ponad limit są wymienione w komunikacie, a nie gubione po cichu", () => {
    for (let n = 0; n < 59; n++) saveQuoteItem(SITE, { id: `q${n}`, kind: "labor", name: `Poz ${n}`, qty: 1, unit: "usł.", price: 1, order: n });
    const room = addRoom(SITE, "Łazienka")!;
    for (const type of ["umywalka", "zlew", "wanna"]) addPoint(SITE, room.id, type);
    setPointRate(SITE, null, 100);
    render(<Host />);
    fireEvent.click(screen.getByTestId("quote-from-points"));
    expect(items()).toHaveLength(60);
    expect((toastMock.mock.calls.at(-1)![1] as { description: string }).description).toBe("ponad limit 60 pozycji: 2");
    expect(toastMock.mock.calls.at(-1)![0]).toBe("Dodano z punktów: 1 pozycja");
  });
});
