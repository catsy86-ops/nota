import { describe, it, expect } from "vitest";
import { listZip, safeZipPath } from "./zip";
import { collectSources } from "./collect";
import { buildZip } from "./__fixtures__/zipBuilder";

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("listZip", () => {
  it("czyta wpisy stored i deflate", async () => {
    const zip = buildZip([
      { name: "Takeout/Keep/a.json", data: '{"title":"A"}'.repeat(50) },
      { name: "Takeout/Keep/b.txt", data: "surowy", method: 0 },
    ]);
    const { entries } = listZip(new Uint8Array(zip));
    expect(entries.map((e) => e.name)).toEqual(["Takeout/Keep/a.json", "Takeout/Keep/b.txt"]);
    expect(dec(await entries[0].read())).toBe('{"title":"A"}'.repeat(50));
    expect(dec(await entries[1].read())).toBe("surowy");
  });

  it("odrzuca ścieżki wychodzące poza archiwum i katalogi", () => {
    expect(safeZipPath("../etc/passwd")).toBeNull();
    expect(safeZipPath("/abs.md")).toBeNull();
    expect(safeZipPath("C:/x.md")).toBeNull();
    expect(safeZipPath("dir/")).toBeNull();
    expect(safeZipPath("a\\b.md")).toBe("a/b.md");
    const zip = buildZip([{ name: "../zly.md", data: "x", method: 0 }, { name: "ok.md", data: "y", method: 0 }]);
    expect(listZip(new Uint8Array(zip)).entries.map((e) => e.name)).toEqual(["ok.md"]);
  });

  it("rzuca na pliku, który nie jest ZIP-em", () => {
    expect(() => listZip(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });

  it("limit rozpakowania zatrzymuje „bombę”", async () => {
    const zip = buildZip([{ name: "duzy.md", data: "a".repeat(100_000) }]);
    const { entries } = listZip(new Uint8Array(zip));
    await expect(entries[0].read(1000)).rejects.toThrow();
  });
});

describe("collectSources", () => {
  it("rozpakowuje ZIP i zostawia zwykłe pliki z ich ścieżką względną", async () => {
    const zip = buildZip([{ name: "Keep/a.json", data: "{}" }]);
    const zipFile = new File([new Uint8Array(zip)], "takeout.zip", { type: "application/zip" });
    const md = new File(["# x"], "n.md");
    Object.defineProperty(md, "webkitRelativePath", { value: "Vault/sub/n.md" });
    const res = await collectSources([zipFile, md]);
    expect(res.sources.map((s) => s.path)).toEqual(["Keep/a.json", "Vault/sub/n.md"]);
    expect(await res.sources[0].text()).toBe("{}");
  });

  it("uszkodzony ZIP trafia do failures i nie przerywa reszty", async () => {
    const bad = new File([new Uint8Array([1, 2, 3])], "zly.zip");
    const ok = new File(["x"], "a.md");
    const res = await collectSources([bad, ok]);
    expect(res.failures).toHaveLength(1);
    expect(res.sources.map((s) => s.path)).toEqual(["a.md"]);
  });
});
