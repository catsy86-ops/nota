import { describe, it, expect } from "vitest";
import { validRelayUrl } from "@/lib/sync/relayRuntime";

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
