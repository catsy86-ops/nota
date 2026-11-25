import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Note } from "@/hooks/useNotes";

// QL-2: z wybranym plikiem kopia zapisuje się sama raz dziennie — przy otwarciu i przy schowaniu aplikacji.
// (W e2e uchwyt pliku z OPFS zamyka stronę testową przy odczycie z IndexedDB — logika sprawdzana tutaj.)
const exportFullBackup = vi.fn();
const hasBackupFile = vi.fn();
vi.mock("@/lib/backup/download", () => ({ exportFullBackup: (...a: unknown[]) => exportFullBackup(...a) }));
vi.mock("@/lib/backup/build", () => ({ describeSkippedAttachments: () => null }));
vi.mock("@/lib/backup/parse", () => ({ BACKUP_OVERSIZE_NOTE: "" }));
vi.mock("@/lib/backupFileHandle", () => ({ hasBackupFile: () => hasBackupFile() }));
vi.mock("@/lib/tabLock", () => ({ AUTO_BACKUP_LOCK: "x", withLockIfFree: (_: string, fn: () => Promise<unknown>) => fn() }));
vi.mock("@/hooks/useNotes", () => ({ whenNotesReady: () => Promise.resolve() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), warning: vi.fn(), error: vi.fn() }) }));

const { useBackupReminders } = await import("./useBackupReminders");

const DAY = 24 * 60 * 60 * 1000;
const note = { id: "a", createdAt: Date.now() - 10 * DAY } as Note;
const prefs = { autoExportDays: 7, backupReminderDays: 0 };
const lastBackup = (agoMs: number) => localStorage.setItem("kaczy.lastAutoExport", String(Date.now() - agoMs));
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); };
const hide = async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await Promise.resolve(); await Promise.resolve(); });
};

describe("useBackupReminders — dzienny zapis do pliku (QL-2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    exportFullBackup.mockReset().mockResolvedValue({ filename: "k.json", size: 2048, savedToFile: true, attachments: {}, oversize: false });
    hasBackupFile.mockReset().mockResolvedValue(true);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
  afterEach(() => { vi.useRealTimers(); });

  it("plik wybrany, ostatnia kopia 2 dni temu (interwał 7 dni nie minął) — zapis przy otwarciu bez pytania", async () => {
    lastBackup(2 * DAY);
    renderHook(() => useBackupReminders(prefs, [note], []));
    await flush();
    expect(exportFullBackup).toHaveBeenCalledTimes(1);
    expect(exportFullBackup.mock.calls[0][1]).toEqual({ allowDownload: false });
    expect(Number(localStorage.getItem("kaczy.lastAutoExport"))).toBeGreaterThan(Date.now() - 1000);
  });

  it("kopia dziś — nic; bez wybranego pliku — dalej czeka na interwał", async () => {
    lastBackup(2 * 60 * 60 * 1000);
    renderHook(() => useBackupReminders(prefs, [note], []));
    await flush();
    expect(exportFullBackup).not.toHaveBeenCalled();

    hasBackupFile.mockResolvedValue(false);
    lastBackup(2 * DAY);
    sessionStorage.clear();
    renderHook(() => useBackupReminders(prefs, [note], []));
    await flush();
    expect(exportFullBackup).not.toHaveBeenCalled();
  });

  it("schowanie aplikacji dzień po ostatniej kopii — cichy zapis do pliku", async () => {
    lastBackup(2 * 60 * 60 * 1000);
    renderHook(() => useBackupReminders(prefs, [note], []));
    await flush();
    expect(exportFullBackup).not.toHaveBeenCalled();
    lastBackup(26 * 60 * 60 * 1000);
    await hide();
    await vi.waitFor(() => expect(exportFullBackup).toHaveBeenCalledTimes(1));
  });

  it("auto-backup wyłączony (0 dni) — ani przy otwarciu, ani przy schowaniu", async () => {
    lastBackup(5 * DAY);
    renderHook(() => useBackupReminders({ ...prefs, autoExportDays: 0 }, [note], []));
    await flush();
    await hide();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(exportFullBackup).not.toHaveBeenCalled();
  });
});
