import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Strażnik zasady 6 nowego planu (2026-11-05, punkt 2.6): zdania, nie wersaliki. Klasa `uppercase` w komponentach
// tylko w wyjątkach: linijka mono w główce kartki, pieczątki i pola kodów (OTP, kod awaryjny). `first-letter:uppercase`
// to wielka litera zdania, więc jest dozwolone. Nowy wyjątek wymaga dopisania tutaj, z powodem.

const SRC = resolve(process.cwd(), "src");
const ALLOWED_FILES = new Set([
  "ViewTitle.tsx", // linijka mono nad tytułem
  "SortedStamp.tsx", // pieczątka „Posortowane”
  "AchievementStamp.tsx", // pieczątka odznaki
  "input-otp.tsx", // znaki kodu
  "VaultDialogs.tsx", // pola kodu awaryjnego
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("zdania, nie wersaliki", () => {
  it("klasa `uppercase` tylko w wyjątkach", () => {
    const offenders = sources(SRC)
      .filter((path) => !ALLOWED_FILES.has(basename(path)))
      .flatMap((path) =>
        readFileSync(path, "utf8").split("\n")
          .map((line, i) => ({ line, at: `${basename(path)}:${i + 1}` }))
          // Pieczątki w innych plikach (np. „Umiem” w Pracy) mają atrybut ze słowem „stamp”.
          .filter(({ line }) => /(?<![\w:-])uppercase(?![\w-])/.test(line) && !line.includes("stamp"))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });
});
