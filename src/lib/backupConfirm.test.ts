import { describe, it, expect, vi } from "vitest";
import { exportFullBackup } from "./exportNotes";

// D3: pytanie przed zapisem kopii, gdy coś zostanie pominięte.
describe("eksport kopii — potwierdzenie pominięć (D3)", () => {
  it("bez pominiętych załączników nie pyta i zapisuje kopię", async () => {
    const confirm = vi.fn(async () => false);
    const res = await exportFullBackup("test.json", { allowDownload: false, confirm });
    expect(confirm).not.toHaveBeenCalled();
    expect(res.cancelled).toBe(false);
    expect(res.size).toBeGreaterThan(0);
  });
});
