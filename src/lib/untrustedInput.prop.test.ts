import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { MAX_BACKUP_VERSION, parseFullBackup } from "@/lib/backup/parse";
import { parseKeepHtml, parseKeepJson } from "@/lib/import/keep";
import { parseFrontmatter, parseMarkdownNote } from "@/lib/import/markdown";
import { parseIcs } from "@/lib/icsImport";
import { MAX_TEXT, MAX_TITLE, parseShare } from "@/lib/shareTarget";
import { parseShareParam, SHARE_PARAM_MAX_CHARS } from "@/lib/shareLink";
import { cleanSchemaClaim } from "@/lib/formatSchema";
import { cleanRecord } from "@/lib/ksef/yInvoices";
import { cleanSellerPrefs } from "@/lib/ksef/sellerPrefs";
import { cleanJobMeta } from "@/lib/study/jobs";
import { cleanSignature } from "@/lib/study/signature";
import { cleanSiteDocs } from "@/lib/study/siteDocs";
import { cleanSiteHours } from "@/lib/study/siteHours";
import { parseSitePackage, SITE_PACKAGE_FORMAT, SITE_PACKAGE_VERSION } from "@/lib/study/sitePackage";

/**
 * S1.7: testy własności dla parserów niezaufanych wejść (kopia JSON, import Keep i Markdown, ICS, link i cel
 * udostępniania, paczka budowy, `clean*` rekordów od peera). Własności: parser nie rzuca nieobsłużonego wyjątku,
 * nie zanieczyszcza prototypu i nie zwraca obiektu z własnym kluczem `__proto__`, respektuje limity rozmiaru.
 */

const RUNS = { numRuns: 300 };
const NOW = Date.UTC(2026, 10, 23);

/** Klucze, które psują naiwne `Object.assign`/rekurencyjne scalanie, obok kluczy prawdziwych formatów. */
const KEYS = ["__proto__", "constructor", "prototype", "toString", "polluted", "title", "content", "text", "notes", "version", "schema", "format",
  "site", "entries", "id", "name", "at", "items", "labels", "checklist", "images", "t", "c", "co", "l", "cl", "number", "seller", "buyer"];

/** Wartości JSON z groźnymi kluczami (fast-check tworzy własne właściwości `__proto__` przez `defineProperty`). */
const hostile = fc.letrec((tie) => ({
  value: fc.oneof({ maxDepth: 4 },
    fc.constant(null), fc.boolean(), fc.double({ noNaN: true }), fc.string({ maxLength: 40 }), fc.integer(),
    fc.array(tie("value"), { maxLength: 4 }),
    fc.dictionary(fc.constantFrom(...KEYS), tie("value"), { maxKeys: 6 })),
})).value;

/** Tekst: dowolny napis, JSON z groźnymi kluczami albo JSON ucięty/uszkodzony. */
const text = fc.oneof(
  fc.string({ maxLength: 300 }),
  hostile.map((v) => JSON.stringify(v)),
  hostile.chain((v) => { const j = JSON.stringify(v); return fc.nat(j.length).map((n) => j.slice(0, n)); }),
);

/** Zbiera własne klucze `__proto__`/`constructor`/`prototype` z całego drzewa wyniku. */
function dangerousKeys(v: unknown, path = "$", seen = new Set<unknown>()): string[] {
  if (!v || typeof v !== "object" || seen.has(v)) return [];
  seen.add(v);
  const out: string[] = [];
  for (const k of Reflect.ownKeys(v)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") out.push(`${path}.${String(k)}`);
    out.push(...dangerousKeys((v as Record<string | symbol, unknown>)[k], `${path}.${String(k)}`, seen));
  }
  return out;
}

const clean = (): void => {
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
};

/**
 * Parser synchroniczny: nie rzuca, wynik bez groźnych kluczy, prototyp nietknięty. `mayThrow`: udokumentowany wyjątek
 * (np. `SyntaxError` z `JSON.parse`, który łapie wołający) — każdy inny jest błędem.
 */
function sync<A extends unknown[]>(name: string, arb: fc.Arbitrary<A>, fn: (...a: A) => unknown, mayThrow?: ErrorConstructor | SyntaxErrorConstructor) {
  it(`${name}: ${mayThrow ? `rzuca najwyżej ${mayThrow.name}, ` : "nie rzuca, "}nie zanieczyszcza prototypu, bez własnych kluczy __proto__`, () => {
    fc.assert(fc.property(arb, (args) => {
      try {
        expect(dangerousKeys(fn(...args))).toEqual([]);
      } catch (e) {
        if (!mayThrow || !(e instanceof mayThrow)) throw e;
      }
      clean();
    }), RUNS);
  });
}

