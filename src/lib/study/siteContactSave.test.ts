import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStudyForTests } from "./data";
import { getStudy, saveSiteCard, siteDirectoryOf } from "./store";
import { yjsStore } from "@/lib/yjsStore";

// Audyt 2026-11-11 (K3): zapis karty budowy gubił telefon hurtowni.

beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 11, 12));
  await yjsStore.resetForTests();
  resetStudyForTests();
});

describe("zapis karty budowy: pola kontaktu", () => {
  it("telefon hurtowni, inwestora i kierownika zostają zapisane i przeżywają kolejny zapis bez nich", () => {
    expect(saveSiteCard("n-1", { name: "Lipowa 5", address: "", investor: "", phone: "600 100 200", manager: "Marek", managerPhone: "700 800 900", supplierPhone: "22 000 00 00", access: "brama 1234" })).toBe(true);
    const card = () => siteDirectoryOf(getStudy()).find((s) => s.name === "Lipowa 5")!;
    expect(card()).toMatchObject({ phone: "600 100 200", manager: "Marek", managerPhone: "700 800 900", supplierPhone: "22 000 00 00", access: "brama 1234" });
    // Edycja tylko adresu: pominięte pola kontaktu zostają.
    saveSiteCard(card().id, { name: "Lipowa 5", address: "Kraków", investor: "" });
    expect(card()).toMatchObject({ address: "Kraków", supplierPhone: "22 000 00 00", phone: "600 100 200" });
  });
});
