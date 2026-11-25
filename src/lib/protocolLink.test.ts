import { describe, expect, it, vi } from "vitest";
import { applyProtocolLink, protocolLinkPath } from "./protocolLink";

describe("protocolLinkPath (Q3.7)", () => {
  it("notatka, budowa i widoki — z `//` i bez, z kodowaniem z przeglądarki", () => {
    expect(protocolLinkPath("web+notatnik:notatka/abc-1")).toBe("/notatka/abc-1");
    expect(protocolLinkPath("web+notatnik://notatka/abc-1")).toBe("/notatka/abc-1");
    expect(protocolLinkPath("web+notatnik%3Anotatka%2Fabc")).toBeNull();
    expect(protocolLinkPath("web+notatnik:notatka%2Fabc")).toBe("/notatka/abc");
    expect(protocolLinkPath("WEB+NOTATNIK:budowa/lipowa_5")).toBe("/praca?budowa=lipowa_5");
    expect(protocolLinkPath("web+notatnik:dzis")).toBe("/dzis");
    expect(protocolLinkPath("web+notatnik:")).toBe("/");
  });

  it("obce i nieznane linki odpadają — nic z linku nie trafia do adresu dosłownie", () => {
    for (const raw of [null, "", "https://evil.example/notatka/x", "web+notatnik:notatka/../../x", "web+notatnik:notatka/a b", "web+notatnik:notatka/x/y",
      "web+notatnik:ustawienia", "web+notatnik://evil.example", "web+notatnik:notatka/", `web+notatnik:notatka/${"a".repeat(101)}`, "web+notatnik:%E0%A4%A"]) {
      expect(protocolLinkPath(raw), String(raw)).toBeNull();
    }
  });

  it("applyProtocolLink podmienia adres bez wpisu w historii; zły link → strona główna; bez `link` nic", () => {
    const hist = { state: { a: 1 }, replaceState: vi.fn() } as unknown as History;
    applyProtocolLink({ search: "?link=web%2Bnotatnik%3Anotatka%2Fn1" } as Location, hist);
    expect(hist.replaceState).toHaveBeenLastCalledWith({ a: 1 }, "", "/notatka/n1");
    applyProtocolLink({ search: "?link=javascript%3Aalert(1)" } as Location, hist);
    expect(hist.replaceState).toHaveBeenLastCalledWith({ a: 1 }, "", "/");
    vi.mocked(hist.replaceState).mockClear();
    applyProtocolLink({ search: "?q=x" } as Location, hist);
    expect(hist.replaceState).not.toHaveBeenCalled();
  });
});
