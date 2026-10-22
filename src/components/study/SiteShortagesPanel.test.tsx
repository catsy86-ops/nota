import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SiteInfo } from "@/lib/study/sites";
import type { Shortage } from "@/lib/study/shortages";

const setSiteShortages = vi.fn();
const toastWithUndo = vi.fn();
const studyMock = vi.fn((): { shortagesDropped?: Record<string, number> } => ({}));
vi.mock("@/lib/study/store", () => ({ setSiteShortages: (...a: unknown[]) => setSiteShortages(...a), useStudy: () => studyMock() }));
vi.mock("@/lib/undoToast", () => ({ toastWithUndo: (...a: unknown[]) => toastWithUndo(...a) }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));

const { SiteShortagesPanel } = await import("./SiteShortagesPanel");

const short = (over: Partial<Shortage>): Shortage => ({ id: "x", text: "Rura", qty: "", status: "missing", at: 1, ...over });
const siteWith = (shortages: Shortage[]) => ({ id: "dom", name: "Dom Kowalski", shortages }) as unknown as SiteInfo;

beforeEach(() => {
  setSiteShortages.mockReset();
  toastWithUndo.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SiteShortagesPanel — braki materiału", () => {
  it("pusta lista pokazuje podpowiedź, a „Dodaj” jest wyłączone bez tekstu", () => {
    render(<SiteShortagesPanel site={siteWith([])} />);
    expect(screen.getByText(/Dopisz, czego brakuje/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodaj brak" })).toBeDisabled();
  });

  it("dopisanie pozycji z ilością zapisuje ją ze statusem „Brakuje”", () => {
    render(<SiteShortagesPanel site={siteWith([])} />);
    fireEvent.change(screen.getByLabelText("Czego brakuje"), { target: { value: "Rura PEX 16" } });
    fireEvent.change(screen.getByLabelText("Ile"), { target: { value: "50 m" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj brak" }));

    expect(setSiteShortages).toHaveBeenCalledTimes(1);
    const [siteId, next, before] = setSiteShortages.mock.calls[0];
    expect(siteId).toBe("dom");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: "Rura PEX 16", qty: "50 m", status: "missing" });
    expect(before).toEqual([]);
  });

  it("stuknięcie statusu przechodzi brakuje → zamówione", () => {
    const list = [short({ id: "a", text: "Kolano 16" })];
    render(<SiteShortagesPanel site={siteWith(list)} />);
    fireEvent.click(screen.getByRole("button", { name: /Kolano 16: Brakuje/ }));

    const [, next] = setSiteShortages.mock.calls[0];
    expect(next[0].status).toBe("ordered");
  });

  it("data dostawy pojawia się tylko przy statusie „Zamówione”", () => {
    render(<SiteShortagesPanel site={siteWith([short({ id: "a", text: "Kolano 16", status: "ordered" })])} />);
    expect(screen.getByLabelText("Data dostawy: Kolano 16")).toBeInTheDocument();
  });

  it("usunięcie pozycji idzie przez „Cofnij”", () => {
    const list = [short({ id: "a", text: "Kolano 16" }), short({ id: "b", text: "Trójnik" })];
    render(<SiteShortagesPanel site={siteWith(list)} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń brak: Kolano 16" }));

    const [, after, before] = setSiteShortages.mock.calls[0];
    expect(after.map((s: Shortage) => s.id)).toEqual(["b"]);
    expect(before.map((s: Shortage) => s.id)).toEqual(["a", "b"]);
    expect(toastWithUndo).toHaveBeenCalledWith(expect.stringContaining("Kolano 16"), expect.any(Function));
  });

  it("„Wyczyść dostarczone” zostawia pozycje niedostarczone i pokazuje liczbę", () => {
    const list = [short({ id: "a", text: "Kolano" }), short({ id: "b", text: "Trójnik", status: "delivered" })];
    render(<SiteShortagesPanel site={siteWith(list)} />);
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść dostarczone (1)" }));

    const [, after] = setSiteShortages.mock.calls[0];
    expect(after.map((s: Shortage) => s.id)).toEqual(["a"]);
  });

  it("„Kopiuj braki” jest wyłączone, gdy wszystko dostarczone", () => {
    render(<SiteShortagesPanel site={siteWith([short({ id: "a", status: "delivered" })])} />);
    expect(screen.getByRole("button", { name: /Kopiuj braki/ })).toBeDisabled();
  });

  it("pełna lista (40) mówi, co zrobić, i nie pokazuje pola dodawania", () => {
    const full = Array.from({ length: 40 }, (_, i) => short({ id: `p${i}`, text: `Pozycja ${i}`, at: i + 1 }));
    render(<SiteShortagesPanel site={siteWith(full)} />);
    expect(screen.getByText(/Lista pełna \(40\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Czego brakuje")).toBeNull();
  });

  it("braki ponad limit od innego urządzenia: panel mówi, ile nie widać", () => {
    studyMock.mockReturnValue({ shortagesDropped: { dom: 3 } });
    render(<SiteShortagesPanel site={siteWith([short({ id: "q1" })])} />);
    expect(screen.getByText(/Ponad 40 braków: 3 braki nie widać/)).toBeInTheDocument();
    studyMock.mockReturnValue({});
  });
});
