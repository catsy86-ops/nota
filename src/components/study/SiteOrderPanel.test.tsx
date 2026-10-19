import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { JournalEntry } from "@/lib/study/yStudy";
import type { SiteInfo } from "@/lib/study/sites";
import { siteKey } from "@/lib/study/sites";

// Dziennik podstawiany przez mock: panel czyta tylko `useStudy().journal`.
let journal: JournalEntry[] = [];
vi.mock("@/lib/study/store", () => ({
  useStudy: () => ({ journal }),
  markSiteOrdered: vi.fn(),
}));

const { SiteOrderPanel } = await import("./SiteOrderPanel");

const NAME = "Dom Kowalski";
const site = { id: siteKey(NAME), name: NAME } as SiteInfo;
const entry = (fittings: JournalEntry["fittings"]): JournalEntry => ({
  id: "e1", at: new Date(2026, 9, 14, 12).getTime(), kind: "ok", topic: null, text: "montaż",
  site: NAME, siteId: site.id, checked: [], images: [], fittings,
});

afterEach(() => {
  cleanup();
  journal = [];
  vi.restoreAllMocks();
});

describe("SiteOrderPanel — WhatsApp (U7)", () => {
  it("„WhatsApp” otwiera wa.me z tekstem zamówienia, bez numeru odbiorcy", () => {
    journal = [entry([{ name: "Kolano 16", qty: 2 }])];
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SiteOrderPanel site={site} />);

    fireEvent.click(screen.getByRole("button", { name: /WhatsApp/ }));

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(String(url))).toContain("Zamówienie kształtek — Dom Kowalski");
    expect(decodeURIComponent(String(url))).toContain("- Kolano 16: 2 szt.");
    expect(target).toBe("_blank");
    expect(features).toBe("noopener");
  });

  it("bez kształtek do zamówienia przycisk jest wyłączony", () => {
    journal = [];
    render(<SiteOrderPanel site={site} />);
    expect(screen.getByRole("button", { name: /WhatsApp/ })).toBeDisabled();
  });
});
