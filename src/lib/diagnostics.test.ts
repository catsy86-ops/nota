import { describe, it, expect, beforeEach, vi } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import { clearAllStorage } from "@/lib/notesStore";
import type { Note } from "@/hooks/useNotes";
import { logDiag, getDiagEntries, clearDiagForTests } from "@/lib/diagnostics";

const PAIRING_CODE = "QWERTY23";

vi.mock("@/lib/yjsSync", () => ({
  getSyncState: () => ({
    status: "connecting", peerCount: 0, code: PAIRING_CODE, lastSyncedAt: null,
    lastError: `room for ${PAIRING_CODE} unreachable`,
  }),
  formatCode: (code: string) => code.match(/.{1,4}/g)!.join(" "),
  getSignalingServers: () => ["wss://sig.example.com"],
}));

import { collectDiagReport } from "@/lib/diagnosticsReport";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1", title: "Tytuł", content: "Treść", color: "default",
    pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [],
    folderId: null, order: 0, createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  clearDiagForTests();
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
  await yjsStore.ready();
});

describe("dziennik diagnostyczny", () => {
  it("trzyma najwyżej 200 najnowszych wpisów", () => {
    for (let i = 0; i < 250; i++) logDiag("info", "test", `wpis ${i}`);
    const entries = getDiagEntries();
    expect(entries).toHaveLength(200);
    expect(entries[0].message).toBe("wpis 50");
    expect(entries[199].message).toBe("wpis 249");
  });

  it("zapisuje błąd jako nazwę i komunikat", () => {
    logDiag("error", "imagesStore", "zapis nieudany", new DOMException("brak miejsca", "QuotaExceededError"));
    expect(getDiagEntries()[0].message).toBe("zapis nieudany — QuotaExceededError: brak miejsca");
  });
});

describe("raport diagnostyczny", () => {
  it("liczy notatki, ale nie zawiera ich treści ani kodu parowania", async () => {
    yjsStore.upsertNote(makeNote({ id: "a", title: "Tajny tytuł", content: "hasło do sejfu 1234", checklist: [{ id: "c", text: "kupić pierścionek", checked: false }] }));
    yjsStore.upsertNote(makeNote({ id: "b", archived: true }));
    yjsStore.upsertNote(makeNote({ id: "c", trashed: true, trashedAt: 1 }));
    logDiag("warn", "yjsSync", `connect ${PAIRING_CODE} failed`);
    logDiag("info", "sync", "użytkownik wpisał QWER TY23"); // postać z Ustawień (grupy po 4)

    const report = await collectDiagReport();

    expect(report).toContain("notatki: 1, archiwum: 1, kosz: 1");
    expect(report).toContain("sparowano: true");
    expect(report).toContain("serwery sygnalizacyjne: wss://sig.example.com");
    expect(report).not.toContain("Tajny tytuł");
    expect(report).not.toContain("hasło do sejfu");
    expect(report).not.toContain("pierścionek");
    expect(report).not.toContain(PAIRING_CODE);
    expect(report).not.toContain("QWER TY23");
    expect(report).toContain("[kod]");
  });
});
