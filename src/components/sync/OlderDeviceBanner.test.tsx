import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const state = { devices: [] as { id: number; name: string; schema?: number }[] };
vi.mock("@/lib/yjsSync", () => ({ useSyncState: () => state }));

import { OlderDeviceBanner } from "./OlderDeviceBanner";

describe("baner starszej wersji (P3.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    state.devices = [];
  });

  it("nic, gdy wszystkie urządzenia są aktualne", () => {
    state.devices = [{ id: 1, name: "Telefon", schema: 999 }];
    render(<OlderDeviceBanner onOpenSync={() => {}} />);
    expect(screen.queryByTestId("older-device-banner")).toBeNull();
  });

  it("pokazuje starsze urządzenie, „Szczegóły” otwiera Sync, „Ukryj” chowa ten zestaw", () => {
    state.devices = [{ id: 1, name: "Stary tablet", schema: 0 }];
    const open = vi.fn();
    const { unmount } = render(<OlderDeviceBanner onOpenSync={open} />);
    expect(screen.getByTestId("older-device-banner").textContent).toContain("Stary tablet ma starszą wersję");
    fireEvent.click(screen.getByRole("button", { name: "Szczegóły" }));
    expect(open).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ukryj ostrzeżenie o starszej wersji" }));
    expect(screen.queryByTestId("older-device-banner")).toBeNull();
    unmount();

    // Po ponownym uruchomieniu ten sam zestaw zostaje ukryty…
    render(<OlderDeviceBanner onOpenSync={open} />);
    expect(screen.queryByTestId("older-device-banner")).toBeNull();
  });

  it("…a nowe starsze urządzenie pokazuje baner znowu", () => {
    state.devices = [{ id: 1, name: "Stary tablet", schema: 0 }];
    localStorage.setItem("kaczy.olderDeviceBanner.v1", "1:0");
    state.devices = [{ id: 1, name: "Stary tablet", schema: 0 }, { id: 2, name: "Laptop", schema: 0 }];
    render(<OlderDeviceBanner onOpenSync={() => {}} />);
    expect(screen.getByTestId("older-device-banner").textContent).toContain("mają starszą wersję");
  });
});
