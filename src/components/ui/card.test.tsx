import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, cardClass, cardVariant } from "./card";

describe("Card — odmiany (W3.1)", () => {
  it("domyślna to obrys bez cienia", () => {
    expect(cardVariant()).toBe(cardClass);
    const { container } = render(<Card>x</Card>);
    expect(container.firstElementChild?.className).not.toContain("shadow");
  });

  it("inset nie ma obrysu — karta w karcie bez dwóch ramek", () => {
    expect(cardVariant("inset")).not.toMatch(/(?<![\w-])border(?![\w-])/);
  });

  it("status kładzie lewą krawędź w kolorze stanu", () => {
    const { container } = render(<Card variant="status" tone="warning">x</Card>);
    expect(container.firstElementChild?.className).toContain("border-l-4");
    expect(container.firstElementChild?.className).toContain("border-l-warning");
  });

  it("raised dostaje elewację 1, interactive pierścień fokusu", () => {
    expect(cardVariant("raised")).toContain("shadow-elevation-1");
    expect(cardVariant("interactive")).toContain("focus-visible:ring-2");
  });
});
