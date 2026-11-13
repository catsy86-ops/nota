import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JobsDialog } from "./JobsDialog";
import type { Job } from "@/lib/study/jobs";
import type { QuoteDoc } from "@/lib/study/quoteDoc";
import type { SiteInfo } from "@/lib/study/sites";

const NOW = new Date(2026, 10, 13, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;
const site = (id: string, name: string, investor = "") => ({ id, name, address: "", investor, created: 1, stored: true, count: 0, open: 0, first: null, last: null }) as SiteInfo;
const job = (price: number, doc?: QuoteDoc, status: Job["status"] = "quote"): Job => ({
  status, statusAt: 1, created: 1,
  items: [{ id: "a", kind: "labor", name: "x", qty: 1, unit: "usł.", price, order: 0 }],
  ...(doc ? { doc } : {}),
});
const dir = [site("a", "Szkic"), site("b", "Czeka", "Jan"), site("c", "Przyjęta"), site("d", "Odrzucona"), site("e", "Stara")];
const jobs = new Map<string, Job>([
  ["a", job(100)],
  ["b", job(1000, { sentAt: NOW - 3 * DAY })],
  ["c", job(500, { sentAt: NOW - 5 * DAY, acceptedAt: NOW - DAY })],
  ["d", job(300, { sentAt: NOW - 6 * DAY, rejectedAt: NOW - 2 * DAY })],
  ["e", job(900, { sentAt: new Date(2026, 9, 1).getTime(), acceptedAt: new Date(2026, 9, 2).getTime() })],
]);

const open = (map = jobs) => render(<JobsDialog open onOpenChange={() => {}} jobs={map} dir={dir} onOpen={() => {}} onNew={() => {}} />);
const names = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("JobsDialog: przegląd wycen (5.4)", () => {
  it("bez żadnej wysłanej wyceny nie ma filtra ani przeglądu", () => {
    open(new Map([["a", job(100)]]));
    expect(screen.queryByTestId("jobs-filter")).toBeNull();
    expect(screen.queryByTestId("jobs-review")).toBeNull();
  });

  it("podsumowanie miesiąca: wysłane, przyjęte, odrzucone i skuteczność; poprzedni miesiąc się nie liczy", () => {
    open();
    expect(screen.getByTestId("jobs-review")).toHaveTextContent(/wysłane 3 \(1\D?800 zł\)/);
    expect(screen.getByTestId("jobs-review")).toHaveTextContent("przyjęte 1 · odrzucone 1");
    expect(screen.getByTestId("jobs-review")).toHaveTextContent("skuteczność 50%");
  });

  it("filtr stanu zawęża listę, „Wszystkie” ją przywraca, a pusty wynik mówi wprost", () => {
    open();
    expect(names()).toHaveLength(5);
    const group = screen.getByRole("group", { name: "Filtr stanu wyceny" });
    fireEvent.click(within(group).getByRole("button", { name: "Wysłana" }));
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain("Czeka");
    expect(names()[0]).toContain("Wysłana 3 dni temu");
    fireEvent.click(within(group).getByRole("button", { name: "Przyjęta" }));
    expect(names()).toHaveLength(2);
    expect(names().join("|")).toContain("Przyjęta");
    expect(names().join("|")).toContain("Stara");
    fireEvent.click(within(group).getByRole("button", { name: "Odrzucona" }));
    expect(names()).toHaveLength(1);
    fireEvent.click(within(group).getByRole("button", { name: "Szkic" }));
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain("Szkic");
    fireEvent.click(within(group).getByRole("button", { name: "Wszystkie" }));
    expect(names()).toHaveLength(5);
  });

  it("filtr bez wyników pokazuje komunikat zamiast pustej listy", () => {
    open(new Map([["b", job(1000, { sentAt: NOW - DAY })]]));
    fireEvent.click(screen.getByRole("button", { name: "Przyjęta" }));
    expect(screen.getByTestId("jobs-filter-empty")).toHaveTextContent("Przyjęta");
  });
});
