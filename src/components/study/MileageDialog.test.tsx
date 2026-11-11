import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { MileageDialog } from "./MileageDialog";
import { mileageStore } from "@/lib/study/companyPrefs";
import { EMPTY_MILEAGE } from "@/lib/study/mileage";

const dir = [{ id: "a", name: "Lipowa 5" }, { id: "b", name: "Polna 2" }] as never;

beforeEach(() => { mileageStore.set(EMPTY_MILEAGE); toastMock.error.mockClear(); toastMock.success.mockClear(); });
afterEach(() => cleanup());

const open = () => render(<MileageDialog open onOpenChange={() => undefined} dir={dir} />);

describe("MileageDialog (T31)", () => {
  it("zły kilometraż pokazuje komunikat i niczego nie zapisuje", () => {
    open();
    fireEvent.change(screen.getByLabelText(/Kilometry \(z licznika\)/), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj przejazd" }));
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/^Kilometry: wpisz liczbę/));
    expect(mileageStore.get().entries).toHaveLength(0);
  });

  it("poprawny przejazd trafia do magazynu z trasą i stawką, a lista i suma go pokazują", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Lipowa 5/ }));
    fireEvent.click(screen.getByRole("button", { name: /Polna 2/ }));
    fireEvent.change(screen.getByLabelText(/Kilometry \(z licznika\)/), { target: { value: "48,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj przejazd" }));
    const [saved] = mileageStore.get().entries;
    expect(saved).toMatchObject({ distance: 48.5, siteIds: ["a", "b"] });
    expect(screen.getAllByTestId("mileage-entry")).toHaveLength(1);
    expect(screen.getByTestId("mileage-total")).toHaveTextContent("48,5 km");
  });

  it("usunięcie przejazdu zdejmuje go z magazynu", () => {
    open();
    fireEvent.change(screen.getByLabelText(/Kilometry \(z licznika\)/), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj przejazd" }));
    fireEvent.click(screen.getByRole("button", { name: /^Usuń przejazd 10 km/ }));
    expect(mileageStore.get().entries).toHaveLength(0);
  });
});
