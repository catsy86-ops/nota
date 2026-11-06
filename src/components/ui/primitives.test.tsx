import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthNav } from "@/components/ui/month-nav";

// Plan UI 2026-11-06, Etap 1: wspólne prymitywy.
describe("Button loading", () => {
  it("blokuje przycisk, ustawia aria-busy i podmienia ikonę na kółko, zostawiając etykietę", () => {
    const { container } = render(<Button loading><Save data-testid="icon" />Zapisz</Button>);
    const btn = screen.getByRole("button", { name: "Zapisz" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("icon")).toBeNull();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("bez loading nic nie zmienia", () => {
    render(<Button><Save data-testid="icon" />Zapisz</Button>);
    const btn = screen.getByRole("button", { name: "Zapisz" });
    expect(btn).toBeEnabled();
    expect(btn).not.toHaveAttribute("aria-busy");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("pigułka ma tylko rounded-full, bez rounded-control", () => {
    render(<Button variant="pill" size="pill">Budowa</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("rounded-full");
    expect(cls).not.toContain("rounded-control");
  });
});

describe("MonthNav", () => {
  it("strzałki i tytuł wywołują swoje akcje", () => {
    const onPrev = vi.fn(), onNext = vi.fn(), onCurrent = vi.fn();
    render(<MonthNav label="listopad 2026" onPrev={onPrev} onNext={onNext} onCurrent={onCurrent} />);
    fireEvent.click(screen.getByRole("button", { name: "Poprzedni miesiąc" }));
    fireEvent.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    fireEvent.click(screen.getByRole("button", { name: "listopad 2026" }));
    expect([onPrev, onNext, onCurrent].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("listopad 2026");
  });

  it("bez onCurrent tytuł jest tekstem, nie przyciskiem", () => {
    render(<MonthNav label="maj 2026" onPrev={() => {}} onNext={() => {}} />);
    expect(screen.queryByRole("button", { name: "maj 2026" })).toBeNull();
  });
});
