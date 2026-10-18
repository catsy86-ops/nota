import { describe, it, expect, vi } from "vitest";

// Osobny plik: ponowne łączenie zależy od stanu modułu (czas ostatniego połączenia),
// więc nie może dzielić go z resztą testów `yjsSync.test.ts`.
const providerInstances: MockProvider[] = [];

class MockProvider {
  roomName: string;
  destroyed = false;

  constructor(roomName: string) {
    this.roomName = roomName;
    providerInstances.push(this);
  }

  on() {}

  destroy() {
    this.destroyed = true;
  }
}

vi.mock("y-webrtc", () => ({
  WebrtcProvider: MockProvider,
}));

const CODE = "ABCDEFGHJKMN";

describe("ponowne łączenie po powrocie do karty", () => {
  it("łączy od nowa po powrocie do karty, ale nie częściej niż co 10 s", async () => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: CODE, signaling: [], legacyRoom: false }));
    const { initSync } = await import("./yjsSync");
    initSync();
    // Jeden pokój tekstu i jeden obrazów.
    await vi.waitFor(() => { if (providerInstances.length !== 2) throw new Error("not connected"); });
    const settled = providerInstances.length;

    // Zaraz po połączeniu powrót do karty nie restartuje połączenia.
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 20));
    expect(providerInstances.length).toBe(settled);

    // Po 10 s bez połączenia — tak.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11_000);
    try {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.waitFor(() => { if (providerInstances.length <= settled) throw new Error("not reconnected"); });
    } finally {
      vi.restoreAllMocks();
    }
  });
});
