import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizePushServer } from "./push/prefs";

/** Store czyta `localStorage` przy załadowaniu modułu — ładujemy świeżą kopię po każdym ustawieniu danych. */
async function loadFresh<T>(path: string): Promise<T> {
  vi.resetModules();
  return (await import(/* @vite-ignore */ path)) as T;
}

beforeEach(() => {
  localStorage.clear();
});

describe("viewPrefs — odczyt zapisu", () => {
  it("bez zapisu zwraca domyślne", async () => {
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    expect(m.getViewPrefs().density).toBe("cozy");
    // Przypomnienie „Ten tydzień” domyślnie w niedzielę — tak jak przegląd tygodnia (faza 2).
    expect(m.getViewPrefs().weekReminderDay).toBe(0);
  });

  it("częściowy zapis łączy się z domyślnymi", async () => {
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ columns: 3 }));
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    expect(m.getViewPrefs().columns).toBe(3);
    expect(m.getViewPrefs().density).toBe("cozy");
  });

  it("uszkodzony JSON daje domyślne, bez kluczy ze znaków tekstu", async () => {
    localStorage.setItem("kaczy.viewPrefs.v1", "{oops");
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    const prefs = m.getViewPrefs();
    expect(prefs.density).toBe("cozy");
    expect(Object.keys(prefs)).not.toContain("0");
    expect(Object.keys(prefs)).not.toContain("1");
  });

  it("zapis będący tekstem (nie obiektem) daje domyślne", async () => {
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify("ala"));
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    expect(Object.keys(m.getViewPrefs())).not.toContain("0");
    expect(m.getViewPrefs().columns).toBe(0);
  });

  it("resetViewPrefs przywraca domyślne", async () => {
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    m.setViewPref("columns", 4);
    m.resetViewPrefs();
    expect(m.getViewPrefs().columns).toBe(0);
  });
});

describe("confirmPrefs — odczyt zapisu", () => {
  it("bez zapisu kosz i archiwum działają od razu (z Cofnij)", async () => {
    const m = await loadFresh<typeof import("./confirmPrefs")>("./confirmPrefs");
    expect(m.getConfirmPrefs()).toEqual({ trash: false, archive: false });
  });

  it("uszkodzony JSON daje domyślne", async () => {
    localStorage.setItem("kaczy.confirmPrefs.v1", "{oops");
    const m = await loadFresh<typeof import("./confirmPrefs")>("./confirmPrefs");
    expect(m.getConfirmPrefs()).toEqual({ trash: false, archive: false });
  });

  it("zapis jednego klucza zostawia drugi", async () => {
    const m = await loadFresh<typeof import("./confirmPrefs")>("./confirmPrefs");
    m.setConfirmPref("trash", true);
    expect(m.getConfirmPrefs()).toEqual({ trash: true, archive: false });
  });
});

describe("normalizePushServer — adres serwera push", () => {
  it("dopisuje https i ucina ukośniki na końcu", () => {
    expect(normalizePushServer("push.test/")).toBe("https://push.test");
  });

  it("odrzuca http dla zdalnego hosta", () => {
    expect(normalizePushServer("http://serwer.pl")).toBeNull();
  });

  it("dopuszcza http dla localhost", () => {
    expect(normalizePushServer("http://localhost:8787")).toBe("http://localhost:8787");
  });

  it("pusty tekst daje null", () => {
    expect(normalizePushServer("   ")).toBeNull();
  });
});

describe("reset per sekcja (faza 3a)", () => {
  it("changedViewPrefs wymienia tylko ustawienia różne od domyślnych", async () => {
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    expect(m.changedViewPrefs()).toEqual([]);
    m.setViewPref("columns", 3);
    m.setViewPref("autosaveSeconds", 15);
    expect(m.changedViewPrefs()).toEqual(expect.arrayContaining(["columns", "autosaveSeconds"]));
    expect(m.changedViewPrefs(m.VIEW_PREF_GROUPS.kopia)).toEqual([]);
  });

  it("resetViewPrefKeys przywraca tylko podane klucze", async () => {
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    m.setViewPref("autosaveSeconds", 15);
    m.setViewPref("autoExportDays", 3);
    m.resetViewPrefKeys(m.VIEW_PREF_GROUPS.edytor);
    expect(m.getViewPrefs().autosaveSeconds).toBe(0);
    expect(m.getViewPrefs().autoExportDays).toBe(3);
  });

  it("grupy są rozłączne i każda ma etykietę po polsku", async () => {
    const m = await loadFresh<typeof import("./viewPrefs")>("./viewPrefs");
    const all = Object.values(m.VIEW_PREF_GROUPS).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const k of all) expect(m.VIEW_PREF_LABELS[k]).toBeTruthy();
  });
});
