import { useEffect, useState } from "react";
import { Clock, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBlob } from "@/lib/downloadBlob";
import { recordKey } from "@/lib/study/entryCheck";
import { useEntryCheck } from "@/lib/study/entryCheckStore";
import { durationLabel, liveMinutes, monthHours, siteMonthCsv } from "@/lib/study/siteTime";
import { setSiteRate } from "@/lib/study/store";
import { SITE_RATE_MAX, type SiteInfo } from "@/lib/study/sites";

const zl = (n: number) => `${n.toFixed(2).replace(".", ",")} zł`;
const hoursText = (min: number) => (min / 60).toFixed(min % 60 ? 1 : 0).replace(".", ",");

/**
 * P2.8 Czas na budowie w karcie: licznik od „Wchodzę” (dziś, przed „Wychodzę”), stawka godzinowa
 * budowy i godziny miesiąca z kwotą; „CSV miesiąca” do rozliczenia.
 */
export function SiteTimePanel({ site, today, monthLabel, monthDays }: {
  site: SiteInfo;
  /** Dzień „2026-10-14”. */
  today: string;
  monthLabel: string;
  monthDays: { day: string; minutes: number | null }[];
}) {
  const check = useEntryCheck();
  const record = check.records.get(recordKey(site.id, today));
  const [now, setNow] = useState(() => Date.now());
  const live = liveMinutes(record, now);
  useEffect(() => {
    if (live === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [live === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const sum = monthHours(monthDays, site.rate);
  if (live === null && monthDays.length === 0 && !site.rate) return null;

  function saveRate(raw: string) {
    const t = raw.trim().replace(",", ".");
    if (t === "") { setSiteRate(site.id, null); return; }
    const n = Number(t);
    if (Number.isFinite(n) && n > 0 && n <= SITE_RATE_MAX) setSiteRate(site.id, Math.round(n * 100) / 100);
  }

  function csv() {
    downloadBlob(new Blob([siteMonthCsv(monthDays, site.rate)], { type: "text/csv;charset=utf-8" }), `Godziny - ${site.name} - ${today.slice(0, 7)}.csv`);
  }

  return (
    <section aria-label="Czas na budowie" data-testid="site-time" className="space-y-2.5 rounded-card border border-border/60 bg-card p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-4 w-4" aria-hidden />Czas na budowie</h3>
      {live !== null && record?.at && (
        <p className="text-sm" aria-live="polite">
          Na budowie od <span className="font-mono tabular-nums">{new Date(record.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
          {" · "}<span className="font-semibold tabular-nums">{durationLabel(live)}</span>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`site-rate-${site.id}`} className="text-xs text-muted-foreground">Stawka (zł/h)</Label>
          <Input id={`site-rate-${site.id}`} inputMode="decimal" placeholder="np. 45" className="h-9 w-24 tabular-nums coarse:h-11"
            key={site.rate ?? "none"} defaultValue={site.rate ? String(site.rate).replace(".", ",") : ""} onBlur={(e) => saveRate(e.target.value)} />
        </div>
        <p className="flex-1 text-sm" data-testid="site-time-month">
          <span className="capitalize">{monthLabel}</span>: <span className="font-semibold tabular-nums">{hoursText(sum.minutes)} h</span>
          {sum.amount !== null && <> · <span className="font-semibold tabular-nums">{zl(sum.amount)}</span></>}
          {sum.unsplit > 0 && <span className="text-muted-foreground"> · dni bez podziału: {sum.unsplit}</span>}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={csv} disabled={monthDays.length === 0} className="coarse:h-11">
        <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden />CSV miesiąca
      </Button>
    </section>
  );
}
