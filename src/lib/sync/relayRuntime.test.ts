import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRelay, validRelayUrl } from "@/lib/sync/relayRuntime";

describe("validRelayUrl", () => {
  it("przyjmuje https i http tylko dla localhost", () => {
    expect(validRelayUrl("https://sync.example.pl")).toBe("https://sync.example.pl");
    expect(validRelayUrl("http://localhost:4466")).toBe("http://localhost:4466");
    expect(validRelayUrl("http://127.0.0.1:4466")).toBe("http://127.0.0.1:4466");
  });

  it("obcina końcowe ukośniki i białe znaki", () => {
    expect(validRelayUrl("  https://sync.example.pl//  ")).toBe("https://sync.example.pl");
  });

  it("odrzuca http do obcego hosta, inne schematy i śmieci", () => {
    expect(validRelayUrl("http://sync.example.pl")).toBeNull();
    expect(validRelayUrl("ws://sync.example.pl")).toBeNull();
    expect(validRelayUrl("javascript:alert(1)")).toBeNull();
    expect(validRelayUrl("nie-url")).toBeNull();
    expect(validRelayUrl("   ")).toBeNull();
  });
});

describe("checkRelay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zwraca liczbę pokoi, gdy /health odpowiada jak przekaźnik", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, rooms: 3 }), { status: 200 })));
    expect(await checkRelay("https://sync.example.pl")).toEqual({ ok: true, rooms: 3 });
  });

  it("odrzuca odpowiedź, która nie jest przekaźnikiem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    const r = await checkRelay("https://sync.example.pl");
    expect(r.ok).toBe(false);
  });

  it("zgłasza kod HTTP i brak połączenia", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    expect(await checkRelay("https://sync.example.pl")).toEqual({ ok: false, reason: "Serwer odpowiedział kodem 503" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect((await checkRelay("https://sync.example.pl")).ok).toBe(false);
  });

  it("nie wysyła zapytania pod niepoprawny adres", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await checkRelay("http://obcy.example")).ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
