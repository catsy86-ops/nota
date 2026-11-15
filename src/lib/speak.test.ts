import { afterEach, describe, expect, it, vi } from "vitest";
import { speak, speechAvailable, stopSpeaking } from "./speak";

class FakeUtterance {
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error sprzątanie atrapy
  delete window.speechSynthesis;
});

function install() {
  const synth = { cancel: vi.fn(), speak: vi.fn() };
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  return synth;
}

describe("speak", () => {
  it("bez API zwraca false i nie rzuca", () => {
    expect(speechAvailable()).toBe(false);
    expect(speak("Dzień dobry")).toBe(false);
    expect(() => stopSpeaking()).not.toThrow();
  });

  it("czyta po polsku, przerywa poprzednie i woła onEnd raz", () => {
    const synth = install();
    const onEnd = vi.fn();
    expect(speak("Raport dnia", onEnd)).toBe(true);
    expect(synth.cancel).toHaveBeenCalled();
    const u = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(u.lang).toBe("pl-PL");
    u.onend?.();
    u.onerror?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("pusty tekst i błąd silnika dają false", () => {
    const synth = install();
    expect(speak("   ")).toBe(false);
    synth.speak.mockImplementation(() => { throw new Error("silnik"); });
    expect(speak("tekst")).toBe(false);
  });
});
