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
    expect(m.getViewPrefs().weekReminderDay).toBe(1);
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
  it("bez zapisu pytamy o kosz i archiwum", async () => {
    const m = await loadFresh<typeof import("./confirmPrefs")>("./confirmPrefs");
    expect(m.getConfirmPrefs()).toEqual({ trash: true, archive: true });
  });

  it("uszkodzony JSON daje domyślne", async () => {
    localStorage.setItem("kaczy.confirmPrefs.v1", "{oops");
    const m = await loadFresh<typeof import("./confirmPrefs")>("./confirmPrefs");
    expect(m.getConfirmPrefs()).toEqual({ trash: true, archive: true });
  });

  it("zapis jednego klucza zostawia drugi", async () => {
    const m = await loadFresh<typeof import("./confirmPrefs")>("./confirmPrefs");
    m.setConfirmPref("trash", false);
    expect(m.getConfirmPrefs()).toEqual({ trash: false, archive: true });
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
