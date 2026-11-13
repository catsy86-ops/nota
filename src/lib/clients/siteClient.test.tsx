import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { buyerDiffers, buyerFromClient, createClientForSite, createClientFromBuyer, fillFromClient, findClientByName, proposeClient, saveBuyerToClient, syncSiteClient } from "./siteClient";
import { addClient, archiveClient, getClientLinks, getClients, linkSiteToClient, setClientField, useSiteClient } from "./store";
import { InvoiceDialog } from "@/components/study/InvoiceDialog";
import { yjsStore } from "@/lib/yjsStore";
import type { Job } from "@/lib/study/jobs";
import type { SiteInfo } from "@/lib/study/sites";

const NIP = "5260250274";

beforeEach(async () => {
  localStorage.clear();
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  await yjsStore.resetForTests();
});
afterEach(() => cleanup());

const links = () => () => Object.fromEntries(getClientLinks());

describe("findClientByName", () => {
  it("dopasowuje po złożeniu nazwy i woli aktywnego od archiwalnego", () => {
    const stary = addClient({ name: "Jan Kowalski" })!;
    const nowy = addClient({ name: "JAN  kowalski" })!;
    archiveClient(stary.id, true);
    expect(findClientByName(getClients(), "jan kowalski")?.id).toBe(nowy.id);
    archiveClient(nowy.id, true);
    expect(findClientByName(getClients(), "jan kowalski")).toBeDefined();
    expect(findClientByName(getClients(), "  ")).toBeUndefined();
  });
});

