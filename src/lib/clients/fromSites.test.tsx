import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { applyProposals, proposeClients } from "./fromSites";
import { addClient, getClients, linkSiteToClient, useClientLinks } from "./store";
import type { Client } from "./model";
import ClientsView from "@/components/clients/ClientsView";
import { resetStudyForTests } from "@/lib/study/data";
import { saveSiteCard } from "@/lib/study/store";
import { yjsStore } from "@/lib/yjsStore";

const site = (id: string, investor: string, over: Partial<{ phone: string; address: string; created: number }> = {}) =>
  ({ id, investor, phone: over.phone, address: over.address ?? "", created: over.created ?? 1000 });
const client = (id: string, name: string): Client =>
  ({ id, name, kind: "person", nip: "", address1: "", address2: "", phone: "", email: "", note: "", created: 1 });

describe("proposeClients", () => {
  it("łączy tę samą nazwę po złożeniu w jednego klienta i bierze telefon i adres z najnowszej budowy", () => {
    const list = proposeClients([
      site("a", "jan  KOWALSKI", { created: 1, address: "Stara 1" }),
      site("b", "Jan Kowalski", { created: 5, phone: "600 100 200", address: "Nowa 2" }),
      site("c", "Łukasz Żółć", { created: 3 }),
    ], [], new Map());
    expect(list.map((p) => p.name)).toEqual(["Jan Kowalski", "Łukasz Żółć"]);
    expect(list[0]).toMatchObject({ phone: "600 100 200", address: "Nowa 2", siteIds: ["a", "b"] });
    expect(list[0].existingId).toBeUndefined();
  });

  it("pomija budowy bez inwestora i te, które już mają klienta", () => {
    const list = proposeClients([site("a", ""), site("b", "   "), site("c", "Ania"), site("d", "Zenon")], [], new Map([["d", "cl-1"]]));
    expect(list.map((p) => p.name)).toEqual(["Ania"]);
  });

  it("nazwa istniejącego klienta daje propozycję tylko z podłączeniem budów", () => {
    const list = proposeClients([site("a", "ANIA nowak")], [client("cl-1", "Ania Nowak")], new Map());
    expect(list).toHaveLength(1);
    expect(list[0].existingId).toBe("cl-1");
  });

  it("pisownia: najczęstsza w kartach, przy remisie z najnowszej budowy", () => {
    const list = proposeClients([site("a", "Jan kowalski", { created: 9 }), site("b", "Jan Kowalski"), site("c", "Jan Kowalski")], [], new Map());
    expect(list[0].name).toBe("Jan Kowalski");
  });
});

beforeEach(async () => {
  localStorage.clear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  await yjsStore.resetForTests();
  resetStudyForTests();
});
afterEach(() => cleanup());

describe("applyProposals", () => {
  it("zakłada klientów, podłącza do istniejących i przypisuje budowy", () => {
    const ania = addClient({ name: "Ania Nowak" })!;
    const res = applyProposals([
      { key: "jan kowalski", name: "Jan Kowalski", phone: "600 100 200", address: "Nowa 2", siteIds: ["a", "b"] },
      { key: "ania nowak", name: "Ania Nowak", phone: "", address: "", siteIds: ["c"], existingId: ania.id },
    ]);
    expect(res).toEqual({ created: 1, linked: 3, failed: 0 });
    const jan = getClients().find((c) => c.name === "Jan Kowalski")!;
    expect(jan).toMatchObject({ phone: "600 100 200", address1: "Nowa 2" });
    let links: ReadonlyMap<string, string> = new Map();
    function Probe() { links = useClientLinks(); return null; }
    render(<Probe />);
    expect(Object.fromEntries(links)).toEqual({ a: jan.id, b: jan.id, c: ania.id });
  });
});

describe("ClientsView: klienci z budów (1.6)", () => {
  const seed = () => {
    saveSiteCard("n-1", { name: "Lipowa 5", address: "Kraków", investor: "Jan Kowalski", phone: "600 100 200" });
    saveSiteCard("n-2", { name: "Leśna 2", address: "", investor: "Jan  Kowalski" });
    saveSiteCard("n-3", { name: "Polna 9", address: "", investor: "Ola Test" });
  };

  it("baner liczy inwestorów, „Utwórz” zakłada klientów i baner znika", () => {
    seed();
    render(<ClientsView />);
    expect(screen.getByTestId("client-import-banner")).toHaveTextContent("2 inwestorzy");
    fireEvent.click(screen.getByTestId("client-import-open"));
    const dialog = screen.getByTestId("client-import-dialog");
    // Odznaczenie jednego z nich zmienia licznik na przycisku.
    fireEvent.click(within(dialog).getAllByRole("checkbox")[1]);
    expect(screen.getByTestId("client-import-run")).toHaveTextContent("Utwórz (1)");
    fireEvent.click(screen.getByTestId("client-import-run"));
    expect(getClients().map((c) => c.name)).toEqual(["Jan Kowalski"]);
    expect(toastMock.success).toHaveBeenCalledWith("Dodano klientów: 1, podłączono budów: 2");
    expect(screen.queryByTestId("client-import-banner")).toBeInTheDocument(); // Ola jeszcze czeka
    expect(screen.getByTestId("client-import-banner")).toHaveTextContent("1 inwestor ");
  });

  it("„Nie teraz” chowa baner, a nowa budowa z nowym inwestorem przywraca go", () => {
    seed();
    render(<ClientsView />);
    fireEvent.click(screen.getByText("Nie teraz"));
    expect(screen.queryByTestId("client-import-banner")).toBeNull();
    cleanup();
    render(<ClientsView />);
    expect(screen.queryByTestId("client-import-banner")).toBeNull();
    saveSiteCard("n-4", { name: "Brzozowa 1", address: "", investor: "Nowy Inwestor" });
    cleanup();
    render(<ClientsView />);
    expect(screen.getByTestId("client-import-banner")).toHaveTextContent("3 inwestorzy");
  });

  it("budowa już przypisana do klienta nie wchodzi do propozycji", () => {
    seed();
    const jan = addClient({ name: "Jan Kowalski" })!;
    linkSiteToClient("n-1", jan.id);
    linkSiteToClient("n-2", jan.id);
    render(<ClientsView />);
    expect(screen.getByTestId("client-import-banner")).toHaveTextContent("1 inwestor ");
  });
});
