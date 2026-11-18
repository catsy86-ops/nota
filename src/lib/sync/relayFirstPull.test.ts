import { describe, it, expect, vi, afterEach } from "vitest";

// Rola karty: test sam decyduje, czy ta karta prowadzi przekaźnik, czy inna.
const role = vi.hoisted(() => ({ elsewhere: null as null | (() => void) }));
vi.mock("@/lib/tabLock", () => ({
  RELAY_ROLE: "relay",
  holdTabRole: (_name: string, _lead: () => void, elsewhere: () => void) => {
    role.elsewhere = elsewhere;
    return () => {};
  },
}));

import { relayFirstPull, setRelayUrl, startRelay, stopRelay } from "@/lib/sync/relayRuntime";

const settled = async (p: Promise<void>) => {
  let done = false;
  void p.then(() => { done = true; });
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

afterEach(() => {
  stopRelay();
  setRelayUrl("");
  vi.useRealTimers();
});

describe("relayFirstPull (W4)", () => {
  it("bez przekaźnika nie czeka", async () => {
    setRelayUrl("");
    await startRelay("kod");
    expect(await settled(relayFirstPull())).toBe(true);
  });

  it("czeka do chwili, gdy przekaźnik prowadzi inna karta", async () => {
    setRelayUrl("https://sync.example.pl");
    await startRelay("kod");
    const p = relayFirstPull();
    expect(await settled(p)).toBe(false);
    role.elsewhere!();
    expect(await settled(p)).toBe(true);
  });

  it("stop zwalnia czekających", async () => {
    setRelayUrl("https://sync.example.pl");
    await startRelay("kod");
    const p = relayFirstPull();
    stopRelay();
    expect(await settled(p)).toBe(true);
  });

  it("po limicie czasu WebRTC startuje bez pobrania", async () => {
    vi.useFakeTimers();
    setRelayUrl("https://sync.example.pl");
    await startRelay("kod");
    const p = relayFirstPull(1000);
    expect(await settled(p)).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(await settled(p)).toBe(true);
  });
});
