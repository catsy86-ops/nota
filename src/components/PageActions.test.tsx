import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PageActions, PageActionsProvider } from "./PageActions";
import { ViewTitle } from "./ViewTitle";

afterEach(cleanup);

describe("PageActions (nowy plan 1.1)", () => {
  it("z dostawcą wstawia akcje do główki, nie w miejscu widoku", () => {
    render(
      <PageActionsProvider>
        <ViewTitle view="plans" />
        <section data-testid="widok">
          <PageActions><button type="button">Nowa analiza</button></PageActions>
        </section>
      </PageActionsProvider>,
    );
    const button = screen.getByRole("button", { name: "Nowa analiza" });
    expect(button.closest("[data-page-actions]")).not.toBeNull();
    expect(screen.getByTestId("widok").contains(button)).toBe(false);
  });

  it("bez dostawcy renderuje akcje w miejscu", () => {
    render(<section data-testid="widok"><PageActions><button type="button">Drukuj</button></PageActions></section>);
    expect(screen.getByTestId("widok").contains(screen.getByRole("button", { name: "Drukuj" }))).toBe(true);
  });

  it("główka pokazuje opis działu i pozwala go nadpisać", () => {
    const { rerender } = render(<ViewTitle view="debts" />);
    expect(screen.getByText("Kto ile pożyczył i ile już oddał.")).toBeTruthy();
    rerender(<ViewTitle view="debts" lead="Inny opis." />);
    expect(screen.getByText("Inny opis.")).toBeTruthy();
    rerender(<ViewTitle view="notes" />);
    expect(document.querySelector("[data-page-lead]")).toBeNull();
  });
});
