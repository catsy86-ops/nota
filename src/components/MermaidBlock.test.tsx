import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

// Plan Notatek 5.5: komponent bez prawdziwej biblioteki (w jsdom nie ma jej adresu) — `renderMermaid` jest podmieniony.
const renderMermaid = vi.fn();
vi.mock("@/lib/mermaidRender", () => ({ renderMermaid: (s: string) => renderMermaid(s) }));

import { MermaidBlock } from "./MermaidBlock";

// jsdom nie ma `URL.createObjectURL` — zapamiętujemy zawartość obrazu, żeby ją sprawdzić.
const blobs: Blob[] = [];
// jsdom nie ma `Blob.text()`.
const readBlob = (b: Blob) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b); });
beforeEach(() => {
  blobs.length = 0;
  URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return `blob:test/${blobs.length}`; });
  URL.revokeObjectURL = vi.fn();
});

describe("MermaidBlock", () => {
  it("do czasu rysunku pokazuje źródło, potem obraz z adresu blob: (SVG nie wchodzi do DOM strony)", async () => {
    renderMermaid.mockResolvedValueOnce({ ok: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" style="max-width: 320px"><title>t</title></svg>' });
    const { container } = render(<MermaidBlock source={"graph TD\nA-->B"} />);
    expect(container.querySelector("[data-mermaid='loading']")?.textContent).toContain("A-->B");
    await waitFor(() => expect(container.querySelector("[data-mermaid='ready'] img")).not.toBeNull());
    const img = container.querySelector<HTMLImageElement>("[data-mermaid='ready'] img")!;
    expect(img.getAttribute("src")).toMatch(/^blob:/);
    expect(img.getAttribute("alt")).toBe("Diagram");
    expect(img.style.maxWidth).toBe("320px");
    expect(container.querySelector("svg")).toBeNull();
    expect(blobs[0].type).toBe("image/svg+xml");
    expect(renderMermaid).toHaveBeenCalledWith("graph TD\nA-->B");
  });

  it("ładunek XSS w SVG nie trafia do drzewa DOM i nie wykonuje się", async () => {
    (window as unknown as { __xss?: number }).__xss = undefined;
    const payload = '<svg><script>window.__xss=1</script><g onload="window.__xss=2"><foreignObject><img src=x onerror="window.__xss=3"></foreignObject></g></svg>';
    renderMermaid.mockResolvedValueOnce({ ok: true, svg: payload });
    const { container } = render(<MermaidBlock source="graph TD" />);
    await waitFor(() => expect(container.querySelector("[data-mermaid='ready'] img")).not.toBeNull());
    expect(container.querySelector("script, svg, foreignObject, [onerror], [onload]")).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    expect(await readBlob(blobs[0])).toContain("<script>"); // trafia do obrazu, nie do strony
  });

  it("błąd składni to komunikat z pierwszą linią błędu i źródło pod spodem", async () => {
    renderMermaid.mockResolvedValueOnce({ ok: false, error: "Parse error on line 2" });
    const { container, findByRole } = render(<MermaidBlock source={"graph TD\nA--"} />);
    const alert = await findByRole("alert");
    expect(alert.textContent).toContain("Parse error on line 2");
    expect(container.querySelector("[data-mermaid='error'] pre")?.textContent).toContain("A--");
  });

  it("brak modułu (offline) też kończy się komunikatem, nie wyjątkiem", async () => {
    renderMermaid.mockRejectedValueOnce(new Error("Failed to fetch"));
    const { findByRole } = render(<MermaidBlock source="graph TD" />);
    expect((await findByRole("alert")).textContent).toContain("offline");
  });
});
