import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MarkdownRendererImpl } from "./MarkdownRendererImpl";
import { needsMarkdown } from "./MarkdownRenderer";

describe("wzory $…$ (plan Notatek 5.4)", () => {
  it("wzór kieruje do pełnego renderera, cena nie", () => {
    expect(needsMarkdown("Pole: $\\pi r^2$")).toBe(true);
    expect(needsMarkdown("kosztuje $5 i $10")).toBe(false);
  });

  it("po pobraniu wtyczek wzór w linii i blokowy są renderowane przez KaTeX", async () => {
    const { container } = render(<MarkdownRendererImpl content={"Pole $\\pi r^2$ koła.\n\n$$\nx^2 + y^2\n$$"} />);
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2), { timeout: 5000 });
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("błędny wzór nie przerywa renderowania notatki", async () => {
    const { container } = render(<MarkdownRendererImpl content={"Przed $\\zlepolecenie{$ po"} />);
    await waitFor(() => expect(container.querySelector(".katex-error, .katex")).not.toBeNull(), { timeout: 5000 });
    expect(container.textContent).toContain("Przed");
    expect(container.textContent).toContain("po");
  });

  it("treść bez wzoru nie ładuje KaTeX", () => {
    const { container } = render(<MarkdownRendererImpl content={"Cena $5 i $10, **gruba**."} />);
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("$5 i $10");
  });
});
