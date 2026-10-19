import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type Ref, type TextareaHTMLAttributes } from "react";

interface TitleFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "rows"> {
  value: string;
  onChange: (value: string) => void;
  /** Enter przenosi tu kursor zamiast łamać tytuł. Dostaje zdarzenie, żeby zobaczyć Ctrl/Shift. */
  onEnter?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Referencja dla rodzica (np. fokus po otwarciu kompozytora). */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Tytuł w jednej linii danych, ale zawijany na ekranie: w wąskim kaflu
 * i na telefonie `<input>` przewijał długi tytuł i ucinał jego początek.
 * Ten sam komponent w edytorze i w kompozytorze — tytuł zawija się tak samo.
 */
export function TitleField({ value, onChange, onEnter, className, ref: outerRef, ...rest }: TitleFieldProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Własna referencja do pomiaru wysokości plus ta od rodzica — obie wskazują ten sam element.
  const setRef = useCallback((el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (typeof outerRef === "function") outerRef(el);
    else if (outerRef) (outerRef as { current: HTMLTextAreaElement | null }).current = el;
  }, [outerRef]);

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={setRef}
      rows={1}
      value={value}
      // Wklejone łamania linii zamieniamy na spacje — tytuł zostaje jedną linią.
      onChange={(e) => onChange(e.target.value.replace(/\s*\r?\n\s*/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter?.(e);
        }
      }}
      className={`block resize-none overflow-hidden ${className ?? ""}`}
    />
  );
}
