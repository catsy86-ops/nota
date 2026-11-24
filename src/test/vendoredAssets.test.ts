import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import spec from "../../scripts/vendored-assets.json";

// S5.5 (plan bezpieczeństwa): zasoby w public/ spoza paczki Vite mają spisane źródło, wersję i sumę.
// Commitowane czcionki muszą dać się odtworzyć skryptem z zablokowanego pakietu npm co do bajtu,
// a wersje w spisie — zgadzać się z package-lock.json (aktualizacja pakietu wymusza aktualizację spisu).
const root = process.cwd();
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as { packages: Record<string, { version: string; license?: string }> };
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("zasoby wbudowane (S5.5)", () => {
  it.each([...spec.committed, ...spec.copied])("$package: wersja i licencja zgodne z package-lock.json", (a) => {
    const pkg = lock.packages[`node_modules/${a.package}`];
    expect(pkg, `${a.package} nie ma w package-lock.json`).toBeDefined();
    expect(pkg.version).toBe(a.version);
    expect(pkg.license).toBe(a.license);
  });

  it.each(spec.committed)("$file: suma SHA-256 zgodna ze spisem", (a) => {
    expect(sha256(join(root, a.file))).toBe(a.sha256);
  });

  const tmp = mkdtempSync(join(tmpdir(), "notki-fonts-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("czcionki PDF odtwarzają się skryptem z pakietu npm co do bajtu", () => {
    execFileSync(process.execPath, [join(root, "scripts", "build-pdf-font.mjs"), tmp], { cwd: root, stdio: "ignore" });
    for (const a of spec.committed.filter((x) => x.script === "scripts/build-pdf-font.mjs")) {
      expect(sha256(join(tmp, basename(a.file))), a.file).toBe(a.sha256);
    }
  });
});
