import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { APP_FONTS } from "@/lib/appFont";
import { FontPicker } from "./FontPicker";

describe("FontPicker — grupa radio", () => {
  it("opcje są radio z jedną zaznaczoną", () => {
    render(<FontPicker value={APP_FONTS[0]} onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Krój tekstu" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(APP_FONTS.length);
    expect(radios.filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("strzałka w prawo wybiera następny krój, a w lewo z pierwszego idzie na ostatni", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FontPicker value={APP_FONTS[0]} onChange={onChange} />);
    fireEvent.keyDown(screen.getAllByRole("radio")[0], { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(APP_FONTS[1]);

    rerender(<FontPicker value={APP_FONTS[0]} onChange={onChange} />);
    fireEvent.keyDown(screen.getAllByRole("radio")[0], { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(APP_FONTS[APP_FONTS.length - 1]);
  });
});
