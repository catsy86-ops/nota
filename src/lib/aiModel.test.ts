import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_INPUT_MAX, aiAvailability, hasAISummarizer, summarizeText } from "./aiModel";

const setApi = (api: unknown) => { (globalThis as { Summarizer?: unknown }).Summarizer = api; };
afterEach(() => { delete (globalThis as { Summarizer?: unknown }).Summarizer; });

describe("aiModel (Summarizer)", () => {
  it("bez API: brak wsparcia, niedostępny, null", async () => {
    expect(hasAISummarizer()).toBe(false);
    expect(await aiAvailability()).toBe("unavailable");
    expect(await summarizeText("tekst")).toBeNull();
  });

  it("streszcza dostępnym modelem, przycina wejście i zwalnia model", async () => {
    const destroy = vi.fn();
    const summarize = vi.fn().mockResolvedValue("  Pion sprawdzony.  ");
    const create = vi.fn().mockResolvedValue({ summarize, destroy });
    setApi({ availability: async () => "available", create });
    expect(hasAISummarizer()).toBe(true);
    expect(await summarizeText("x".repeat(AI_INPUT_MAX + 500), "key-points")).toBe("Pion sprawdzony.");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: "key-points", format: "plain-text" }));
    expect(summarize.mock.calls[0][0]).toHaveLength(AI_INPUT_MAX);
    expect(destroy).toHaveBeenCalled();
  });

  it("model niedostępny, błąd modelu, pusty wynik i pusty tekst dają null", async () => {
    setApi({ availability: async () => "unavailable", create: vi.fn() });
    expect(await summarizeText("tekst")).toBeNull();
    setApi({ availability: async () => "available", create: async () => ({ summarize: async () => { throw new Error("boom"); } }) });
    expect(await summarizeText("tekst")).toBeNull();
    setApi({ availability: async () => "available", create: async () => ({ summarize: async () => "   " }) });
    expect(await summarizeText("tekst")).toBeNull();
    expect(await summarizeText("   ")).toBeNull();
  });
});

describe("aiModel: stany pobierania (T24)", () => {
  it("model „do pobrania” jest uruchamiany świadomie (pobranie przy pierwszym użyciu), „pobiera się” też", async () => {
    for (const state of ["downloadable", "downloading"]) {
      const create = vi.fn().mockResolvedValue({ summarize: async () => "Wynik" });
      setApi({ availability: async () => state, create });
      expect(await aiAvailability()).toBe(state);
      expect(await summarizeText("tekst"), state).toBe("Wynik");
      expect(create).toHaveBeenCalledTimes(1);
    }
  });

  it("availability rzuca wyjątek: niedostępny, bez próby tworzenia modelu", async () => {
    const create = vi.fn();
    setApi({ availability: async () => { throw new Error("boom"); }, create });
    expect(await aiAvailability()).toBe("unavailable");
    expect(await summarizeText("tekst")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

