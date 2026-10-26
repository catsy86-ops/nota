import { describe, expect, it, vi } from "vitest";

async function loadFresh(raw: string | null) {
  localStorage.clear();
  if (raw !== null) localStorage.setItem("kaczy.remindersLayout.v1", raw);
  vi.resetModules();
  return import("./remindersLayout");
}

describe("układ Terminów (2.6)", () => {
  it("bez wyboru: lista na telefonie, kafle na komputerze", async () => {
    const m = await loadFresh(null);
    expect(m.effectiveRemindersLayout(null, true)).toBe("list");
    expect(m.effectiveRemindersLayout(null, false)).toBe("tiles");
  });

  it("wybór użytkownika wygrywa z urządzeniem", async () => {
    const m = await loadFresh(null);
    expect(m.effectiveRemindersLayout("tiles", true)).toBe("tiles");
    expect(m.effectiveRemindersLayout("list", false)).toBe("list");
  });

  it("zapisany wybór wraca po wczytaniu; nieznana wartość nie wybiera niczego", async () => {
    expect((await loadFresh(JSON.stringify("list"))).remindersLayoutStore.get()).toBe("list");
    expect((await loadFresh(JSON.stringify("kafelki"))).remindersLayoutStore.get()).toBeNull();
  });
});
