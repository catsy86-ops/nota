import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseViewRoute } from "@/lib/viewRoute";

const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../public/manifest.webmanifest"), "utf8"));

describe("manifest.webmanifest", () => {
  it("shortcuts open the advertised views", () => {
    const byName = Object.fromEntries(
      (manifest.shortcuts as { name: string; url: string }[]).map((s) => [s.name, new URL(s.url, "https://x.test")]),
    );
    expect(Object.keys(byName)).toEqual(["Nowa notatka", "Dziś", "Grafik", "Przypomnienia"]);
    expect(byName["Nowa notatka"].searchParams.get("new")).toBe("1");
    expect(parseViewRoute(byName["Dziś"].pathname, "").view).toBe("today");
    expect(parseViewRoute(byName["Grafik"].pathname, "").view).toBe("shifts");
    expect(parseViewRoute(byName["Przypomnienia"].pathname, "").view).toBe("reminders");
  });
});
