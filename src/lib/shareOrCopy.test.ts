import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareOrCopy } from "./shareOrCopy";

// Udostępnianie z wyjściem do schowka (§5.4): każdy wynik ma jedną, przewidywalną ścieżkę.
describe("shareOrCopy", () => {
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText } } });
  });
  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: nav });
  });

  it("bez udostępniania kopiuje do schowka", async () => {
    expect(await shareOrCopy({ text: "raport" })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("raport");
  });

  it("udostępnia, gdy system na to pozwala", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    expect(await shareOrCopy({ title: "Raport", text: "treść" })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Raport", text: "treść" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("anulowanie okna nie kopiuje i nie jest błędem", async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" })) });
    expect(await shareOrCopy({ text: "t" })).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("inny błąd udostępniania przechodzi do schowka", async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error("nope")) });
    expect(await shareOrCopy({ text: "t" })).toBe("copied");
  });

  it("brak schowka to wynik „failed”", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    expect(await shareOrCopy({ text: "t" })).toBe("failed");
  });
});
