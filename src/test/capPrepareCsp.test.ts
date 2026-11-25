import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Q2.2: CSP z jednego źródła. Nagłówek dla hostingu jest w `vercel.json` (netlify.toml sprawdza `securityHeaders.test.ts`),
 * a powłoka Androida dostaje tę samą politykę jako <meta> z `scripts/cap-prepare.mjs`. Tu: obie postaci się zgadzają.
 */
type CapPrepare = {
  cspFromVercel(json: unknown): string;
  cspForMeta(header: string): string;
  withCspMeta(html: string, csp: string): string;
};
const root = resolve(__dirname, "../..");
const load = () => import(/* @vite-ignore */ resolve(root, "scripts/cap-prepare.mjs")) as Promise<CapPrepare>;
const directives = (csp: string) => new Map(csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => [d.split(/\s+/)[0], d] as const));

describe("CSP dla powłoki Androida (Q2.2)", () => {
  it("<meta> ma każdą dyrektywę nagłówka poza tymi, które działają tylko w nagłówku", async () => {
    const { cspFromVercel, cspForMeta } = await load();
    const header = cspFromVercel(JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")));
    const meta = directives(cspForMeta(header));
    const head = directives(header);
    for (const [name, value] of head) {
      if (name === "frame-ancestors") expect(meta.has(name), name).toBe(false);
      else expect(meta.get(name), name).toBe(value);
    }
    expect(meta.size).toBe(head.size - 1);
    // Trusted Types (S1.1) działają też z <meta>, więc powłoka ich nie gubi.
    expect(meta.get("require-trusted-types-for")).toBe("require-trusted-types-for 'script'");
  });

  it("<meta> staje zaraz po <meta charset>, przed skryptami; drugi raz — błąd", async () => {
    const { withCspMeta } = await load();
    const html = `<html><head><meta charset="UTF-8"><script src="/a.js"></script></head></html>`;
    const out = withCspMeta(html, "default-src 'self'; style-src 'self' \"x\"");
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script"));
    expect(out).toContain('content="default-src \'self\'; style-src \'self\' &quot;x&quot;"');
    expect(() => withCspMeta(out, "x")).toThrow();
    expect(() => withCspMeta("<html></html>", "x")).toThrow();
  });
});