describe("syncSiteClient i proposeClient", () => {
  it("nazwa klienta łączy budowę, inna nazwa zdejmuje powiązanie, pusta też", () => {
    const jan = addClient({ name: "Jan Kowalski" })!;
    const read = links();
    expect(syncSiteClient("b1", "jan kowalski").kind).toBe("linked");
    expect(read()).toEqual({ b1: jan.id });
    expect(syncSiteClient("b1", "Ktoś Inny").kind).toBe("unmatched");
    expect(read()).toEqual({});
    syncSiteClient("b1", "Jan Kowalski");
    expect(syncSiteClient("b1", "").kind).toBe("none");
    expect(read()).toEqual({});
  });

  it("nieznany inwestor: dymek z akcją „Dodaj” zakłada klienta z danych karty i łączy budowę", () => {
    const read = links();
    expect(proposeClient("b1", { investor: " Ola Test ", phone: "600 100 200", address: "Lipowa 5" }).kind).toBe("unmatched");
    expect(toastMock).toHaveBeenCalledTimes(1);
    const opts = toastMock.mock.calls[0][1] as { action: { onClick: () => void } };
    opts.action.onClick();
    const ola = getClients().find((c) => c.name === "Ola Test")!;
    expect(ola).toMatchObject({ phone: "600 100 200", address1: "Lipowa 5" });
    expect(read()).toEqual({ b1: ola.id });
  });

  it("bez pytania (ask = false) albo z istniejącym klientem nie wyświetla dymka", () => {
    addClient({ name: "Jan Kowalski" });
    proposeClient("b1", { investor: "Ktoś" }, false);
    proposeClient("b2", { investor: "Jan Kowalski" });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("brak dopasowania bez zmiany inwestora nie rozłącza budowy (zmiana nazwy klienta w kartotece), po zmianie — rozłącza", () => {
    const kowalski = addClient({ name: "Kowalski" })!;
    linkSiteToClient("b1", kowalski.id);
    const read = links();
    // Klient przemianowany w kartotece, a karta budowy dalej ma „Kowalski”; zapis innego pola nie zmienia inwestora.
    setClientField(kowalski.id, "name", "Jan Kowalski");
    expect(proposeClient("b1", { investor: "Kowalski" }, false).kind).toBe("unmatched");
    expect(read()).toEqual({ b1: kowalski.id });
    expect(toastMock).not.toHaveBeenCalled();
    // Inwestor faktycznie zmieniony na kogoś spoza kartoteki: powiązanie schodzi i pada pytanie.
    expect(proposeClient("b1", { investor: "Ktoś Obcy" }, true).kind).toBe("unmatched");
    expect(read()).toEqual({});
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("persistDirty: zmiana inwestora rozłącza bez pytania (changed = true, ask = false)", () => {
    const jan = addClient({ name: "Jan" })!;
    linkSiteToClient("b1", jan.id);
    const read = links();
    proposeClient("b1", { investor: "Ktoś Obcy" }, true, false);
    expect(read()).toEqual({});
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("createClientForSite zwraca null dla pustej nazwy", () => {
    expect(createClientForSite("b1", { investor: "  " })).toBeNull();
  });
});

describe("fillFromClient", () => {
  it("uzupełnia tylko puste pola karty", () => {
    const c = addClient({ name: "Jan", phone: "600 100 200", address1: "Lipowa 5", address2: "30-001 Kraków" })!;
    expect(fillFromClient(c, { phone: "", address: "" })).toEqual({ phone: "600 100 200", address: "Lipowa 5, 30-001 Kraków" });
    expect(fillFromClient(c, { phone: "111", address: "Inna 1" })).toEqual({ phone: "111", address: "Inna 1" });
  });
});

describe("nabywca faktury (2.2)", () => {
  const withNip = () => addClient({ name: "Firma Bud", kind: "company", nip: NIP, address1: "Krótka 1", address2: "80-001 Gdańsk" })!;

  it("buyerDiffers ignoruje spacje i kreski w NIP-ie", () => {
    const c = withNip();
    expect(buyerDiffers({ ...buyerFromClient(c), nip: "526-025-02-74", name: " Firma  Bud " }, c)).toBe(false);
    expect(buyerDiffers({ ...buyerFromClient(c), address1: "Inna 2" }, c)).toBe(true);
  });

  it("saveBuyerToClient zapisuje całość albo nic (zły NIP zostawia klienta bez zmian)", () => {
    const c = withNip();
    expect(saveBuyerToClient(c.id, { ...buyerFromClient(c), nip: "123", address1: "Nowa 9" })).toEqual({ ok: false, field: "nip" });
    expect(getClients()[0].address1).toBe("Krótka 1");
    expect(saveBuyerToClient(c.id, { ...buyerFromClient(c), address1: "Nowa 9" })).toEqual({ ok: true });
    expect(getClients()[0].address1).toBe("Nowa 9");
    expect(saveBuyerToClient("nie-ma", buyerFromClient(c)).ok).toBe(false);
  });

  it("createClientFromBuyer: z NIP-em firma, bez — osoba; zły NIP nie zakłada klienta", () => {
    const read = links();
    expect(createClientFromBuyer("b1", { name: "Firma", nip: "123", address1: "", address2: "" })).toBeNull();
    const firma = createClientFromBuyer("b1", { name: "Firma", nip: "526-025-02-74", address1: "A 1", address2: "" })!;
    expect(firma).toMatchObject({ kind: "company", nip: NIP });
    const osoba = createClientFromBuyer("b2", { name: "Ania", nip: "", address1: "", address2: "" })!;
    expect(osoba.kind).toBe("person");
    expect(read()).toEqual({ b1: firma.id, b2: osoba.id });
  });
});

describe("InvoiceDialog: nabywca z kartoteki", () => {
  const job: Job = { status: "done", statusAt: Date.UTC(2026, 10, 10), created: 1, items: [{ id: "i1", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 100, order: 0 }] };
  const site = { id: "b1", name: "Lipowa 5", address: "Lipowa 5, Kraków", investor: "Jan Kowalski", created: 1, stored: true, count: 0, open: 0, first: null, last: null } as SiteInfo;
  const open = () => render(<InvoiceDialog open onOpenChange={() => {}} site={site} job={job} />);

  it("bez klienta: dane z karty budowy i przycisk „Dodaj nabywcę do klientów”", () => {
    open();
    expect(screen.getByLabelText("Nazwa nabywcy")).toHaveValue("Jan Kowalski");
    expect(screen.getByLabelText("NIP nabywcy")).toHaveValue("");
    fireEvent.click(screen.getByTestId("buyer-add"));
    expect(getClients().map((c) => c.name)).toEqual(["Jan Kowalski"]);
    expect(toastMock.success).toHaveBeenCalledWith("Dodano klienta: Jan Kowalski");
  });

  it("z klientem: NIP i adres wypełnione, edycja pokazuje „Zapisz u klienta”, zły NIP daje błąd", () => {
    const c = addClient({ name: "Jan Kowalski", kind: "company", nip: NIP, address1: "Krótka 1", address2: "80-001 Gdańsk" })!;
    linkSiteToClient("b1", c.id);
    open();
    expect(screen.getByLabelText("NIP nabywcy")).toHaveValue(NIP);
    expect(screen.getByLabelText("Adres nabywcy")).toHaveValue("Krótka 1");
    expect(screen.getByLabelText("Kod i miejscowość nabywcy")).toHaveValue("80-001 Gdańsk");
    expect(screen.queryByTestId("buyer-save")).toBeNull();

    fireEvent.change(screen.getByLabelText("Adres nabywcy"), { target: { value: "Nowa 9" } });
    fireEvent.click(screen.getByTestId("buyer-save"));
    expect(getClients()[0].address1).toBe("Nowa 9");
    expect(screen.queryByTestId("buyer-save")).toBeNull();

    fireEvent.change(screen.getByLabelText("NIP nabywcy"), { target: { value: "123" } });
    fireEvent.click(screen.getByTestId("buyer-save"));
    expect(toastMock.error).toHaveBeenCalledWith("Nie zapisano u klienta: sprawdź NIP");
    expect(within(screen.getByTestId("buyer-client")).getByText(/Z kartoteki: Jan Kowalski/)).toBeInTheDocument();
  });
});

describe("useSiteClient", () => {
  it("zwraca klienta przypisanego do budowy", () => {
    const c = addClient({ name: "Jan" })!;
    linkSiteToClient("b1", c.id);
    let found: string | undefined;
    function Probe() { found = useSiteClient("b1")?.name; return null; }
    render(<Probe />);
    expect(found).toBe("Jan");
  });
});
