import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// W1.8: hex w kodzie TS/TSX tylko tam, gdzie kolor nie może iść za stylem. Grupy z planu:
// (c) rysunek na canvasie, w pliku i w druku — `lib/paint/colors.ts`, plany, Grafik jako obraz, podpis, eksport, mermaid;
// (d) dane i ustawienia użytkownika — kolory zmian w Grafiku, paleta rysunku, próbki akcentów, ramek, poświaty, tła notatki;
// kolor paska adresu (`theme-color`) — `skinList.ts`, `useTheme.ts`, `skinGallery.ts` (podgląd stylu przed włączeniem).
// Liczba w pliku może tylko maleć; nowy plik z hex = kolor z tokenu albo z `lib/paint/colors.ts`.
const KNOWN: Record<string, number> = {
  "src/components/DrawingCanvas.tsx": 10,
  "src/components/NMonogramLogo.tsx": 1,
  "src/components/plans/PlanOverlay.tsx": 17,
  "src/components/skins/MatrixRain.tsx": 5,
  "src/components/study/SignaturePad.tsx": 2,
  "src/components/study/SiteSignatureDialog.tsx": 2,
  "src/hooks/useTheme.ts": 2,
  "src/lib/accentMeta.ts": 50,
  "src/lib/celebrate.ts": 14,
  "src/lib/exportNotes.ts": 8,
  "src/lib/frameLook.ts": 6,
  "src/lib/glowLook.ts": 5,
  "src/lib/import/__fixtures__/samples.ts": 1,
  "src/lib/mermaidRender.ts": 12,
  "src/lib/noteLook.ts": 8,
  "src/lib/paint/colors.ts": 6,
  "src/lib/plans/systems.ts": 6,
  "src/lib/recoveryPrint.ts": 3,
  "src/lib/shifts/color.ts": 3,
  "src/lib/shifts/model.ts": 25,
  "src/lib/shifts/monthImageDraw.ts": 11,
  "src/lib/shifts/testShiftTypes.ts": 3,
  "src/lib/skinGallery.ts": 50,
  "src/lib/skinList.ts": 37,
};

const ROOT = process.cwd();
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("W1.8 — hex w TS/TSX tylko z listy wyjątków", () => {
  it("żaden plik nie ma więcej hex niż w KNOWN", () => {
    const over: string[] = [];
    for (const path of files(resolve(ROOT, "src"))) {
      const rel = relative(ROOT, path).split("\\").join("/");
      const n = readFileSync(path, "utf8").match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)?.length ?? 0;
      if (n > (KNOWN[rel] ?? 0)) over.push(`${rel}: ${n} (dozwolone ${KNOWN[rel] ?? 0})`);
    }
    expect(over).toEqual([]);
  });
});
