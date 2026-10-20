import { describe, it, expect } from "vitest";
import { settingsTabFromParam } from "./settingsDeepLink";

describe("settingsTabFromParam — ?settings=<karta>", () => {
  it("mapuje polskie nazwy na karty", () => {
    expect(settingsTabFromParam("wyglad")).toBe("appearance");
    expect(settingsTabFromParam("ogolne")).toBe("general");
    expect(settingsTabFromParam("kopia")).toBe("backup");
    expect(settingsTabFromParam("sync")).toBe("sync");
  });

  it("nieznana, pusta albo brakująca wartość nie otwiera karty", () => {
    expect(settingsTabFromParam("xyz")).toBeNull();
    expect(settingsTabFromParam("")).toBeNull();
    expect(settingsTabFromParam(null)).toBeNull();
  });

  it("nie przyjmuje nazw z prototypu", () => {
    expect(settingsTabFromParam("constructor")).toBeNull();
    expect(settingsTabFromParam("__proto__")).toBeNull();
  });
});
