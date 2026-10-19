import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SiteInfo } from "@/lib/study/sites";
import type { SiteDoc } from "@/lib/study/siteDocs";

const setSiteDocs = vi.fn();
const toastWithUndo = vi.fn();
const downloadAttachment = vi.fn(async () => true);
vi.mock("@/lib/study/store", () => ({ setSiteDocs: (...a: unknown[]) => setSiteDocs(...a) }));
vi.mock("@/lib/undoToast", () => ({ toastWithUndo: (...a: unknown[]) => toastWithUndo(...a) }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));
vi.mock("@/lib/attachments", () => ({
  downloadAttachment: (...a: unknown[]) => downloadAttachment(...(a as [])),
  formatFileSize: (n: number) => `${n} B`,
}));
// Miniatura zdjęcia ciągnie bajty z magazynu — tu wystarczy atrapa.
vi.mock("@/components/NoteImage", () => ({
  NoteImage: ({ imageRef, alt }: { imageRef: string; alt: string }) => <img data-testid="note-image" data-ref={imageRef} alt={alt} />,
}));

const { SiteDocsPanel } = await import("./SiteDocsPanel");

const doc = (over: Partial<SiteDoc>): SiteDoc => ({ id: "d1", name: "Rzut.pdf", size: 1000, type: "application/pdf", at: 1, ...over });
const siteWith = (docs: SiteDoc[]) => ({ id: "dom", name: "Dom", docs }) as unknown as SiteInfo;

beforeEach(() => {
  setSiteDocs.mockReset();
  toastWithUndo.mockReset();
  downloadAttachment.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("SiteDocsPanel — plany i dokumenty", () => {
  it("pusta karta pokazuje podpowiedź i przycisk dodawania", () => {
    render(<SiteDocsPanel site={siteWith([])} />);
    expect(screen.getByText(/Rzut, projekt, zdjęcie tablicy/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodaj plan lub dokument" })).toBeEnabled();
  });

  it("zdjęcie to miniatura z powiększeniem, PDF to wiersz z „Otwórz”", () => {
    render(<SiteDocsPanel site={siteWith([doc({ id: "img1", name: "Tablica.jpg", type: "image/jpeg" }), doc({})])} />);
    expect(screen.getByRole("button", { name: "Powiększ: Tablica" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otwórz: Rzut" })).toBeInTheDocument();
    expect(screen.getByText(/PDF · 1000 B/)).toBeInTheDocument();
  });

  it("„Otwórz” pobiera plik z tym samym id", () => {
    render(<SiteDocsPanel site={siteWith([doc({ id: "pdf-7" })])} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz: Rzut" }));
    expect(downloadAttachment).toHaveBeenCalledWith(expect.objectContaining({ hash: "pdf-7", name: "Rzut.pdf" }));
  });

  it("usunięcie dokumentu idzie przez „Cofnij”", () => {
    const docs = [doc({ id: "a", name: "Rzut.pdf" }), doc({ id: "b", name: "Projekt.pdf" })];
    render(<SiteDocsPanel site={siteWith(docs)} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń: Projekt" }));

    const [siteId, after, before] = setSiteDocs.mock.calls[0];
    expect(siteId).toBe("dom");
    expect(after.map((d: SiteDoc) => d.id)).toEqual(["a"]);
    expect(before.map((d: SiteDoc) => d.id)).toEqual(["a", "b"]);
    expect(toastWithUndo).toHaveBeenCalledWith(expect.stringContaining("Projekt"), expect.any(Function));
  });

  it("powiększenie otwiera podgląd z przełącznikiem 100%", () => {
    render(<SiteDocsPanel site={siteWith([doc({ id: "img1", name: "Tablica.jpg", type: "image/jpeg" })])} />);
    fireEvent.click(screen.getByRole("button", { name: "Powiększ: Tablica" }));

    expect(screen.getByTestId("site-doc-zoom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /100%/ }));
    expect(screen.getByRole("button", { name: /Dopasuj/ })).toBeInTheDocument();
  });
});
