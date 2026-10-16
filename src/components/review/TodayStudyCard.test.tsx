import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TodayStudyCardView } from "./TodayStudyCard";

afterEach(cleanup);

describe("TodayStudyCardView", () => {
  it("bez powtórek na dziś karty nie ma", () => {
    const { container } = render(<TodayStudyCardView due={0} onPractice={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("liczba pytań z odmianą i przycisk „Powtórz”", () => {
    const onPractice = vi.fn();
    render(<TodayStudyCardView due={3} onPractice={onPractice} />);
    expect(screen.getByTestId("today-study-count").textContent).toBe("3");
    expect(screen.getByTestId("today-study").textContent).toContain("pytania");
    fireEvent.click(screen.getByRole("button", { name: "Powtórz" }));
    expect(onPractice).toHaveBeenCalledOnce();
  });
});
