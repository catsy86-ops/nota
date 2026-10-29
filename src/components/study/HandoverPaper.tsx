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

      {h.rooms && h.pointsDone && (
        <section data-handover-points>
          <h3 className="mb-1 font-semibold">Punkty ({h.pointsDone.done}/{h.pointsDone.total} gotowe)</h3>
          {h.rooms.map((r) => (
            <div key={r.name} className="break-inside-avoid-page pb-1.5">
              <p className="text-sm font-medium">{r.name}</p>
              <table className="w-full text-sm">
                <tbody>
                  {r.points.map((p, i) => (
                    <tr key={i} className="border-t border-border/60 align-top first:border-t-0">
                      <td className="py-0.5 pr-2">{p.label}{p.sides && <span className="pl-1 font-mono text-xs text-muted-foreground">{p.sides}</span>}</td>
                      <td className="py-0.5 pr-2 text-right font-mono tabular-nums">{p.height !== undefined ? `${p.height} cm` : "—"}</td>
                      <td className="py-0.5 text-xs">
                        {p.steps.length ? p.steps.map((s) => `${s.label} ${shortDate(s.at)}`).join(", ") : <span className="text-muted-foreground">do zrobienia</span>}
                        {p.photos > 0 && <span className="text-muted-foreground"> · {p.photos} zdj.</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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
            {h.remarks.map((r, i) => (
              <li key={i}>
                <span className="font-mono text-xs tabular-nums">{shortDate(r.at)}</span> {r.text}
                {(r.owner || r.due || r.photosAfter > 0) && (
                  <span className="block text-xs text-muted-foreground">
                    {[r.owner && `odpowiedzialny: ${r.owner}`, r.due && `termin: ${r.due.split("-").reverse().join(".")}`, r.photosAfter > 0 && `po naprawie: ${r.photosAfter} zdj.`].filter(Boolean).join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {h.photos.length > 0 && (
        <section data-handover-photos>
          <h3 className="mb-1 font-semibold">Dokumentacja zdjęciowa</h3>
          <div className="space-y-2">
            {h.photoGroups.map((g) => (
              <div key={g.stage ?? ""} className="break-inside-avoid-page" data-handover-photo-group={g.stage ?? ""}>
                {/* Podpis grupy tylko przy etapach — bez przypiętych zdjęć zostaje jedna siatka bez nagłówka. */}
                {(g.stage || h.photoGroups.length > 1) && <h4 className="mb-1 text-xs font-medium text-muted-foreground">{g.stage ?? "Pozostałe"}</h4>}
                <div className="grid grid-cols-3 gap-2">
                  {g.photos.map((ref) => (
                    <NoteImage key={ref} imageRef={ref} loading="eager" alt={g.stage ? `Zdjęcie: ${g.stage}` : "Zdjęcie z budowy"} className="aspect-[4/3] w-full rounded object-cover" placeholderClassName="aspect-[4/3]" />
                  ))}
                </div>
              </div>
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
