import { afterEach, describe, expect, it, vi } from "vitest";
import { DOWNLOAD_REVOKE_MS, downloadBlob } from "./downloadBlob";

describe("downloadBlob", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("klika link z nazwą pliku i zwalnia adres dopiero po opóźnieniu", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked = this; });

    downloadBlob(new Blob(["a"]), "plik.txt");

    expect(clicked).not.toBeNull();
    expect(clicked!.download).toBe("plik.txt");
    expect(clicked!.isConnected).toBe(false);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DOWNLOAD_REVOKE_MS);
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });
});
