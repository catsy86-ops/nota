/**
 * Kartka raportu dnia / tygodnia (§5.5): podgląd i wydruk. Wydzielona z `JournalReport.tsx`,
 * żeby okno raportu zostało z logiką (udostępnianie, WhatsApp, zakresy), a kartka z wyglądem.
 */
import { Clock, Gauge, MapPin } from "lucide-react";
import { testLine } from "@/lib/study/pressureTest";
import { fittingsLine } from "@/lib/study/fittings";
import { accuracyLabel, mapsUrl } from "@/lib/study/geo";
import { StatusPanel } from "@/components/StatusPanel";
import { NoteImage } from "@/components/NoteImage";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/shifts/time";
import { reportSummary, workLine, workMinutesOf, type JournalReport as Report } from "@/lib/study/report";
import { entryHeadline } from "@/lib/study/journalView";
import { shortageLine } from "@/lib/study/shortages";
import { PrintRoot } from "./PrintRoot";
import { KindIcon } from "./JournalEntrySheet";


export function ReportPaper({ report, print = false }: { report: Report; print?: boolean }) {
  const tests = report.days.flatMap((d) => d.entries).filter((r) => r.entry.test);
  return (
    <article className={cn("report-paper rounded-card border border-border bg-card px-4 py-4 sm:px-6", print && "border-0 px-0")} aria-label="Podgląd raportu">
      <header className="border-b-2 border-foreground/80 pb-2">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
          {report.site === null ? "Wszystkie budowy" : report.site || "Bez budowy"}
        </p>
        {(report.address || report.investor) && (
          <p className="text-xs text-muted-foreground" data-testid="report-site-card">
            {[report.address, report.investor && `inwestor: ${report.investor}`].filter(Boolean).join(" · ")}
          </p>
        )}
        <h2 className="font-display text-xl leading-tight">{report.period}</h2>
        <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground" data-testid="report-summary">{reportSummary(report)}</p>
      </header>

      {report.days.length > 1 && <DaysTable report={report} />}

      {report.days.length === 0 ? (
        <StatusPanel size="inline" tone="no-results" title="Brak wpisów z tej budowy w tym okresie." description="Zmień budowę albo okres." className="my-4" />
      ) : (
        <div className="divide-y divide-border/70">
          {report.days.map((d) => (
            <section key={d.key} className="break-inside-avoid-page py-3" data-report-day={d.key}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="text-sm font-semibold first-letter:uppercase">{d.label}</h3>
                {d.work && (
                  <p className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground" data-report-work>
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {workLine(d.work)}
                  </p>
                )}
              </div>
              {d.done.length > 0 && (
                <p className="mb-2 text-sm" data-report-done>
                  <span className="font-medium">Zrobione: </span>{d.done.join("; ")}
                </p>
              )}
              <ul className="space-y-2">
                {d.entries.map((r) => (
                  <li key={r.entry.id} className="grid grid-cols-[2.75rem_1rem_minmax(0,1fr)] gap-x-2 text-sm" data-report-entry={r.entry.kind}>
                    <span className="pt-px font-mono text-xs tabular-nums text-muted-foreground">{r.time}</span>
                    <KindIcon kind={r.entry.kind} className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap wrap-break-word leading-snug">{entryHeadline(r.entry)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className={cn(r.status === "Problem otwarty" && "font-medium text-foreground")}>{r.status}</span>
                        {r.site && <> · {r.site}</>}
                        {r.stage && <> · etap: {r.stage}</>}
                        {r.topic && <> · {r.topic}</>}
                      </p>
                      {r.entry.geo && (
                        <p className="mt-0.5 text-xs text-muted-foreground" data-report-geo>
                          Mapa ({accuracyLabel(r.entry.geo)}): <a href={mapsUrl(r.entry.geo)} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">otwórz w mapach</a>
                        </p>
                      )}
                      {r.entry.fittings && r.entry.fittings.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground" data-report-fittings>Kształtki: {fittingsLine(r.entry.fittings)}</p>
                      )}
                      {r.entry.test && (
                        <p className={cn("mt-0.5 inline-flex items-start gap-1 text-xs font-medium", r.entry.test.ok ? "text-success-ink" : "text-destructive-ink")} data-report-test>
                          <Gauge className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{testLine(r.entry.test)}
                        </p>
                      )}
                      {r.entry.solution && (
                        <p className="mt-0.5 text-xs" data-report-solution><span className="font-medium">Rozwiązanie:</span> {r.entry.solution}</p>
                      )}
                      {r.entry.images.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Zdjęcia wpisu">
                          {r.entry.images.map((ref) => (
                            <li key={ref}>
                              <NoteImage
                                imageRef={ref}
                                alt=""
                                loading="eager"
                                className={cn("rounded-control object-cover", print ? "h-32 w-32" : "h-14 w-14")}
                                placeholderClassName={print ? "h-32 w-32" : "h-14 w-14"}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {tests.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-tests>
              <h3 className="mb-1.5 text-sm font-semibold">Próby szczelności</h3>
              <ul className="space-y-0.5 text-sm">
                {tests.map((r) => (
                  <li key={r.entry.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{shortDay(r.entry.at)} {r.time}</span>
                    <span className={cn(!r.entry.test!.ok && "font-medium text-destructive-ink")}>{testLine(r.entry.test!)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.fittings.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-fittings-sum>
              <h3 className="mb-1.5 text-sm font-semibold">Kształtki (suma)</h3>
              <table className="w-full max-w-sm text-sm">
                <tbody>
                  {report.fittings.map((f) => (
                    <tr key={f.name} className="border-t border-border/60 first:border-t-0">
                      <td className="py-0.5 pr-3">{f.name}</td>
                      <td className="py-0.5 text-right font-mono tabular-nums">{f.qty} szt.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {report.stages && report.stages.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-stages>
              <h3 className="mb-1.5 text-sm font-semibold">
                Etapy ({report.stages.filter((s) => s.done !== undefined).length}/{report.stages.length})
              </h3>
              <ul className="space-y-0.5 text-sm">
                {report.stages.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2" data-stage-done={s.done !== undefined || undefined}>
                    <span aria-hidden className={s.done !== undefined ? "text-success-ink" : "text-muted-foreground"}>{s.done !== undefined ? "✓" : "○"}</span>
                    <span className={s.done !== undefined ? "" : "text-muted-foreground"}>{s.name}</span>
                    {s.done !== undefined && (
                      <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(s.done).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                    <span className="sr-only">{s.done !== undefined ? "zrobione" : "do zrobienia"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.shortages.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-shortages>
              <h3 className="mb-1.5 text-sm font-semibold">Braki materiału</h3>
              <ul className="space-y-0.5 text-sm">
                {report.shortages.map((s) => <li key={s.id}>{shortageLine(s)}</li>)}
              </ul>
            </section>
          )}
          {report.toOrder.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-to-order>
              <h3 className="mb-1.5 text-sm font-semibold">Do zamówienia</h3>
              <table className="w-full max-w-sm text-sm">
                <tbody>
                  {report.toOrder.map((f) => (
                    <tr key={f.name} className="border-t border-border/60 first:border-t-0">
                      <td className="py-0.5 pr-3">{f.name}</td>
                      <td className="py-0.5 text-right font-mono tabular-nums">{f.qty} szt.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {report.open.length > 0 && (
            <section className="break-inside-avoid-page pt-3">
              <h3 className="mb-1.5 text-sm font-semibold">Otwarte problemy</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {report.open.map((r) => <li key={r.entry.id} className="wrap-break-word">{r.entry.text.trim().split("\n")[0] || "bez opisu"}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Druk firmowy: miejsce na podpisy i datę sporządzenia — raport jako dokument odbioru. */}
      {report.days.length > 0 && (
        <footer className="mt-4 grid grid-cols-2 gap-6 border-t border-border pt-6 text-xs text-muted-foreground break-inside-avoid-page" data-report-signatures>
          <div>
            <div className="h-10 border-b border-dashed border-foreground/50" />
            <p className="mt-1">Wykonawca (podpis)</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-foreground/50" />
            <p className="mt-1">Odbierający / kierownik (podpis)</p>
          </div>
          <p className="col-span-2 font-mono tabular-nums">Sporządzono: {new Date().toLocaleDateString("pl-PL")}</p>
        </footer>
      )}
    </article>
  );
}

const shortDay = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });

/** Zestawienie dni na górze raportu (od dwóch dni): dzień, praca z Grafiku, wpisy, problemy. */
function DaysTable({ report }: { report: Report }) {
  return (
    <table className="mt-3 w-full text-left text-xs" data-report-days-table>
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-2 font-medium">Dzień</th>
          <th className="py-1 pr-2 font-medium">Praca</th>
          <th className="py-1 pr-2 text-right font-medium">Wpisy</th>
          <th className="py-1 text-right font-medium">Problemy</th>
        </tr>
      </thead>
      <tbody className="font-mono tabular-nums">
        {report.days.map((d) => (
          <tr key={d.key} className="border-t border-border/60">
            <td className="py-1 pr-2">{d.key.slice(8, 10)}.{d.key.slice(5, 7)}</td>
            <td className="py-1 pr-2 font-sans">{d.work ? (d.work.minutes <= 0 ? d.work.label : d.work.site === null ? "nierozdz." : formatDuration(workMinutesOf(d.work))) : "—"}</td>
            <td className="py-1 pr-2 text-right">{d.entries.length}</td>
            <td className="py-1 text-right">{d.entries.filter((r) => r.entry.kind === "problem").length || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Wydruk raportu: wspólny mechanizm z protokołem odbioru (`PrintRoot`). */
export function ReportPrint({ report, onDone }: { report: Report; onDone: () => void }) {
  return (
    <PrintRoot onDone={onDone}>
      <ReportPaper report={report} print />
    </PrintRoot>
  );
}
