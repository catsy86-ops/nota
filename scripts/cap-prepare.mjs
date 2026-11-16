// Przygotowuje `dist/` dla powłoki Androida (F1): wpisuje politykę CSP jako <meta>, bo WebView
// czyta pliki z paczki aplikacji i nie dostaje nagłówków z vercel.json. Uruchamiane po `vite build`,
// przed `cap sync` (npm run build:android). Polityka pochodzi z vercel.json — jedno źródło prawdy.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Dyrektywy, których przeglądarka nie przyjmuje z <meta> (działają tylko jako nagłówek). */
const HEADER_ONLY = new Set(["frame-ancestors", "report-uri", "report-to", "sandbox"]);

/** Polityka z nagłówka w postaci dla <meta http-equiv>. */
export function cspForMeta(header) {
  return header
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && !HEADER_ONLY.has(d.split(/\s+/)[0].toLowerCase()))
    .join("; ");
}

export function cspFromVercel(json) {
  for (const rule of json.headers ?? []) {
    const h = (rule.headers ?? []).find((x) => x.key.toLowerCase() === "content-security-policy");
    if (h) return h.value;
  }
  throw new Error("vercel.json nie ma nagłówka Content-Security-Policy");
}

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** Wstawia <meta> zaraz po <meta charset> — polityka musi stać przed pierwszym skryptem. */
export function withCspMeta(html, csp) {
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) throw new Error("index.html ma już politykę CSP w <meta>");
  const tag = `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}" />`;
  const out = html.replace(/(<meta charset=[^>]*>)/i, (m) => `${m}\n    ${tag}`);
  if (out === html) throw new Error("index.html bez <meta charset> — nie ma gdzie wstawić polityki CSP");
  return out;
}

if (process.argv[1] && import.meta.url ===pathToFileURL(process.argv[1]).href) {
  const csp = cspForMeta(cspFromVercel(JSON.parse(readFileSync("vercel.json", "utf8"))));
  writeFileSync("dist/index.html", withCspMeta(readFileSync("dist/index.html", "utf8"), csp));
  console.log(`CSP w dist/index.html: ${csp}`);
}
