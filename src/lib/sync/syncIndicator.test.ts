import { describe, expect, it } from "vitest";
import { syncIndicatorText, syncTone } from "./syncIndicator";

describe("wskaźnik synchronizacji w nagłówku (Q4.1)", () => {
  it("ważność stanów: wstrzymanie > offline > błąd > połączenie", () => {
    expect(syncTone({ status: "rekeyed", lastError: "x" }, false)).toBe("rekeyed");
    expect(syncTone({ status: "connected", lastError: "x" }, false)).toBe("offline");
    expect(syncTone({ status: "connected", lastError: "x" }, true)).toBe("error");
    expect(syncTone({ status: "connected", lastError: null }, true)).toBe("connected");
    expect(syncTone({ status: "connecting", lastError: null }, true)).toBe("connecting");
  });

  it("napis: liczba urządzeń, czekanie i godzina przejścia w offline", () => {
    expect(syncIndicatorText("connected", 2, null).short).toBe("Połączono · 2 urządzenia");
    expect(syncIndicatorText("connected", 0, null).short).toBe("Czekam na urządzenia");
    const at = new Date(2026, 10, 27, 14, 2).getTime();
    expect(syncIndicatorText("offline", 0, at).short).toBe("Offline od 14:02");
    expect(syncIndicatorText("offline", 0, null).short).toBe("Offline");
  });
});
