import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasLocalSpeechApi, installLocalSpeech, localSpeechReady, localSpeechStatus, setLocalSpeechReady } from "./localSpeech";

type W = Record<string, unknown>;
const w = window as unknown as W;

beforeEach(() => localStorage.clear());
afterEach(() => { delete w.SpeechRecognition; delete w.webkitSpeechRecognition; });

function fakeApi(initial: unknown) {
  let avail = initial;
  const available = vi.fn(() => (avail instanceof Error ? Promise.reject(avail) : Promise.resolve(avail)));
  const install = vi.fn(() => { avail = "available"; return Promise.resolve(true); });
  w.SpeechRecognition = Object.assign(function Rec() {}, { available, install });
  return { available, install, set: (v: unknown) => { avail = v; } };
}

describe("localSpeech", () => {
  it("bez API: brak wiersza, flaga nic nie znaczy, pytanie daje „unsupported”", async () => {
    w.SpeechRecognition = function Rec() {};
    expect(hasLocalSpeechApi()).toBe(false);
    setLocalSpeechReady(true);
    expect(localSpeechReady()).toBe(false);
    expect(await localSpeechStatus()).toBe("unsupported");
    expect(await installLocalSpeech()).toBe(false);
  });

  it("samo sprawdzenie API nie pyta przeglądarki (pułapka: available() wywraca kartę)", () => {
    const api = fakeApi("available");
    expect(hasLocalSpeechApi()).toBe(true);
    expect(localSpeechReady()).toBe(false);
    expect(api.available).not.toHaveBeenCalled();
  });

  it("odpowiedź ustawia flagę; pobranie; nieznana odpowiedź i błąd zdejmują flagę", async () => {
    const api = fakeApi("downloadable");
    expect(await localSpeechStatus()).toBe("downloadable");
    expect(api.available).toHaveBeenCalledWith({ langs: ["pl-PL"], processLocally: true });
    expect(localSpeechReady()).toBe(false);
    expect(await installLocalSpeech()).toBe(true);
    expect(localSpeechReady()).toBe(true);
    api.set("coś");
    expect(await localSpeechStatus()).toBe("unavailable");
    expect(localSpeechReady()).toBe(false);
    api.set(new Error("x"));
    expect(await localSpeechStatus()).toBe("unavailable");
  });
});
