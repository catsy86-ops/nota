import { afterEach, describe, expect, it, vi } from "vitest";

type Rules = Record<string, (input: string) => string | null>;

describe("polityka Trusted Types (S1.1)", () => {
  afterEach(() => {
    vi.resetModules();
    delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
  });

  async function load() {
    let rules: Rules = {};
    const createPolicy = vi.fn((name: string, r: Rules) => { rules = r; return { name }; });
    (globalThis as { trustedTypes?: unknown }).trustedTypes = { createPolicy };
    const mod = await import("./trustedTypes");
    return { mod, createPolicy, rules: () => rules };
  }

  it("tworzy politykę default przy imporcie", async () => {
    const { createPolicy } = await load();
    expect(createPolicy).toHaveBeenCalledWith("default", expect.any(Object));
  });

  it("HTML przechodzi tylko w oknie Mermaida, skrypty nigdy", async () => {
    const { mod, rules } = await load();
    expect(rules().createHTML("<b>x</b>")).toBeNull();
    await mod.withMermaidSink(async () => {
      expect(rules().createHTML("<svg/>")).toBe("<svg/>");
      expect(rules().createScript("alert(1)")).toBeNull();
      expect(rules().createScriptURL("https://x/y.js")).toBeNull();
    });
  });

  it("adres skryptu tylko z własnego źródła (service worker, Workery)", async () => {
    const { rules } = await load();
    expect(rules().createScriptURL("/sw.js")).toBe("/sw.js");
    expect(rules().createScriptURL(`${location.origin}/assets/worker.js`)).toBe(`${location.origin}/assets/worker.js`);
    expect(rules().createScriptURL(`blob:${location.origin}/1234`)).toBe(`blob:${location.origin}/1234`);
    expect(rules().createScriptURL("https://evil.example/sw.js")).toBeNull();
    expect(rules().createScriptURL("data:text/javascript,alert(1)")).toBeNull();
  });

  it("HTML poza oknem Mermaida jest blokowany", async () => {
    const { rules } = await load();
    expect(rules().createHTML("<b>x</b>")).toBeNull();
  });

  it("okno zamyka się też po błędzie", async () => {
    const { mod, rules } = await load();
    await expect(mod.withMermaidSink(async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(rules().createHTML("<b/>")).toBeNull();
  });

  it("bez Trusted Types w przeglądarce nic nie robi", async () => {
    vi.resetModules();
    const mod = await import("./trustedTypes");
    await expect(mod.withMermaidSink(async () => 1)).resolves.toBe(1);
  });
});
