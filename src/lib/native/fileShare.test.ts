import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  writeFile: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///cache/${path}` })),
  rmdir: vi.fn(async () => undefined),
}));
const share = vi.hoisted(() => ({ share: vi.fn(async () => ({})) }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@capacitor/filesystem", () => ({ Filesystem: fs, Directory: { Cache: "CACHE" } }));
vi.mock("@capacitor/share", () => ({ Share: share }));
vi.mock("@/lib/notify", () => ({ toast: { error: toastError } }));

import { blobToBase64, installShareShim, safeFileName, saveBlob, SHARE_CLEANUP_MS } from "./fileShare";

beforeEach(() => {
  fs.writeFile.mockClear();
  fs.rmdir.mockClear();
  share.share.mockReset().mockResolvedValue({});
  toastError.mockClear();
});

describe("fileShare (Z-13.4)", () => {
  it("nazwa pliku bez ukośników, znaków sterujących i kropek na początku", () => {
    expect(safeFileName("../../etc/passwd")).toBe("_.._etc_passwd");
    expect(safeFileName("raport\u0000:2026.pdf")).toBe("raport_2026.pdf");
    expect(safeFileName("...")).toBe("plik");
    expect(safeFileName("Kopia NOTKI.json")).toBe("Kopia NOTKI.json");
  });

  it("base64 dużego pliku (po kawałkach, bez przepełnienia stosu)", async () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => i & 0xff);
    const b64 = await blobToBase64(new Blob([bytes]));
    expect(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))).toEqual(bytes);
  });

  it("navigator.share z plikami: zapis do pamięci podręcznej i arkusz z adresami plików", async () => {
    const nav = {} as Navigator;
    installShareShim(nav);
    expect(fs.rmdir).toHaveBeenCalledWith(expect.objectContaining({ path: "out", directory: "CACHE", recursive: true }));
    expect(nav.canShare({ files: [] })).toBe(false);
    expect(nav.canShare({ files: [new File(["a"], "a.pdf")] })).toBe(true);
    await nav.share({ title: "Raport", text: "tekst", files: [new File(["a"], "a.pdf"), new File(["b"], "a.pdf")] });
    const paths = fs.writeFile.mock.calls.map((c) => (c[0] as unknown as { path: string }).path);
    expect(new Set(paths).size).toBe(2);
    expect(fs.writeFile.mock.calls.every((c) => (c[0] as unknown as { directory: string }).directory === "CACHE")).toBe(true);
    expect(share.share).toHaveBeenCalledWith(expect.objectContaining({ title: "Raport", text: "tekst", files: paths.map((p) => `file:///cache/${p}`) }));
  });

  it("anulowanie arkusza to AbortError, jak w przeglądarce", async () => {
    const nav = {} as Navigator;
    installShareShim(nav);
    share.share.mockRejectedValue(new Error("Share canceled"));
    await expect(nav.share({ text: "x" })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("saveBlob: anulowanie po cichu, inny błąd — komunikat zamiast wyjątku", async () => {
    share.share.mockRejectedValueOnce(new Error("Share canceled"));
    await saveBlob(new Blob(["x"]), "a.txt");
    expect(toastError).not.toHaveBeenCalled();
    share.share.mockRejectedValueOnce(new Error("No space"));
    await saveBlob(new Blob(["x"]), "a.txt");
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});

describe("bezpieczeństwo udostępniania", () => {
  it("url tylko http(s); file:// i content:// odrzucone", async () => {
    const nav = {} as Navigator;
    installShareShim(nav);
    await nav.share({ text: "a", url: "file:///data/data/x/db" });
    await nav.share({ text: "b", url: "content://evil/x" });
    await nav.share({ text: "c", url: "https://example.pl/a" });
    const urls = (share.share.mock.calls as unknown as [{ url?: string }][]).map((c) => c[0].url);
    expect(urls).toEqual([undefined, undefined, "https://example.pl/a"]);
  });

  it("pliki udostępnienia są kasowane po zamknięciu arkusza (z opóźnieniem), także po anulowaniu", async () => {
    // Sztuczne zegary blokują `FileReader` z jsdom — przechwytujemy samo zaplanowanie sprzątania.
    const planned: (() => void)[] = [];
    const realSetTimeout = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === SHARE_CLEANUP_MS) { planned.push(fn); return 0; }
      return realSetTimeout(fn, ms);
    }) as typeof setTimeout);
    try {
      const nav = {} as Navigator;
      installShareShim(nav);
      fs.rmdir.mockClear();
      share.share.mockRejectedValueOnce(new Error("Share canceled"));
      await expect(nav.share({ files: [new File(["k"], "kopia.json")] })).rejects.toMatchObject({ name: "AbortError" });
      expect(fs.rmdir).not.toHaveBeenCalled();
      expect(planned).toHaveLength(1);
      planned[0]();
      const calls = fs.writeFile.mock.calls as unknown as [{ path: string }][];
      const dir = calls[calls.length - 1][0].path.split("/").slice(0, 2).join("/");
      expect(fs.rmdir).toHaveBeenCalledWith(expect.objectContaining({ path: dir, directory: "CACHE", recursive: true }));
    } finally {
      spy.mockRestore();
    }
  });
});

describe("downloadBlob w powłoce", () => {
  it("idzie przez arkusz udostępniania, nie przez link", async () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    try {
      const { downloadBlob } = await import("@/lib/downloadBlob");
      downloadBlob(new Blob(["x"]), "plik.txt");
      await vi.waitFor(() => expect(share.share).toHaveBeenCalled());
      expect(click).not.toHaveBeenCalled();
    } finally {
      delete (window as { Capacitor?: unknown }).Capacitor;
      click.mockRestore();
    }
  });
});
