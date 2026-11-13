import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import ClientsView from "./ClientsView";
import { addClient, getClientLinks, linkSiteToClient } from "@/lib/clients/store";
import { addDebt } from "@/lib/debts/store";
import { resetStudyForTests } from "@/lib/study/data";
import { getJobs, saveQuoteItem, setJobMeta } from "@/lib/study/jobsStore";
import { saveSiteCard } from "@/lib/study/store";
import { yjsStore } from "@/lib/yjsStore";

beforeEach(async () => {
  localStorage.clear();
  await yjsStore.resetForTests();
  resetStudyForTests();
});
afterEach(() => cleanup());

function openCard(name: string) {
  fireEvent.click(screen.getAllByTestId("client-row").find((r) => r.textContent?.includes(name))!);
  return screen.getByTestId("client-card");
}

describe("karta klienta: historia i saldo z Długów (2.3, 2.4)", () => {
  it("klient bez budów: podpowiedź zamiast historii", () => {
    addClient({ name: "Ania" });
    render(<ClientsView />);
    openCard("Ania");
    expect(screen.getByTestId("client-history-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("client-debt")).toBeNull();
  });

  it("pokazuje budowy ze zleceniem, niezapłacone i przechodzi do budowy", () => {
    const jan = addClient({ name: "Jan Kowalski" })!;
    saveSiteCard("n-1", { name: "Lipowa 5", address: "", investor: "Jan Kowalski" });
    saveSiteCard("n-2", { name: "Leśna 2", address: "", investor: "Jan Kowalski" });
    setJobMeta("n-1", { status: "done" });
    saveQuoteItem("n-1", { id: "q1", kind: "labor", name: "Montaż", qty: 2, unit: "usł.", price: 250, order: 0 });
    linkSiteToClient("n-1", jan.id);
    linkSiteToClient("n-2", jan.id);
    const open = vi.fn();
    render(<ClientsView onOpenSite={open} />);
    const card = openCard("Jan Kowalski");

    expect(within(card).getByTestId("client-history-summary")).toHaveTextContent(/Niezapłacone:\s*500/);
    const rows = within(card).getAllByTestId("client-history-row");
    expect(rows).toHaveLength(2);
    const lipowa = rows.find((r) => r.textContent?.includes("Lipowa 5"))!;
    expect(lipowa).toHaveTextContent("Zrobione 500");

    fireEvent.click(within(lipowa).getByRole("button"));
    expect(open).toHaveBeenCalledWith("n-1");
    expect(screen.queryByTestId("client-card")).toBeNull();
  });

  it("saldo z Długów po nazwie (bez ogonków i wielkości liter), tylko do odczytu, z przejściem do Długów", () => {
    addClient({ name: "Łukasz Żółć" });
    addDebt({ person: "lukasz zolc", kind: "lent", amount: 25_000, at: "2026-11-01" });
    const goDebts = vi.fn();
    render(<ClientsView onOpenDebts={goDebts} />);
    const card = openCard("Łukasz");
    expect(within(card).getByTestId("client-debt")).toHaveTextContent(/winien Ci\s*250/);
    fireEvent.click(within(card).getByText("Otwórz Długi"));
    expect(goDebts).toHaveBeenCalled();
    expect(screen.queryByTestId("client-card")).toBeNull();
  });

  it("dług w drugą stronę i rozliczony mają własne komunikaty", () => {
    addClient({ name: "Marek" });
    addClient({ name: "Ola" });
    addDebt({ person: "Marek", kind: "borrowed", amount: 10_000, at: "2026-11-01" });
    addDebt({ person: "Ola", kind: "lent", amount: 5_000, at: "2026-11-01" });
    addDebt({ person: "Ola", kind: "repaid", amount: 5_000, at: "2026-11-02" });
    render(<ClientsView />);
    expect(within(openCard("Marek")).getByTestId("client-debt")).toHaveTextContent(/jesteś winien\s*100/);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    cleanup();
    render(<ClientsView />);
    expect(within(openCard("Ola")).getByTestId("client-debt")).toHaveTextContent("rozliczone");
  });
});

describe("karta klienta: nowa wycena (4.6)", () => {
  it("„Nowa wycena” zakłada zlecenie, łączy je z klientem i otwiera jego kartę budowy", () => {
    const jan = addClient({ name: "Jan Kowalski", phone: "600 100 200" })!;
    const open = vi.fn();
    render(<ClientsView onOpenSite={open} />);
    const card = openCard("Jan Kowalski");
    fireEvent.click(within(card).getByTestId("client-new-quote"));
    expect(open).toHaveBeenCalledTimes(1);
    const id = open.mock.calls[0][0] as string;
    expect(getJobs().get(id)?.status).toBe("quote");
    expect(getClientLinks().get(id)).toBe(jan.id);
    expect(screen.queryByTestId("client-card")).toBeNull();
    expect(toastMock.success).toHaveBeenCalledWith("Założono wycenę „Jan Kowalski — wycena”");
  });

  it("klient z archiwum nie ma przycisku „Nowa wycena”", () => {
    addClient({ name: "Stary" });
    render(<ClientsView />);
    const card = openCard("Stary");
    expect(within(card).getByTestId("client-new-quote")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /Do archiwum/ }));
    expect(within(screen.getByTestId("client-card")).queryByTestId("client-new-quote")).toBeNull();
  });
});
