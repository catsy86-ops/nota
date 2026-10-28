import { format } from "date-fns";
import { pl } from "date-fns/locale";

const CELL = 10;
const GAP = 2;
const LABEL_W = 34;
const DAYS = 31;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Mapa roku (G4.3): miesiące w wierszach, dni w kolumnach. Kolor komórki rośnie z liczbą przepracowanych
 * godzin tego dnia (kolor marki, skala względem najdłuższego dnia roku). Szczegóły są w tytule komórki;
 * tabela roku pod spodem zostaje wersją dla czytnika.
 */
export function YearHeatmap({ year, dayMinutes }: { year: number; dayMinutes: Map<string, number> }) {
  const max = Math.max(1, ...dayMinutes.values());
  const width = LABEL_W + DAYS * (CELL + GAP);
  const height = 12 * (CELL + GAP);
  const cells: React.ReactNode[] = [];

  for (let m = 0; m < 12; m++) {
    const label = format(new Date(year, m, 1), "LLL", { locale: pl }).replace(".", "");
    cells.push(
      <text key={`l-${m}`} x={0} y={m * (CELL + GAP) + CELL - 1} className="fill-muted-foreground" style={{ fontSize: 12 }}>{label}</text>,
    );
    for (let d = 1; d <= DAYS; d++) {
      const date = new Date(year, m, d);
      if (date.getMonth() !== m) continue; // dzień spoza miesiąca (np. 31 kwietnia)
      const key = `${year}-${pad(m + 1)}-${pad(d)}`;
      const minutes = dayMinutes.get(key) ?? 0;
      const share = minutes > 0 ? Math.max(25, Math.round((minutes / max) * 100)) : 0;
      const fill = share === 0 ? "var(--muted)" : `color-mix(in srgb, var(--primary) ${share}%, var(--muted))`;
      const hours = minutes > 0 ? `${(minutes / 60).toFixed(1).replace(".", ",")} h` : "bez pracy";
      cells.push(
        <rect key={key} x={LABEL_W + (d - 1) * (CELL + GAP)} y={m * (CELL + GAP)} width={CELL} height={CELL} rx={2} style={{ fill }}>
          <title>{`${d} ${format(date, "LLLL", { locale: pl })}: ${hours}`}</title>
        </rect>,
      );
    }
  }

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dni roku</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Mapa godzin pracy ${year}: każdy dzień to komórka, im ciemniej, tym więcej godzin. Dokładne liczby są w tabeli.`}>
        {cells}
      </svg>
    </figure>
  );
}
