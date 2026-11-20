import type { ClipboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { CODE_LENGTH, CODE_LENGTH_LONG, CODE_PATTERN, codeErrorText, codeFromPaste, formatCode, parseCode } from "@/lib/sync/pairCode";

export const JOIN_CODE_INPUT_ID = "sync-join-code";

interface Props {
  value: string;
  long: boolean;
  onChange: (code: string, long: boolean) => void;
  /** Wklejony tekst (cały link) — żeby rodzic mógł odczytać z niego `v=3`. */
  onPasteText?: (text: string) => void;
}

/**
 * Pole kodu z innego urządzenia (S2.2): 12 kratek dla kodu krótkiego; wklejenie dłuższego kodu albo linku
 * przełącza je na zwykłe pole na 28 znaków — 28 kratek nie mieści się na telefonie.
 */
export function JoinCodeField({ value, long, onChange, onPasteText }: Props) {
  const parsed = parseCode(value);
  const error = long && value.length === CODE_LENGTH_LONG && parsed.error ? codeErrorText(parsed.error) : null;

  // Faza przechwytywania: `input-otp` ucina wklejony tekst do liczby kratek, zanim cokolwiek zobaczymy.
  function handlePasteCapture(e: ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    onPasteText?.(text);
    const code = codeFromPaste(text);
    if (code.length <= CODE_LENGTH) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(code, true);
  }

  return (
    <div className="w-full space-y-1 sm:w-auto" onPasteCapture={handlePasteCapture}>
      {long ? (
        <Input
          id={JOIN_CODE_INPUT_ID}
          value={value}
          onChange={(e) => onChange(codeFromPaste(e.target.value), true)}
          maxLength={CODE_LENGTH_LONG + 10}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Kod z innego urządzenia (28 znaków)"
          aria-describedby="sync-join-hint"
          aria-invalid={error ? true : undefined}
          className="w-full font-mono text-base tracking-wider sm:w-88 sm:text-sm"
        />
      ) : (
        <InputOTP
          id={JOIN_CODE_INPUT_ID}
          maxLength={CODE_LENGTH}
          pattern={CODE_PATTERN}
          pasteTransformer={codeFromPaste}
          value={value}
          onChange={(v) => onChange(v.toUpperCase(), false)}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Kod z innego urządzenia"
          aria-describedby="sync-join-hint"
          containerClassName="w-full sm:w-auto"
        >
          {[0, 4, 8].map((start, g) => (
            <div key={start} className="contents">
              {g > 0 && <InputOTPSeparator />}
              <InputOTPGroup className="flex-1 min-w-0 sm:flex-none">
                {[0, 1, 2, 3].map((i) => (
                  <InputOTPSlot key={i} index={start + i} className="flex-1 min-w-0 sm:w-9 sm:flex-none" />
                ))}
              </InputOTPGroup>
            </div>
          ))}
        </InputOTP>
      )}
      {error && <p className="text-xs text-destructive-ink" role="alert">{error}</p>}
    </div>
  );
}

/** Kod w grupach po 4, zawijany całymi grupami (kod długi to 7 grup). */
export function GroupedCode({ code }: { code: string }) {
  const groups = formatCode(code).split(" ");
  return (
    <code
      className={`flex flex-wrap justify-center gap-x-2 font-mono font-bold tracking-widest ${code.length > CODE_LENGTH ? "text-base" : "text-lg"}`}
    >
      {groups.map((g, i) => <span key={i}>{g}</span>)}
    </code>
  );
}
