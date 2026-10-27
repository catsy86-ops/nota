import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { DelayedSpinner } from "./DelayedSpinner";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DelayedSpinner — wskaźnik po 300 ms (plan 3.3)", () => {
  it("przy aktywnej operacji jest niewidoczny przed 300 ms, potem widoczny", () => {
    vi.useFakeTimers();
    const { container } = render(<DelayedSpinner active />);
    const icon = container.querySelector("svg")!;
    expect(icon.classList.contains("invisible")).toBe(true);
    act(() => { vi.advanceTimersByTime(299); });
    expect(icon.classList.contains("invisible")).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(icon.classList.contains("invisible")).toBe(false);
  });

  it("szybkie zakończenie nie pokazuje kółka wcale", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<DelayedSpinner active />);
    act(() => { vi.advanceTimersByTime(100); });
    rerender(<DelayedSpinner active={false} />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(container.querySelector("svg")!.classList.contains("invisible")).toBe(true);
  });

  it("ukryty jest też dla czytnika ekranu", () => {
    const { container } = render(<DelayedSpinner active />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});
