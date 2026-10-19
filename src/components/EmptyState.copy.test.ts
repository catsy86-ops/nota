import { describe, expect, it } from "vitest";
import { DESCRIPTIONS, HEADINGS } from "./EmptyState";
import type { View } from "@/hooks/useFilteredNotes";

// Widoki, w których `EmptyState` pokazuje pustą listę (bez Grafiku, Nauki i Długów, które mają własne ekrany).
const LIST_VIEWS: View[] = ["notes", "archive", "trash", "reminders", "calendar", "shifts", "today", "week", "label", "folder", "inbox"];

describe("teksty pustych stanów", () => {
  it.each(LIST_VIEWS)("%s: jest nagłówek i jedno zdanie z następnym krokiem", (view) => {
    expect(HEADINGS[view].trim().length).toBeGreaterThan(0);
    const text = DESCRIPTIONS[view];
    expect(text.trim().length).toBeGreaterThan(0);
    // Jedno zdanie z krokiem: nie więcej niż dwa zdania, każde kończy się kropką (podpis z klawiszem jest wyjątkiem).
    if (view !== "notes" && view !== "calendar" && view !== "shifts") {
      expect(text.split(/(?<=[.])\s+/).length).toBeLessThanOrEqual(2);
    }
    expect(text.length).toBeLessThanOrEqual(170);
  });

  it("nagłówek to krótka etykieta, nie zdanie z kropką", () => {
    for (const view of LIST_VIEWS) {
      expect(HEADINGS[view].length).toBeLessThanOrEqual(60);
      expect(HEADINGS[view]).not.toMatch(/\./);
    }
  });

  it("bez wykrzykników i bez przepraszania", () => {
    for (const view of LIST_VIEWS) {
      expect(HEADINGS[view]).not.toMatch(/[!]/);
      expect(DESCRIPTIONS[view]).not.toMatch(/[!]|przepraszam|ups|oops/i);
    }
  });
});
