import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIPBOARD_CLEAR_MS, clearClipboardIfStill, scheduleClipboardClear } from "./clipboardClear";

const perms = (state: string) => ({ query: vi.fn(async () => ({ state })) });

describe("czyszczenie schowka po sekrecie (S1.9)", () => {
  it("odczyt dozwolony i schowek nadal ma sekret → czyści", async () => {
    const clip = { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "KOD") };
    expect(await clearClipboardIfStill("KOD", clip, perms("granted"))).toBe("cleared");
    expect(clip.writeText).toHaveBeenCalledWith("");
  });

  it("odczyt dozwolony, ale użytkownik skopiował już coś innego → zostawia", async () => {
    const clip = { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "inny tekst") };
    expect(await clearClipboardIfStill("KOD", clip, perms("granted"))).toBe("kept");
    expect(clip.writeText).not.toHaveBeenCalled();
  });

  it("bez zgody na odczyt nie odczytuje (żeby nie wywołać pytania), tylko czyści", async () => {
    const clip = { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "KOD") };
    expect(await clearClipboardIfStill("KOD", clip, perms("prompt"))).toBe("cleared");
    expect(clip.readText).not.toHaveBeenCalled();
    expect(clip.writeText).toHaveBeenCalledWith("");
  });

  it("odmowa zapisu (karta w tle) albo brak schowka → failed, bez wyjątku", async () => {
    const clip = { writeText: vi.fn(async () => { throw new Error("NotAllowedError"); }) };
    expect(await clearClipboardIfStill("KOD", clip, undefined)).toBe("failed");
    expect(await clearClipboardIfStill("KOD", undefined, undefined)).toBe("failed");
  });
});

describe("scheduleClipboardClear", () => {
  afterEach(() => vi.useRealTimers());

  it("czyści po 60 s, a anulowanie to blokuje", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    scheduleClipboardClear("KOD", CLIPBOARD_CLEAR_MS, run);
    vi.advanceTimersByTime(CLIPBOARD_CLEAR_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledWith("KOD");

    const cancel = scheduleClipboardClear("INNY", CLIPBOARD_CLEAR_MS, run);
    cancel();
    vi.advanceTimersByTime(CLIPBOARD_CLEAR_MS * 2);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
