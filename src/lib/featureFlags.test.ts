import { afterEach, describe, expect, it } from "vitest";
import { FEATURE_DEFAULTS, FEATURE_IDS, cleanFeatureFlags, isFeatureOn, setFeature } from "./featureFlags";

describe("featureFlags", () => {
  afterEach(() => {
    for (const id of FEATURE_IDS) setFeature(id, false);
  });

  it("domyślnie wszystkie funkcje są wyłączone", () => {
    expect(Object.values(FEATURE_DEFAULTS).every((v) => v === false)).toBe(true);
    expect(FEATURE_IDS.every((id) => !isFeatureOn(id))).toBe(true);
  });

  it("zapisuje przełącznik w localStorage i odczytuje go z powrotem", () => {
    setFeature("cmEditor", true);
    expect(isFeatureOn("cmEditor")).toBe(true);
    expect(isFeatureOn("canvas")).toBe(false);
    expect(JSON.parse(localStorage.getItem("kaczy.features.v1") ?? "{}").cmEditor).toBe(true);
  });

  it("czyszczenie odrzuca nieznane klucze i nie-boolowskie wartości", () => {
    const cleaned = cleanFeatureFlags({ cmEditor: true, canvas: "tak", wycieczka: true });
    expect(cleaned.cmEditor).toBe(true);
    expect(cleaned.canvas).toBe(false);
    expect(Object.keys(cleaned).sort()).toEqual([...FEATURE_IDS].sort());
  });

  it("brakujące lub zepsute dane dają wartości domyślne", () => {
    expect(cleanFeatureFlags(null)).toEqual(FEATURE_DEFAULTS);
    expect(cleanFeatureFlags([true])).toEqual(FEATURE_DEFAULTS);
    expect(cleanFeatureFlags("cmEditor")).toEqual(FEATURE_DEFAULTS);
  });
});
