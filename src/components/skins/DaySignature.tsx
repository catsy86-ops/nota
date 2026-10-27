import { getDayOfYear, getDaysInYear, getISOWeek } from "date-fns";
import { useSkin, type Skin } from "@/lib/skins";
import { dayProgress, moonPhase, moonPath } from "@/lib/daySignature";

/**
 * Sygnatura dnia na Dziś (plan motywów 2.5): jedna ozdoba na styl obok tytułu, z tymi samymi danymi
 * co wiersz daty (dzień, tydzień ISO, dzień roku). Czysto dekoracyjna (`aria-hidden`) — datę dla czytnika
 * ekranu podaje wiersz pod tytułem. Ładowana leniwie z `ViewTitle`. Style: klasy `.day-sig-*` w `index.css`.
 */
export default function DaySignature({ now = new Date() }: { now?: Date }) {
  const skin = useSkin();
  return (
    <div aria-hidden data-day-sig={skin} className="day-sig shrink-0 select-none">
      {render(skin, now)}
    </div>
  );
}

const weekday = (d: Date) => d.toLocaleDateString("pl-PL", { weekday: "long" });
const shortDate = (d: Date) => d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
const numDate = (d: Date) => d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

function render(skin: Skin, now: Date) {
  switch (skin) {
    case "zeszyt":
      // Data dopisana długopisem na marginesie, krzywo i z podkreśleniem.
      return <span className="day-sig-pen">{shortDate(now)}</span>;
    case "plan":
      // Tabliczka rysunkowa: cztery pola jak w rogu arkusza.
      return (
        <dl className="day-sig-block">
          <div><dt>Arkusz</dt><dd>{getDayOfYear(now)}/{getDaysInYear(now)}</dd></div>
          <div><dt>Tydz.</dt><dd>{getISOWeek(now)}</dd></div>
          <div><dt>Skala</dt><dd>1:1</dd></div>
          <div><dt>Data</dt><dd>{numDate(now)}</dd></div>
        </dl>
      );
    case "neon":
      return <span className="day-sig-neon">{weekday(now)}</span>;
    case "zorza": {
      const phase = moonPhase(now);
      return (
        <span className="day-sig-moon">
          <svg viewBox="0 0 20 20" width="34" height="34">
            <circle cx="10" cy="10" r="10" className="day-sig-moon-dark" />
            <path d={moonPath(phase, 10)} className="day-sig-moon-lit" />
          </svg>
          <span>{phase.name}</span>
        </span>
      );
    }
    case "miedz":
      return (
        <span className="day-sig-plate">
          <span>Dzień nr {getDayOfYear(now)}</span>
          <span>Tydz. {getISOWeek(now)} · {now.getFullYear()}</span>
        </span>
      );
    case "matrix":
      return <span className="day-sig-term">&gt; dziś {numDate(now)}<span className="day-sig-caret" /></span>;
    case "odblask":
      // Tabliczka budowy w pasach ostrzegawczych.
      return <span className="day-sig-sign">Dziś · {numDate(now)}</span>;
    case "kafle":
      // Data na jednej płytce z fugą i połyskiem.
      return (
        <span className="day-sig-tile">
          <span className="day-sig-tile-day">{now.getDate()}</span>
          <span>{now.toLocaleDateString("pl-PL", { month: "short" })}</span>
        </span>
      );
    case "tablica":
      // Dzień tygodnia napisany markerem, z falistym podkreśleniem.
      return <span className="day-sig-marker">{weekday(now)}</span>;
    case "hydraulika": {
      // Manometr: wskazówka od −120° (północ) do +120° (koniec doby).
      const p = dayProgress(now);
      const angle = -120 + 240 * p;
      return (
        <span className="day-sig-gauge">
          <svg viewBox="0 0 40 40" width="46" height="46">
            <circle cx="20" cy="20" r="18" className="day-sig-gauge-face" />
            <path d="M8.7 31.3A16 16 0 1 1 31.3 31.3" className="day-sig-gauge-scale" />
            <line x1="20" y1="20" x2="20" y2="7" className="day-sig-gauge-needle" transform={`rotate(${angle.toFixed(1)} 20 20)`} />
            <circle cx="20" cy="20" r="2.2" className="day-sig-gauge-hub" />
          </svg>
          <span>{Math.round(p * 100)}% dnia</span>
        </span>
      );
    }
  }
}
