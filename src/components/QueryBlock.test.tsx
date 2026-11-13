import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRendererImpl } from "./MarkdownRendererImpl";

// Plan Notatek 6.4: blok ```zapytanie w czytniku. Bez NotesProvider blok pokazuje tylko swoje zapytanie.
describe("blok zapytania w czytniku", () => {
  it("bez kontekstu notatek zostaje podglądem źródła, nie rzuca błędu", () => {
    const { container } = render(<MarkdownRendererImpl content={"```zapytanie\netykieta:budowa\n```"} />);
    expect(container.querySelector("[data-query-block]")).toBeNull();
    expect(container.textContent).toContain("etykieta:budowa");
  });

  it("zwykły blok kodu nie jest brany za zapytanie", () => {
    const { container } = render(<MarkdownRendererImpl content={"```ts\nconst a = 1;\n```"} />);
    expect(container.querySelector("[data-query-block]")).toBeNull();
    expect(container.querySelector("pre")).not.toBeNull();
  });
});
