import { describe, expect, it } from "vitest";
import { pluralPl } from "./plural";

const F: [string, string, string] = ["notatka", "notatki", "notatek"];

describe("pluralPl", () => {
  it.each([
    [0, "notatek"], [1, "notatka"], [2, "notatki"], [4, "notatki"], [5, "notatek"],
    [12, "notatek"], [14, "notatek"], [22, "notatki"], [25, "notatek"], [112, "notatek"], [123, "notatki"],
  ])("%i → %s", (n, want) => expect(pluralPl(n, F)).toBe(want));
});
