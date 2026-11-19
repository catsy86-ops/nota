import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListRow } from "./list-row";

describe("ListRow (W3.4)", () => {
  it("składa tytuł, opis, wartość i akcję w jednym wierszu", () => {
    render(
      <ul>
        <ListRow as="li" title="Jan" description="wczoraj" value="120,00 zł" action={<button type="button">Więcej</button>} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Jan");
    expect(row).toHaveTextContent("wczoraj");
    expect(row).toHaveTextContent("120,00 zł");
    expect(screen.getByRole("button", { name: "Więcej" })).toBeInTheDocument();
  });

  it("nie rysuje własnego separatora — to rola rodzica", () => {
    const { container } = render(<ListRow title="x" />);
    expect(container.firstElementChild?.className).not.toMatch(/border/);
  });

  it("ma 44 px wysokości na dotyk", () => {
    const { container } = render(<ListRow title="x" />);
    expect(container.firstElementChild?.className).toContain("min-h-11");
  });
});
