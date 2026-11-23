import { describe, expect, it } from "vitest";
import { isRestorablePath, launchTarget, readLastSeen, resumeTarget, RESUME_TODAY_AFTER_MS, writeLastSeen } from "./resumeView";

const H = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const root = { pathname: "/", search: "" };

describe("resumeView (Q3.4, QL-3)", () => {
  it("zimny start z ikony: do 4 h ostatni dział, od 4 h „Dziś”", () => {
    expect(RESUME_TODAY_AFTER_MS).toBe(4 * H);
    expect(launchTarget(root, { at: NOW - 3 * H, path: "/praca?budowa=x" }, NOW)).toBe("/praca?budowa=x");
    expect(launchTarget(root, { at: NOW - 4 * H, path: "/praca" }, NOW)).toBe("/dzis");
    expect(launchTarget(root, { at: NOW - 30 * H, path: "/" }, NOW)).toBe("/dzis");
  });

  it("zimny start bez zapisu, na „/” albo z linku do konkretnego miejsca — zostaje", () => {
    expect(launchTarget(root, null, NOW)).toBeNull();
    expect(launchTarget(root, { at: NOW - H, path: "/" }, NOW)).toBeNull();
    expect(launchTarget({ pathname: "/grafik", search: "" }, { at: NOW - 9 * H, path: "/praca" }, NOW)).toBeNull();
    expect(launchTarget({ pathname: "/", search: "?new=1" }, { at: NOW - 9 * H, path: "/praca" }, NOW)).toBeNull();
  });

  it("nie przywraca udostępniania, jednorazowych akcji ani adresów spoza aplikacji", () => {
    for (const p of ["/share?share-title=x", "/notatka/a?akcja=done", "/?new=list", "//zly.example", "https://x"]) {
      expect(isRestorablePath(p)).toBe(false);
      expect(launchTarget(root, { at: NOW - H, path: p }, NOW)).toBeNull();
    }
    expect(isRestorablePath("/kalendarz")).toBe(true);
  });

  it("powrót do schowanej aplikacji: po 4 h na „Dziś”, chyba że już tam jest", () => {
    expect(resumeTarget(null, NOW, "/")).toBeNull();
    expect(resumeTarget(NOW - 2 * H, NOW, "/praca")).toBeNull();
    expect(resumeTarget(NOW - 5 * H, NOW, "/praca")).toBe("/dzis");
    expect(resumeTarget(NOW - 5 * H, NOW, "/dzis")).toBeNull();
  });

  it("zapis i odczyt odporne na śmieci w pamięci", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    expect(readLastSeen(store)).toBeNull();
    writeLastSeen({ at: NOW, path: "/praca" }, store);
    expect(readLastSeen(store)).toEqual({ at: NOW, path: "/praca" });
    mem.set("kaczy.lastSeen.v1", "{zły json");
    expect(readLastSeen(store)).toBeNull();
    mem.set("kaczy.lastSeen.v1", JSON.stringify({ at: "x", path: 1 }));
    expect(readLastSeen(store)).toBeNull();
  });
});
