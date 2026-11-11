import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { SiteBillingDues } from "./SiteBillingDues";
import { getSiteBilling } from "@/lib/study/billingStore";
import type { SiteBilling } from "@/lib/study/billing";

const site = { id: "t31-site", name: "Lipowa 5", created: 1_700_000_000_000 } as never;
const billing = (payments: SiteBilling["payments"] = []): SiteBilling => ({ modes: ["lump"], lump: 5000, typeRates: {}, stageAmounts: {}, payments });

beforeEach(() => { toastMock.error.mockClear(); });
afterEach(() => cleanup());

describe("SiteBillingDues (T31)", () => {
  it("ryczałt bez wpłat: do zapłaty cała kwota", () => {
    render(<SiteBillingDues site={site} billing={billing()} points={[]} />);
    expect(screen.getByTestId("billing-due")).toHaveTextContent(/Zostało do zapłaty/);
    expect(screen.getByTestId("billing-due")).toHaveTextContent(/5\D?000/);
  });

  it("wpłata 3 000 zmniejsza kwotę do 2 000, wpłata ponad ryczałt daje nadpłatę", () => {
    const pay = (amount: number) => [{ id: "p1", day: "2026-11-03", amount }];
    const { rerender } = render(<SiteBillingDues site={site} billing={billing(pay(3000))} points={[]} />);
    expect(screen.getByTestId("billing-due")).toHaveTextContent(/Zostało do zapłaty/);
    expect(screen.getByTestId("billing-due")).toHaveTextContent(/2\D?000/);
    rerender(<SiteBillingDues site={site} billing={billing(pay(6000))} points={[]} />);
    expect(screen.getByTestId("billing-due")).toHaveTextContent(/Nadpłata/);
  });

  it("zła kwota wpłaty daje komunikat i nic nie zapisuje; poprawna trafia do magazynu", () => {
    render(<SiteBillingDues site={site} billing={billing()} points={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Wpłata \(zaliczka\)/ }));
    const form = screen.getByRole("form", { name: "Nowa wpłata" });
    fireEvent.change(within(form).getByLabelText("Kwota wpłaty (zł)"), { target: { value: "abc" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz wpłatę" }));
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/^Wpłata: wpisz kwotę/));
    expect(getSiteBilling("t31-site").payments).toHaveLength(0);

    fireEvent.change(within(form).getByLabelText("Kwota wpłaty (zł)"), { target: { value: "1250,50" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz wpłatę" }));
    expect(getSiteBilling("t31-site").payments.map((p) => p.amount)).toEqual([1250.5]);
  });
});
