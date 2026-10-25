import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseViewRoute } from "@/lib/viewRoute";
import { parseShare } from "@/lib/shareTarget";

const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../public/manifest.webmanifest"), "utf8"));

describe("manifest.webmanifest", () => {
  it("shortcuts open the advertised views", () => {
    const byName = Object.fromEntries(
      (manifest.shortcuts as { name: string; url: string }[]).map((s) => [s.name, new URL(s.url, "https://x.test")]),
    );
    // Kolejność ma znaczenie: Android pokazuje tylko kilka pierwszych skrótów.
    expect(Object.keys(byName)).toEqual(["Nowa notatka", "Wpis z budowy", "Wpis głosowy", "Grafik", "Szukaj", "Nowa lista", "Dziś", "Przypomnienia", "Na dziś"]);
    expect(byName["Na dziś"].pathname).toBe("/widget");
    expect(byName["Nowa lista"].searchParams.get("new")).toBe("list");
    expect(byName["Szukaj"].searchParams.get("szukaj")).toBe("1");
    expect(parseViewRoute(byName["Wpis z budowy"].pathname, "").view).toBe("study");
    expect(byName["Wpis z budowy"].searchParams.get("wpis")).toBe("1");
    // Wpis głosowy: ten sam arkusz, plus start dyktowania (U5).
    expect(parseViewRoute(byName["Wpis głosowy"].pathname, "").view).toBe("study");
    expect(byName["Wpis głosowy"].searchParams.get("wpis")).toBe("1");
    expect(byName["Wpis głosowy"].searchParams.get("glos")).toBe("1");
    expect(byName["Nowa notatka"].searchParams.get("new")).toBe("1");
    expect(parseViewRoute(byName["Dziś"].pathname, "").view).toBe("today");
    expect(parseViewRoute(byName["Grafik"].pathname, "").view).toBe("shifts");
    expect(parseViewRoute(byName["Przypomnienia"].pathname, "").view).toBe("reminders");
  });

  it("share_target is a POST multipart to /share (obrazy i PDF) that parseShare understands", () => {
    const t = manifest.share_target;
    expect(t.method).toBe("POST");
    expect(t.enctype).toBe("multipart/form-data");
    expect(t.params.files[0].accept).toEqual(["image/*", "application/pdf"]);
    expect(t.action).toBe("/share");
    const qs = new URLSearchParams({ [t.params.title]: "T", [t.params.text]: "X", [t.params.url]: "https://example.com/" });
    expect(parseShare(t.action, "?" + qs.toString())).toEqual({ title: "T", content: "X\n\nhttps://example.com/" });
  });
});
