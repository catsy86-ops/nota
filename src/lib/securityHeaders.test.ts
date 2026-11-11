import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Nagłówki bezpieczeństwa hostingu (Plan-nowy 1.11). Źródłem jest vercel.json: z niego czyta je też
 * `vite preview` (e2e pod egzekwowanym CSP). netlify.toml musi mieć te same wartości.
 */
const root = resolve(__dirname, "../..");

function vercelHeaders(): Record<string, string> {
  const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const rule = vercel.headers.find((h) => h.source === "/(.*)");
  return Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
}

function netlifyHeaders(): Record<string, string> {
  const toml = readFileSync(resolve(root, "netlify.toml"), "utf8");
  const block = toml.split("[[headers]]").find((b) => /for = "\/\*"/.test(b))?.split("[headers.values]")[1] ?? "";
  return Object.fromEntries(Array.from(block.matchAll(/^\s+([\w-]+) = "(.*)"$/gm), (m) => [m[1], m[2]]));
}

describe("nagłówki bezpieczeństwa", () => {
  it("vercel.json i netlify.toml mają te same nagłówki dla wszystkich stron", () => {
    expect(netlifyHeaders()).toEqual(vercelHeaders());
  });

  it("CSP jest egzekwowane i bez skryptów inline", () => {
    const h = vercelHeaders();
    expect(h["Content-Security-Policy-Report-Only"]).toBeUndefined();
    const csp = h["Content-Security-Policy"];
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval';/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("HSTS na rok, bez includeSubDomains (S17)", () => {
    const hsts = vercelHeaders()["Strict-Transport-Security"];
    expect(hsts).toBe("max-age=31536000");
    expect(hsts).not.toContain("includeSubDomains");
  });

  it("Permissions-Policy nie blokuje kamery (kod QR) ani lokalizacji („Tu jestem”) tej stronie", () => {
    const pp = vercelHeaders()["Permissions-Policy"];
    expect(pp).toContain("camera=(self)");
    expect(pp).toContain("geolocation=(self)");
  });
});
