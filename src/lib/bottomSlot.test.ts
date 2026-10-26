import { describe, expect, it, vi } from "vitest";

async function loadFresh(raw: string | null) {
  localStorage.clear();
  if (raw !== null) localStorage.setItem("kaczy.bottomSlot.v1", raw);
  vi.resetModules();
  return import("./bottomSlot");
}

describe("czwarta pozycja dolnego paska (2.3)", () => {
  it("domyślnie Terminy", async () => {
    expect((await loadFresh(null)).bottomSlotStore.get()).toBe("reminders");
  });
  it("zapisany wybór wraca; nieznany widok wraca do domyślnego", async () => {
    expect((await loadFresh(JSON.stringify("shifts"))).bottomSlotStore.get()).toBe("shifts");
    expect((await loadFresh(JSON.stringify("notes"))).bottomSlotStore.get()).toBe("reminders");
  });
});
