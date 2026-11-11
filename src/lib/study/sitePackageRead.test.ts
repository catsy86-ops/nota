import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { buildSitePackage } from "./sitePackage";
import { compressBudowa, DECOMPRESSED_MAX_BYTES } from "./budowaCompression";
import { readSitePackageFile } from "./sitePackageIo";

// jsdom nie ma Blob.stream()/arrayBuffer() ani File.text() — używamy natywnych z Node.
beforeAll(() => { vi.stubGlobal("Blob", NodeBlob); vi.stubGlobal("File", NodeFile); });
afterAll(() => { vi.unstubAllGlobals(); });

const NOW = Date.now();
const json = JSON.stringify(buildSitePackage(
  { id: "lipowa-5", name: "Lipowa 5", address: "Lipowa 5, Kraków", shortages: [{ id: "s1", text: "Rura PEX 16", qty: "50 m", status: "missing" as const, at: NOW - 1000 }] },
  { entries: [], rooms: [], points: [] },
  { by: "Marek", now: NOW, access: false },
));
const asFile = (parts: BlobPart[]) => new NodeFile(parts as never[], "x.budowa") as unknown as File;

describe("readSitePackageFile — formaty .budowa (B5.2)", () => {
  it("czyta zwykły JSON (v1), czyli to, co wysyła starsza wersja aplikacji", async () => {
    const r = await readSitePackageFile(asFile([json]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pkg.shortages[0].text).toBe("Rura PEX 16");
  });

  it("czyta paczkę skompresowaną (v2) tak samo jak JSON", async () => {
    const blob = await compressBudowa(json);
    const r = await readSitePackageFile(asFile([blob]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pkg.shortages[0].text).toBe("Rura PEX 16");
  });

  it("odrzuca bombę gzip: deklarowany rozmiar po rozpakowaniu ponad limit", async () => {
    const blob = await compressBudowa("0".repeat(DECOMPRESSED_MAX_BYTES + 1));
    const r = await readSitePackageFile(asFile([blob]));
    expect(r.ok).toBe(false);
  });

  it("odrzuca uszkodzony nagłówek v2 i poprawny JSON z cudzym formatem", async () => {
    expect((await readSitePackageFile(asFile([new Uint8Array([0x42, 0x44, 0x57, 0xff, 0xff, 0xff])]))).ok).toBe(false);
    expect((await readSitePackageFile(asFile([JSON.stringify({ format: "inny" })]))).ok).toBe(false);
  });
});