describe("parsery niezaufanych wejść (S1.7)", () => {
  sync("parseShareParam", fc.tuple(fc.oneof(text, text.map((t) => btoa(encodeURIComponent(t))))), (raw) => parseShareParam(raw));
  sync("parseShare", fc.tuple(fc.constantFrom("/share", "/share/", "/", "/x"), text), (p, s) => parseShare(p, `?${s}`));
  sync("parseSitePackage", fc.tuple(text), (raw) => parseSitePackage(raw, NOW));
  sync("parseKeepJson", fc.tuple(text, fc.string({ maxLength: 20 })), (t, src) => parseKeepJson(t, src), SyntaxError); // plan.ts łapie SyntaxError („Uszkodzony plik”)
  sync("parseKeepHtml", fc.tuple(fc.string({ maxLength: 400 }), fc.string({ maxLength: 20 })), (h, src) => parseKeepHtml(h, src));
  sync("parseFrontmatter", fc.tuple(fc.oneof(fc.string({ maxLength: 300 }), fc.string({ maxLength: 80 }).map((b) => `---\n${b}\n---\ntreść`))), (t) => parseFrontmatter(t));
  sync("parseMarkdownNote", fc.tuple(fc.oneof(fc.string({ maxLength: 300 }), fc.string({ maxLength: 80 }).map((b) => `---\n${b}\n---\ntreść`))), (t) => parseMarkdownNote(t, { path: "a/b.md", lastModified: NOW }));
  sync("parseIcs", fc.tuple(fc.oneof(fc.string({ maxLength: 400 }), fc.string({ maxLength: 60 }).map((b) => `BEGIN:VCALENDAR\nBEGIN:VEVENT\n${b}\nEND:VEVENT\nEND:VCALENDAR`))), (t) => parseIcs(t, NOW));

  // Czyszczenie rekordów od peera: wejście to dowolna wartość JSON.
  sync("cleanSchemaClaim", fc.tuple(hostile), (v) => cleanSchemaClaim(v));
  sync("cleanRecord (faktura)", fc.tuple(hostile), (v) => cleanRecord(v));
  sync("cleanSellerPrefs", fc.tuple(hostile), (v) => cleanSellerPrefs(v));
  sync("cleanJobMeta", fc.tuple(hostile), (v) => cleanJobMeta(v));
  sync("cleanSignature", fc.tuple(hostile), (v) => cleanSignature(v));
  sync("cleanSiteDocs", fc.tuple(hostile), (v) => cleanSiteDocs(v));
  sync("cleanSiteHours", fc.tuple(hostile), (v) => cleanSiteHours(v));

  it("parseFullBackup: wynik albo odrzucenie Error — nigdy inny wyjątek, prototyp nietknięty", async () => {
    await fc.assert(fc.asyncProperty(text, async (t) => {
      try {
        const out = await parseFullBackup(t);
        expect(dangerousKeys(out)).toEqual([]);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
      clean();
    }), { numRuns: 150 });
  });
});

describe("kontrola samego harnessu (S1.7)", () => {
  it("dangerousKeys widzi własny klucz __proto__ z JSON.parse, także zagnieżdżony", () => {
    expect(dangerousKeys(JSON.parse('{"a":{"__proto__":{"polluted":true}}}'))).toEqual(["$.a.__proto__"]);
    expect(dangerousKeys({ a: 1 })).toEqual([]);
  });

  it("generator naprawdę produkuje groźne klucze (inaczej testy przechodziłyby na pusto)", () => {
    const texts = fc.sample(hostile.map((v) => JSON.stringify(v)), { numRuns: 400, seed: 1 });
    expect(texts.some((t) => t.includes('"__proto__"'))).toBe(true);
    expect(texts.some((t) => t.includes('"constructor"'))).toBe(true);
  });
});

describe("limity rozmiaru (S1.7)", () => {
  it("parseShareParam: ponad limit znaków → null", () => {
    expect(parseShareParam("a".repeat(SHARE_PARAM_MAX_CHARS + 1))).toBeNull();
  });

  it("parseShare: tytuł i treść nie przekraczają limitów, niezależnie od wejścia", () => {
    fc.assert(fc.property(fc.string({ maxLength: 30_000 }), fc.string({ maxLength: 30_000 }), (title, body) => {
      const out = parseShare("/share", `?title=${encodeURIComponent(title)}&text=${encodeURIComponent(body)}`);
      if (out) {
        expect(out.title.length).toBeLessThanOrEqual(MAX_TITLE);
        expect(out.content.length).toBeLessThanOrEqual(MAX_TEXT + 2_100); // tekst + ewentualny adres (MAX_URL)
      }
    }), { numRuns: 60 });
  });

  it("parseSitePackage: plik ponad ~56 MB odrzucony bez parsowania", () => {
    const r = parseSitePackage(" ".repeat(60_000_000), NOW);
    expect(r.ok).toBe(false);
  });

  it("parseSitePackage: nowsza wersja formatu odrzucona, bieżąca przyjęta", () => {
    const base = { format: SITE_PACKAGE_FORMAT, site: { id: "s1", name: "Budowa" }, entries: [] };
    expect(parseSitePackage(JSON.stringify({ ...base, version: SITE_PACKAGE_VERSION + 1 }), NOW).ok).toBe(false);
    expect(parseSitePackage(JSON.stringify({ ...base, version: SITE_PACKAGE_VERSION }), NOW).ok).toBe(true);
  });

  it("parseFullBackup: kopia z nowszej koperty odrzucona przed jakimkolwiek parsowaniem sekcji", async () => {
    await expect(parseFullBackup(JSON.stringify({ notes: [], version: MAX_BACKUP_VERSION + 1 }))).rejects.toThrow(/nowszej wersji/);
  });
});
