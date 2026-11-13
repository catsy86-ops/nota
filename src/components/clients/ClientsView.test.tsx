import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import ClientsView from "./ClientsView";
import { addClient, getClientLinks, getClients, linkSiteToClient, removeClient } from "@/lib/clients/store";

const NIP = "5260250274";

afterEach(() => {
  cleanup();
  for (const c of getClients()) removeClient(c.id);
});

describe("ClientsView (plan wycen i klientów, 1.4–1.5)", () => {
  it("pusta kartoteka pokazuje zachętę, a „Nowy klient” zakłada klienta i otwiera jego kartę", () => {
    render(<ClientsView />);
    expect(screen.getByTestId("clients-empty")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("client-new"));
    const save = screen.getByTestId("new-client-save");
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByTestId("new-client-name"), { target: { value: "Jan Nowak" } });
    fireEvent.change(screen.getByLabelText(/Telefon/), { target: { value: "600 100 200" } });
    fireEvent.click(save);

    expect(getClients().map((c) => c.name)).toEqual(["Jan Nowak"]);
    expect(screen.getByTestId("client-card")).toBeInTheDocument();
    expect(within(screen.getByTestId("client-actions")).getByRole("link", { name: /Zadzwoń/ })).toHaveAttribute("href", "tel:+48600100200");
  });

  it("klient z zewnątrz (paleta poleceń) otwiera kartę i zgłasza obsłużenie prośby", () => {
    const c = addClient({ name: "Ania" })!;
    const handled = vi.fn();
    render(<ClientsView requestedId={c.id} onRequestHandled={handled} />);
    expect(screen.getByTestId("client-card")).toBeInTheDocument();
    expect(handled).toHaveBeenCalled();
  });

  it("karta: możliwy duplikat da się scalić tutaj, a „Cofnij” przywraca go z budowami", () => {
    const keep = addClient({ name: "Jan Kowalski", phone: "600 100 200" })!;
    const dup = addClient({ name: "jan kowalski", email: "j@k.pl" })!;
    linkSiteToClient("b1", dup.id);
    toastMock.mockClear();
    render(<ClientsView />);
    fireEvent.click(screen.getAllByTestId("client-row").find((r) => r.textContent?.includes("600 100 200"))!);
    expect(screen.getByTestId("client-twin")).toHaveTextContent("Możliwy duplikat");
    fireEvent.click(within(screen.getByTestId("client-twin")).getByRole("button", { name: "Scal tutaj" }));

    expect(getClients().map((c) => c.id)).toEqual([keep.id]);
    expect(getClients()[0].email).toBe("j@k.pl");
    expect(Object.fromEntries(getClientLinks())).toEqual({ b1: keep.id });
    const opts = toastMock.mock.calls[0][1] as { action: { onClick: () => void }; description: string };
    expect(opts.description).toBe("Przeniesione budowy: 1, uzupełnione pola: 1.");
    act(() => opts.action.onClick());
    expect(getClients()).toHaveLength(2);
    expect(Object.fromEntries(getClientLinks())).toEqual({ b1: dup.id });
  });

  it("karta: scalanie z wybranym z listy, przycisk nieaktywny bez wyboru", () => {
    addClient({ name: "Ania" });
    addClient({ name: "Zenon" });
    render(<ClientsView />);
    fireEvent.click(screen.getAllByTestId("client-row").find((r) => r.textContent?.includes("Ania"))!);
    expect(screen.queryByTestId("client-twin")).toBeNull();
    expect(screen.getByTestId("client-merge-run")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Klient do scalenia z tą kartą"), { target: { value: getClients().find((c) => c.name === "Zenon")!.id } });
    fireEvent.click(screen.getByTestId("client-merge-run"));
    expect(getClients().map((c) => c.name)).toEqual(["Ania"]);
  });

  it("ostrzega przed duplikatem nazwy i prowadzi do istniejącego klienta", () => {
    addClient({ name: "Łukasz Żółć" });
    render(<ClientsView />);
    fireEvent.click(screen.getByTestId("client-new"));
    fireEvent.change(screen.getByTestId("new-client-name"), { target: { value: "lukasz zolc" } });
    expect(screen.getByTestId("new-client-twin")).toHaveTextContent("Łukasz Żółć");
    fireEvent.click(within(screen.getByTestId("new-client-twin")).getByRole("button"));
    expect(screen.getByTestId("client-card")).toBeInTheDocument();
  });

  it("szuka po telefonie i NIP-ie, a brak wyniku mówi to wprost", () => {
    addClient({ name: "Ania", phone: "+48 512 333 444" });
    addClient({ name: "Firma Bud", kind: "company", nip: NIP });
    render(<ClientsView />);
    expect(screen.getAllByTestId("client-row")).toHaveLength(2);

    fireEvent.change(screen.getByTestId("clients-search"), { target: { value: "512333" } });
    expect(screen.getAllByTestId("client-row").map((r) => r.textContent)).toEqual([expect.stringContaining("Ania")]);
    fireEvent.change(screen.getByTestId("clients-search"), { target: { value: NIP.slice(0, 6) } });
    expect(screen.getAllByTestId("client-row")[0]).toHaveTextContent("Firma Bud");
    fireEvent.change(screen.getByTestId("clients-search"), { target: { value: "nikt" } });
    expect(screen.getByTestId("clients-none")).toHaveTextContent("nikt");
  });

  it("karta: zły NIP nie zapisuje się i pokazuje błąd, poprawny trafia do kartoteki", () => {
    const c = addClient({ name: "Ania" })!;
    render(<ClientsView />);
    fireEvent.click(screen.getByTestId("client-row"));
    const nip = screen.getByLabelText(/NIP/);
    fireEvent.focus(nip);

    fireEvent.change(nip, { target: { value: "123" } });
    fireEvent.blur(nip);
    expect(screen.getByRole("alert")).toHaveTextContent(/Nieprawidłowy NIP/);
    expect(getClients()[0].nip).toBe("");

    fireEvent.change(nip, { target: { value: "526-025-02-74" } });
    fireEvent.blur(nip);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getClients().find((x) => x.id === c.id)?.nip).toBe(NIP);
  });

  it("karta: pusta nazwa jest odrzucona, a usunięcie ma „Cofnij” i zachowuje powiązanie z budową", () => {
    const c = addClient({ name: "Ania" })!;
    linkSiteToClient("budowa-1", c.id);
    render(<ClientsView />);
    expect(screen.getByTestId("client-row")).toHaveTextContent("1 budowa");
    fireEvent.click(screen.getByTestId("client-row"));

    const name = screen.getByLabelText("Nazwa");
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.blur(name);
    expect(screen.getByRole("alert")).toHaveTextContent(/nie może być pusta/);
    expect(getClients()[0].name).toBe("Ania");

    act(() => { fireEvent.click(screen.getByTestId("client-remove")); });
    expect(getClients()).toEqual([]);
    expect(screen.queryByTestId("client-card")).toBeNull();
  });
});
