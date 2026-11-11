import { readingsLine, type PressureTest } from "@/lib/study/pressureTest";

const W = 280;
const H = 96;
const PAD = { l: 34, r: 8, t: 8, b: 18 };

/**
 * B3.1 Wykres odczytów próby: ciśnienie (bar) w czasie, od startu do ostatniego odczytu. Oś Y obejmuje zakres
 * odczytów z zapasem, więc nawet spadek o 0,1 bar jest widoczny. Opis dla czytnika ekranu to te same odczyty tekstem.
 */
export function PressureChart({ test }: { test: PressureTest }) {
  const r = test.readings ?? [];
  if (r.length < 2) return null;
  const maxAt = Math.max(...r.map((x) => x.at), 1);
  const lo = Math.min(...r.map((x) => x.bar));
  const hi = Math.max(...r.map((x) => x.bar));
  const span = Math.max(hi - lo, 0.2);
  const yMin = lo - span * 0.25, yMax = hi + span * 0.25;
  const x = (at: number) => PAD.l + (at / maxAt) * (W - PAD.l - PAD.r);
  const y = (bar: number) => PAD.t + (1 - (bar - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const pts = r.map((p) => `${x(p.at).toFixed(1)},${y(p.bar).toFixed(1)}`).join(" ");
  const label = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

  return (
    <figure className="m-0" data-testid="pressure-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Wykres ciśnienia: ${readingsLine(test)}`} className="h-auto w-full text-foreground">
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="currentColor" strokeOpacity="0.3" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="currentColor" strokeOpacity="0.3" />
        <text x={PAD.l - 4} y={y(hi) + 3} textAnchor="end" fontSize="9" fill="currentColor">{label(hi)}</text>
        {hi !== lo && <text x={PAD.l - 4} y={y(lo) + 3} textAnchor="end" fontSize="9" fill="currentColor">{label(lo)}</text>}
        <text x={PAD.l} y={H - 4} fontSize="9" fill="currentColor">0</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize="9" fill="currentColor">{label(maxAt / 60)} min</text>
        <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {r.map((p, i) => <circle key={i} cx={x(p.at)} cy={y(p.bar)} r="3" fill="var(--primary)" />)}
      </svg>
      <figcaption className="ui-hint mt-1">Ciśnienie [bar] w czasie. {test.drop !== null ? `Spadek: ${label(test.drop)} bar.` : ""}</figcaption>
    </figure>
  );
}
