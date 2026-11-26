import { describe, expect, it } from "vitest";
import { kgStep, stepKg } from "./trainingFormat";

describe("krok ciężaru (C2.2)", () => {
  it("0,5 kg do 10 kg, wyżej 1 kg; w dół symetrycznie przez granicę", () => {
    expect(kgStep(8)).toBe(0.5);
    expect(kgStep(10)).toBe(1);
    expect(stepKg(9.5, 1)).toBe(10);
    expect(stepKg(10, 1)).toBe(11);
    expect(stepKg(11, -1)).toBe(10);
    expect(stepKg(10, -1)).toBe(9.5);
  });

  it("nie schodzi poniżej zera ani ponad limit", () => {
    expect(stepKg(0, -1)).toBe(0);
    expect(stepKg(500, 1)).toBe(500);
  });
});
