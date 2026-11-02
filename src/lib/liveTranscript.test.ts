import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type W = Record<string, unknown>;
const w = window as unknown as W;

class Fake {
  static instances: Fake[] = [];
  lang = ""; continuous = false; interimResults = false; processLocally = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() { Fake.instances.push(this); }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  abort() {}
  say(t: string) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: t } }] }); }
}

async function load(avail: string | null) {
  vi.resetModules();
  // Osobna klasa na każde wczytanie — statyczne `available` nie przechodzą między testami.
  class F extends Fake {}
  w.SpeechRecognition = Object.assign(F, avail ? { available: () => Promise.resolve(avail), install: () => Promise.resolve(true) } : {});
  if (avail === "available") localStorage.setItem("kaczy.dictation.local.v1", "1");
  return import("./liveTranscript");
}

beforeEach(() => { Fake.instances = []; localStorage.clear(); });
afterEach(() => { delete w.SpeechRecognition; });

describe("liveTranscript", () => {
  it("tryb: lokalnie z pobranym polskim; chmura tylko ze zgodą", async () => {
    expect((await load("available")).transcriptMode()).toBe("local");
    expect((await load(null)).transcriptMode()).toBeNull();
    localStorage.setItem("kaczy.dictation.consent", "1");
    expect((await load(null)).transcriptMode()).toBe("cloud");
  });

  it("zdania do onText, wznowienie po ciszy, stop kończy", async () => {
    const m = await load("available");
    const texts: string[] = [];
    const t = m.startTranscript((x) => texts.push(x), () => { throw new Error("nie powinno"); })!;
    expect(Fake.instances[0].processLocally).toBe(true);
    Fake.instances[0].say(" pierwsze ");
    Fake.instances[0].onend?.();
    expect(Fake.instances).toHaveLength(2);
    Fake.instances[1].say("drugie");
    t.stop();
    expect(Fake.instances).toHaveLength(2);
    expect(texts).toEqual(["pierwsze", "drugie"]);
  });

  it("błąd mikrofonu: onFail raz, bez wznawiania; cisza nie jest błędem", async () => {
    const m = await load("available");
    const fail = vi.fn();
    m.startTranscript(() => {}, fail);
    Fake.instances[0].onerror?.({ error: "no-speech" });
    Fake.instances[0].onend?.();
    expect(fail).not.toHaveBeenCalled();
    Fake.instances[1].onerror?.({ error: "audio-capture" });
    Fake.instances[1].onend?.();
    expect(fail).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledWith("audio-capture");
    expect(Fake.instances).toHaveLength(2);
  });

  it("przełącznik zapamiętany na urządzeniu", async () => {
    const m = await load(null);
    expect(m.liveTextWanted()).toBe(false);
    m.setLiveTextWanted(true);
    expect(m.liveTextWanted()).toBe(true);
    m.setLiveTextWanted(false);
    expect(m.liveTextWanted()).toBe(false);
  });
});
