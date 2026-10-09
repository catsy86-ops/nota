import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

interface TitleFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "rows"> {
  value: string;
  onChange: (value: string) => void;
  /** Enter przenosi tu kursor zamiast łamać tytuł. */
  onEnter?: () => void;
}

/**
 * Tytuł w jednej linii danych, ale zawijany na ekranie: w wąskim kaflu
 * i na telefonie `<input>` przewijał długi tytuł i ucinał jego początek.
 */
export function TitleField({ value, onChange, onEnter, className, ...rest }: TitleFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={1}
      value={value}
      // Wklejone łamania linii zamieniamy na spacje — tytuł zostaje jedną linią.
      onChange={(e) => onChange(e.target.value.replace(/\s*\r?\n\s*/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter?.();
        }
      }}
      className={`block resize-none overflow-hidden ${className ?? ""}`}
    />
  );
}
