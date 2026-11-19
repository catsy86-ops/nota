import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { yjsStore } from "@/lib/yjsStore";
import { DEVICES_MAP, getLocalDeviceId } from "@/lib/deviceRegistry";
import { DeviceRegistryList } from "./DeviceRegistryList";

const DAY = 86_400_000;
const map = () => yjsStore.doc.getMap(DEVICES_MAP);

describe("lista urządzeń z rejestru (D4.3)", () => {
  beforeEach(() => { map().clear(); });

  it("nic, gdy w rejestrze jest tylko to urządzenie", () => {
    map().set(getLocalDeviceId(), { name: "Ja", schema: 3, at: Date.now() });
    render(<DeviceRegistryList />);
    expect(screen.queryByTestId("sync-registry")).toBeNull();
  });

  it("pokazuje inne urządzenia, ostrzega przy starym i zapomina", () => {
    map().set("tablettab1", { name: "Tablet", schema: 1, version: "2026.10.01", at: Date.now() - 40 * DAY });
    map().set("laptoplap1", { name: "Laptop", schema: 999, at: Date.now() });
    render(<DeviceRegistryList />);
    expect(screen.getByText("Tablet")).toBeTruthy();
    expect(screen.getAllByText(/Może stracić dane/)).toHaveLength(1);
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Zapomnij urządzenie Tablet" })); });
    expect(map().has("tablettab1")).toBe(false);
    expect(screen.queryByText("Tablet")).toBeNull();
  });
});
