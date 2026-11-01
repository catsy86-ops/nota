import { memo } from "react";
import { lengthLabel, measureRoute } from "@/lib/plans/geometry";
import type { DetectedText, PipeRoute, PlanCalibration, PlanPoint } from "@/lib/plans/model";
import { SYSTEM_META } from "@/lib/plans/systems";

/** Grubości i promienie w pikselach EKRANU — dzielone przez skalę, żeby nie rosły z zoomem. */
const ROUTE_W = 3.5;
const HALO_W = 9;
const HANDLE_R = 7;
const LABEL_PX = 12;

const points = (pts: readonly number[]) => {
  const out: string[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push(`${pts[i]},${pts[i + 1]}`);
  return out.join(" ");
};

/** Środek polilinii po długości — tam stoi etykieta z długością. */
function midpoint(pts: readonly number[]): PlanPoint {
  let total = 0;
  for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  let left = total / 2;
  for (let i = 2; i < pts.length; i += 2) {
    const seg = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (seg >= left && seg > 0) { const t = left / seg; return { x: pts[i - 2] + (pts[i] - pts[i - 2]) * t, y: pts[i - 1] + (pts[i + 1] - pts[i - 1]) * t }; }
    left -= seg;
  }
  return { x: pts[0], y: pts[1] };
}

function Label({ at, text, color, scale }: { at: PlanPoint; text: string; color: string; scale: number }) {
  const fs = LABEL_PX / scale;
  const w = (text.length * 0.6 + 0.8) * fs;
  return (
    <g transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
      <rect x={-w / 2} y={-fs * 0.8 - 6 / scale} width={w} height={fs * 1.3} rx={3 / scale} fill="#ffffff" fillOpacity={0.92} stroke={color} strokeWidth={1 / scale} />
      <text y={-6 / scale} textAnchor="middle" fontSize={fs} fontFamily="'JetBrains Mono', ui-monospace, monospace" fill="#111827">{text}</text>
    </g>
  );
}

interface Props {
  scale: number;
  routes: readonly PipeRoute[];
  mpp: number | null;
  selectedId: string | null;
  /** Rysowana trasa (punkty) i podgląd następnego odcinka do kursora. */
  draft: readonly number[] | null;
  hover: PlanPoint | null;
  draftSystem: PipeRoute["system"];
  calibration: PlanCalibration | null;
  /** Punkty nowej kalibracji (0–2). */
  calDraft: readonly PlanPoint[];
  showHandles: boolean;
  /** Zatwierdzone opisy (ramka ciągła) i propozycje OCR (przerywana). */
  texts: readonly DetectedText[];
  proposals: readonly { id: string; box: readonly [number, number, number, number] }[];
  focusId: string | null;
  /** Propozycje tras z obrazu (cienka przerywana w kolorze z pipety). */
  routeProposals: readonly { id: string; pts: readonly number[] }[];
  proposalColor: string | null;
}

/** Nakładka SVG w układzie oryginału: trasy, szkic, kalibracja, uchwyty zaznaczonej trasy. */
export const PlanOverlay = memo(function PlanOverlay({ scale, routes, mpp, selectedId, draft, hover, draftSystem, calibration, calDraft, showHandles, texts, proposals, focusId, routeProposals, proposalColor }: Props) {
  const k = 1 / scale;
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const draftColor = SYSTEM_META[draftSystem].color;
  const cal = calDraft.length > 0 ? calDraft : calibration ? [calibration.a, calibration.b] : [];

  return (
    <g data-testid="plan-overlay">
      <g pointerEvents="none" data-testid="plan-text-boxes">
        {[...texts.map((t) => ({ id: t.id, box: t.box, dashed: false })), ...proposals.map((p) => ({ id: p.id, box: p.box, dashed: true }))].map((t) => (
          <rect key={t.id} x={t.box[0] - 2 * k} y={t.box[1] - 2 * k} width={t.box[2] + 4 * k} height={t.box[3] + 4 * k} rx={2 * k}
            fill={t.id === focusId ? "#d97706" : "none"} fillOpacity={0.18} stroke="#d97706" strokeWidth={(t.id === focusId ? 2.5 : 1.5) * k}
            strokeDasharray={t.dashed ? `${4 * k} ${3 * k}` : undefined} />
        ))}
      </g>
      {routes.map((r) => {
        const color = SYSTEM_META[r.system].color;
        const isSel = r.id === selectedId;
        return (
          <g key={r.id} data-route={r.id}>
            {isSel && <polyline points={points(r.pts)} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={HALO_W * k} strokeLinecap="round" strokeLinejoin="round" />}
            <polyline
              points={points(r.pts)} fill="none" stroke={color} strokeWidth={(isSel ? ROUTE_W + 1 : ROUTE_W) * k}
              strokeLinecap="round" strokeLinejoin="round"
              // Niezatwierdzona propozycja (z automatyki) — przerywana.
              strokeDasharray={r.verified ? undefined : `${8 * k} ${5 * k}`}
            />
          </g>
        );
      })}
      {routes.map((r) => (
        <Label key={`l-${r.id}`} at={midpoint(r.pts)} scale={scale} color={SYSTEM_META[r.system].color}
          text={`${r.diameterMm ? `Ø${String(r.diameterMm).replace(".", ",")} · ` : ""}${lengthLabel(measureRoute(r, mpp)).replace(" (bez skali)", "")}`} />
      ))}

      {routeProposals.length > 0 && (
        <g pointerEvents="none" data-testid="plan-route-proposals">
          {routeProposals.map((p) => (
            <g key={p.id}>
              {p.id === focusId && <polyline points={points(p.pts)} fill="none" stroke="#d97706" strokeOpacity={0.35} strokeWidth={HALO_W * k} strokeLinecap="round" strokeLinejoin="round" />}
              <polyline points={points(p.pts)} fill="none" stroke={proposalColor ?? "#d97706"} strokeWidth={2.5 * k}
                strokeDasharray={`${3 * k} ${3 * k}`} strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={points(p.pts)} fill="none" stroke="#111827" strokeOpacity={0.6} strokeWidth={1 * k} strokeDasharray={`${3 * k} ${3 * k}`} strokeDashoffset={3 * k} />
            </g>
          ))}
        </g>
      )}

      {selected && showHandles && toPairs(selected.pts).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={HANDLE_R * k} fill="#ffffff" stroke={SYSTEM_META[selected.system].color} strokeWidth={2.5 * k} data-handle={i} />
      ))}

      {draft && draft.length >= 2 && (
        <g pointerEvents="none" data-testid="plan-draft">
          <polyline points={points(draft)} fill="none" stroke={draftColor} strokeWidth={ROUTE_W * k} strokeLinecap="round" strokeLinejoin="round" />
          {hover && <line x1={draft[draft.length - 2]} y1={draft[draft.length - 1]} x2={hover.x} y2={hover.y} stroke={draftColor} strokeWidth={2 * k} strokeDasharray={`${6 * k} ${4 * k}`} />}
          {toPairs(draft).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4 * k} fill={draftColor} />)}
        </g>
      )}

      {cal.length > 0 && (
        <g pointerEvents="none" data-testid="plan-calibration">
          {cal.length === 2 && <line x1={cal[0].x} y1={cal[0].y} x2={cal[1].x} y2={cal[1].y} stroke="#111827" strokeWidth={2 * k} strokeDasharray={`${10 * k} ${4 * k}`} />}
          {cal.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`}>
              <circle r={8 * k} fill="none" stroke="#111827" strokeWidth={2 * k} />
              <line x1={-12 * k} x2={12 * k} stroke="#111827" strokeWidth={1.5 * k} />
              <line y1={-12 * k} y2={12 * k} stroke="#111827" strokeWidth={1.5 * k} />
            </g>
          ))}
          {cal.length === 2 && calibration && calDraft.length === 0 && (
            <Label at={{ x: (cal[0].x + cal[1].x) / 2, y: (cal[0].y + cal[1].y) / 2 }} scale={scale} color="#111827"
              text={`${calibration.meters.toLocaleString("pl-PL", { maximumFractionDigits: 3 })} m`} />
          )}
        </g>
      )}
    </g>
  );
});

function toPairs(pts: readonly number[]): PlanPoint[] {
  const out: PlanPoint[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push({ x: pts[i], y: pts[i + 1] });
  return out;
}
