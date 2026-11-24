import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedEndpoint, endpointFetch, endpointSocket, isLocalEndpoint, isPrivateHost, sameOriginFetch } from "./endpoints";
import { validRelayUrl } from "@/lib/sync/relayRuntime";
import { normalizePushServer } from "@/lib/push/prefs";
import { parseSignalingList } from "@/lib/yjsSync";

const ok = (raw: string, kind: "http" | "ws") => allowedEndpoint(new URL(raw), kind);

describe("S1.2: allowedEndpoint", () => {
  it("szyfrowane do każdego hosta, nieszyfrowane tylko do pętli zwrotnej", () => {
    expect(ok("https://relay.example.com", "http")).toBe(true);
    expect(ok("wss://signal.example.com", "ws")).toBe(true);
    expect(ok("http://localhost:8787", "http")).toBe(true);
    expect(ok("ws://127.0.0.1:4444", "ws")).toBe(true);
    expect(ok("ws://[::1]:4444", "ws")).toBe(true);
    expect(ok("http://relay.example.com", "http")).toBe(false);
    expect(ok("ws://signal.example.com", "ws")).toBe(false);
    // Sieć prywatna bez szyfrowania też nie — CSP i tak by ją zablokował.
    expect(ok("ws://192.168.1.10:4444", "ws")).toBe(false);
  });
  it("odrzuca zły rodzaj, dane logowania w adresie i inne schematy", () => {
    expect(ok("wss://x.example", "http")).toBe(false);
    expect(ok("https://x.example", "ws")).toBe(false);
    expect(ok("https://user:pass@x.example", "http")).toBe(false);
    expect(ok("javascript:alert(1)", "http")).toBe(false);
    expect(ok("data:text/plain,x", "http")).toBe(false);
  });
});

describe("S1.2: serwer lokalny", () => {
  it.each(["localhost", "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.1", "192.168.0.2", "169.254.1.1", "nas.local", "[fd12:3456::1]", "[fe80::1]", "[::1]"])("%s jest lokalny", (h) => {
    expect(isPrivateHost(h)).toBe(true);
  });
  it.each(["example.com", "8.8.8.8", "172.32.0.1", "192.169.0.1", "[2001:db8::1]", "local.example.com"])("%s nie jest lokalny", (h) => {
    expect(isPrivateHost(h)).toBe(false);
  });
  it("isLocalEndpoint czyta adres, zły adres to nie lokalny", () => {
    expect(isLocalEndpoint("wss://192.168.1.10:4444")).toBe(true);
    expect(isLocalEndpoint("https://relay.example.com")).toBe(false);
    expect(isLocalEndpoint("nie adres")).toBe(false);
  });
});

describe("S1.2: połączenia", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("endpointFetch przepuszcza dozwolony adres, inny odrzuca bez połączenia", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(endpointFetch("https://relay.example.com/health")).resolves.toBeInstanceOf(Response);
    await expect(endpointFetch("http://relay.example.com/health")).rejects.toThrow(TypeError);
    await expect(endpointFetch("nie adres")).rejects.toThrow(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("endpointSocket odrzuca ws:// do obcego hosta", () => {
    const Ws = vi.fn();
    vi.stubGlobal("WebSocket", Ws);
    expect(() => endpointSocket("ws://evil.example/ws")).toThrow(TypeError);
    endpointSocket("wss://relay.example.com/ws");
    expect(Ws).toHaveBeenCalledWith("wss://relay.example.com/ws");
  });

  it("sameOriginFetch: tylko pliki aplikacji", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await sameOriginFetch("/ocr/7.0.0/worker.min.js");
    await expect(sameOriginFetch("https://cdn.example.com/worker.js")).rejects.toThrow(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("S1.2: walidatory ustawień używają tej samej zasady", () => {
  it("przekaźnik, serwer powiadomień i serwery sygnalizacyjne", () => {
    expect(validRelayUrl("https://relay.example.com/")).toBe("https://relay.example.com");
    expect(validRelayUrl("http://192.168.1.2:8787")).toBeNull();
    expect(normalizePushServer("push.example.com")).toBe("https://push.example.com");
    expect(normalizePushServer("http://push.example.com")).toBeNull();
    const list = parseSignalingList("wss://a.example ws://b.example ws://localhost:4444");
    expect(list.valid).toEqual(["wss://a.example", "ws://localhost:4444"]);
    expect(list.invalid).toEqual(["ws://b.example"]);
  });
});
