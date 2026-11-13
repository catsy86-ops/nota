import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

// Plan Notatek 5.5: komponent bez prawdziwej biblioteki (w jsdom nie ma jej adresu) — `renderMermaid` jest podmieniony.
const renderMermaid = vi.fn();
vi.mock("@/lib/mermaidRender", () => ({ renderMermaid: (s: string) => renderMermaid(s) }));

import { MermaidBlock } from "./MermaidBlock";

describe("MermaidBlock", () => {
  it("do czasu rysunku pokazuje źródło, potem wstawia SVG", async () => {
    renderMermaid.mockResolvedValueOnce({ ok: true, svg: '<svg data-testid="d"><title>t</title></svg>' });
    const { container } = render(<MermaidBlock source={"graph TD\nA-->B"} />);
    expect(container.querySelector("[data-mermaid='loading']")?.textContent).toContain("A-->B");
    await waitFor(() => expect(container.querySelector("[data-mermaid='ready'] svg")).not.toBeNull());
    expect(renderMermaid).toHaveBeenCalledWith("graph TD\nA-->B");
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
