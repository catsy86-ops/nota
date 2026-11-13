import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { NewSiteDialog } from "./NewSiteDialog";
import { addClient } from "@/lib/clients/store";
import { yjsStore } from "@/lib/yjsStore";

beforeEach(async () => {
  localStorage.clear();
  await yjsStore.resetForTests();
});
afterEach(() => cleanup());

const open = () => render(<NewSiteDialog open onOpenChange={() => {}} dir={[]} onCreated={() => {}} initialJob />);

describe("NewSiteDialog: klient z kartoteki (2.1)", () => {
  it("telefon i adres klienta wchodzą po wyjściu z pola, a nie przy pisaniu krótszej nazwy", () => {
    addClient({ name: "Jan", phone: "111 111 111", address1: "Krótka 1" });
    addClient({ name: "Jan Kowalski", phone: "222 222 222", address1: "Długa 2" });
    open();
    const client = screen.getByLabelText("Klient", { exact: true });
    const phone = screen.getByLabelText("Telefon") as HTMLInputElement;
    const address = screen.getByLabelText("Adres", { exact: true }) as HTMLInputElement;

    // Pisanie „Jan” przechodzi przez nazwę krótszego klienta — nic nie może się uzupełnić.
    fireEvent.change(client, { target: { value: "Jan" } });
    fireEvent.change(client, { target: { value: "Jan Kowalski" } });
    expect(phone.value).toBe("");
    expect(address.value).toBe("");

    fireEvent.blur(client);
    expect(phone.value).toBe("222 222 222");
    expect(address.value).toBe("Długa 2");
  });

  it("wyjście z pola nie nadpisuje już wpisanego telefonu i adresu, a nieznana nazwa nic nie zmienia", () => {
    addClient({ name: "Jan Kowalski", phone: "222 222 222", address1: "Długa 2" });
    open();
    const client = screen.getByLabelText("Klient", { exact: true });
    const phone = screen.getByLabelText("Telefon") as HTMLInputElement;
    fireEvent.change(phone, { target: { value: "600 000 000" } });
    fireEvent.change(client, { target: { value: "Jan Kowalski" } });
    fireEvent.blur(client);
    expect(phone.value).toBe("600 000 000");
    expect((screen.getByLabelText("Adres", { exact: true }) as HTMLInputElement).value).toBe("Długa 2");

    fireEvent.change(client, { target: { value: "Ktoś Obcy" } });
    fireEvent.blur(client);
    expect(phone.value).toBe("600 000 000");
  });
});
