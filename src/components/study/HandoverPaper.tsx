import { MapPin } from "lucide-react";
import { NoteImage } from "@/components/NoteImage";
import type { Handover } from "@/lib/study/handover";

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Kartka protokołu odbioru (tylko do wydruku / PDF): dane budowy, etapy z datami, próby szczelności,
 * uwagi, zdjęcia i dwa pola na podpisy. Kolory na papier ustawia `.report-paper` w `index.css`.
 */
export function HandoverPaper({ handover: h }: { handover: Handover }) {
  return (
    <article className="report-paper space-y-4 text-sm" aria-label="Protokół odbioru">
      <header className="border-b-2 border-foreground/80 pb-2">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden />{h.site}
        </p>
        <h2 className="font-display text-xl leading-tight">Protokół odbioru instalacji wodno-kanalizacyjnej</h2>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs" data-testid="handover-meta">
          {h.address && <><dt className="text-muted-foreground">Adres</dt><dd>{h.address}</dd></>}
          {h.investor && <><dt className="text-muted-foreground">Inwestor</dt><dd>{h.investor}</dd></>}
          {h.period && <><dt className="text-muted-foreground">Okres prac</dt><dd>{h.period}</dd></>}
          <dt className="text-muted-foreground">Data protokołu</dt><dd>{h.date}</dd>
        </dl>
      </header>

      {h.stages && h.stages.length > 0 && (
        <section className="break-inside-avoid-page" data-handover-stages>
          <h3 className="mb-1 font-semibold">Zakres prac (etapy)</h3>
          <ul className="space-y-0.5">
            {h.stages.map((s) => (
              <li key={s.id} className="flex items-baseline gap-2">
                <span aria-hidden>{s.done !== undefined ? "☑" : "☐"}</span>
                <span className="flex-1">{s.name}</span>
                <span className="font-mono text-xs tabular-nums">{s.done !== undefined ? shortDate(s.done) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="break-inside-avoid-page" data-handover-tests>
        <h3 className="mb-1 font-semibold">Próby szczelności</h3>
        {h.tests.length === 0 ? (
          <p className="text-muted-foreground">Brak protokołów prób w dzienniku.</p>
        ) : (
          <ul className="space-y-0.5">
            {h.tests.map((t, i) => <li key={i}><span className="font-mono text-xs tabular-nums">{shortDate(t.at)}</span> {t.line}</li>)}
          </ul>
        )}
      </section>

      <section className="break-inside-avoid-page" data-handover-remarks>
        <h3 className="mb-1 font-semibold">Uwagi</h3>
        {h.remarks.length === 0 ? (
          <p>Brak uwag — wszystkie zgłoszone problemy rozwiązane.</p>
        ) : (
          <ul className="space-y-0.5">
            {h.remarks.map((r, i) => <li key={i}><span className="font-mono text-xs tabular-nums">{shortDate(r.at)}</span> {r.text}</li>)}
          </ul>
        )}
      </section>

      {h.photos.length > 0 && (
        <section data-handover-photos>
          <h3 className="mb-1 font-semibold">Dokumentacja zdjęciowa</h3>
          <div className="grid grid-cols-3 gap-2">
            {h.photos.map((ref) => (
              <NoteImage key={ref} imageRef={ref} loading="eager" alt="Zdjęcie z budowy" className="aspect-[4/3] w-full rounded object-cover" placeholderClassName="aspect-[4/3]" />
            ))}
          </div>
          {h.morePhotos > 0 && <p className="mt-1 text-xs text-muted-foreground">i {h.morePhotos} więcej — w paczce ZIP budowy.</p>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-8 pt-10 break-inside-avoid-page" aria-label="Podpisy">
        {["Wykonawca", "Inwestor"].map((who) => (
          <div key={who} className="text-center text-xs">
            <div className="border-t border-foreground/70 pt-1">{who} — data i podpis</div>
          </div>
        ))}
      </section>
    </article>
  );
}
