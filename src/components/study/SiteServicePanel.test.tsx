import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SiteInfo } from "@/lib/study/sites";
import type { ServiceCall } from "@/lib/study/service";

const setSiteService = vi.fn();
const setSiteWarranty = vi.fn();
const toastWithUndo = vi.fn();
vi.mock("@/lib/study/store", () => ({
  setSiteService: (...a: unknown[]) => setSiteService(...a),
  setSiteWarranty: (...a: unknown[]) => setSiteWarranty(...a),
}));
vi.mock("@/lib/undoToast", () => ({ toastWithUndo: (...a: unknown[]) => toastWithUndo(...a) }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));

const { SiteServicePanel } = await import("./SiteServicePanel");

// Dziś 19 października 2026, południe — terminy liczone względem tej daty.
const TODAY = "2026-10-19";
const dayAhead = (n: number) => {
  const d = new Date(2026, 9, 19 + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const call = (over: Partial<ServiceCall>): ServiceCall => ({ id: "c1", text: "Cieknie syfon", at: new Date(2026, 9, 10, 9).getTime(), ...over });
const siteWith = (service: ServiceCall[], warranty?: string) => ({ id: "dom", name: "Dom", service, warranty }) as unknown as SiteInfo;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 19, 12));
  setSiteService.mockReset();
  setSiteWarranty.mockReset();
  toastWithUndo.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SiteServicePanel — serwis i gwarancja", () => {
  it("nowe zgłoszenie z terminem wizyty zapisuje się z datą", () => {
    render(<SiteServicePanel site={siteWith([])} />);
    fireEvent.change(screen.getByLabelText("Nowe zgłoszenie serwisowe"), { target: { value: "Kapie bateria" } });
    fireEvent.change(screen.getByLabelText("Termin wizyty"), { target: { value: dayAhead(2) } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));

    const [siteId, next] = setSiteService.mock.calls[0];
    expect(siteId).toBe("dom");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: "Kapie bateria", due: dayAhead(2) });
  });

  it("termin dziś albo zaległy jest oznaczony", () => {
    render(<SiteServicePanel site={siteWith([call({ id: "a", text: "Dziś", due: TODAY }), call({ id: "b", text: "Stary", due: dayAhead(-2) })])} />);
    expect(screen.getByText(/wizyta dziś/)).toBeInTheDocument();
    expect(screen.getByText(/wizyta zaległe 2 dni/)).toBeInTheDocument();
  });

  it("zamknięcie wymaga opisu „co zrobiono” i trafia do historii", () => {
    render(<SiteServicePanel site={siteWith([call({ id: "a", text: "Cieknie syfon" })])} />);
    fireEvent.click(screen.getByRole("button", { name: /Załatwione/ }));
    fireEvent.change(screen.getByLabelText("Co zrobiono"), { target: { value: "wymieniona uszczelka" } });
    fireEvent.submit(screen.getByLabelText("Co zrobiono").closest("form")!);

    const [, next] = setSiteService.mock.calls[0];
    expect(next[0].done).toBeDefined();
    expect(next[0].solution).toBe("wymieniona uszczelka");
  });

  it("usunięcie zgłoszenia idzie przez „Cofnij”", () => {
    render(<SiteServicePanel site={siteWith([call({ id: "a", text: "Cieknie syfon" })])} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń zgłoszenie: Cieknie syfon" }));

    const [, after, before] = setSiteService.mock.calls[0];
    expect(after).toEqual([]);
    expect(before).toHaveLength(1);
    expect(toastWithUndo).toHaveBeenCalledTimes(1);
  });

  it("gwarancja pokazuje, ile dni zostało, i zapisuje datę", () => {
    render(<SiteServicePanel site={siteWith([], dayAhead(10))} />);
    expect(screen.getByTestId("site-warranty")).toHaveTextContent("zostało 10 dni");

    fireEvent.change(screen.getByLabelText("Koniec gwarancji"), { target: { value: dayAhead(40) } });
    expect(setSiteWarranty).toHaveBeenCalledWith("dom", dayAhead(40));
  });

  it("po końcu gwarancji widać to w etykiecie", () => {
    render(<SiteServicePanel site={siteWith([], dayAhead(-1))} />);
    expect(screen.getByTestId("site-warranty")).toHaveTextContent("po gwarancji");
  });

  it("załatwione są schowane, a „Otwórz ponownie” cofa zamknięcie", () => {
    const done = call({ id: "a", text: "Cieknie syfon", done: new Date(2026, 9, 15, 10).getTime(), solution: "uszczelka" });
    render(<SiteServicePanel site={siteWith([done])} />);
    expect(screen.queryByTestId("site-service-done")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Załatwione \(1\)/ }));
    expect(screen.getByText(/→ uszczelka/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Otwórz ponownie: Cieknie syfon" }));
    const [, next] = setSiteService.mock.calls[0];
    expect(next[0].done).toBeUndefined();
  });
});
