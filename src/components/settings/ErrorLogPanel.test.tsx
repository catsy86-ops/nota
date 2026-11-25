import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ErrorLogPanel } from "./ErrorLogPanel";
import { clearErrorLogForTests, getErrorLog, logDeviceError } from "@/lib/diagnostics";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

afterEach(() => { cleanup(); clearErrorLogForTests(); });

describe("ErrorLogPanel (Q1.6)", () => {
  it("pusty stan mówi, że błędów nie ma", () => {
    render(<ErrorLogPanel initial={[]} />);
    expect(screen.getByTestId("error-log-empty")).toBeTruthy();
  });

  it("„Skopiuj” wkłada tekst do schowka, „Wyczyść” opróżnia listę", async () => {
    logDeviceError("uncaught", "TypeError: boom");
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ErrorLogPanel />);
    expect(screen.getByText("TypeError: boom")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skopiuj" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("[uncaught] TypeError: boom")));
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(screen.getByTestId("error-log-empty")).toBeTruthy();
    expect(getErrorLog()).toEqual([]);
  });
});
