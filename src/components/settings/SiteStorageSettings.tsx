import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/attachments";
import { imageSize, measure, siteStorageRefs } from "@/lib/study/siteStorage";
import { useSiteDirectory, useStudy } from "@/lib/study/store";
import { Section } from "./SettingsShared";

/**
 * P3.1 w Ustawieniach: miejsce na zdjęcia, nagrania i dokumenty budów — razem i per budowa,
 * od największej. Liczone dopiero po „Policz”, bo zdjęcia trzeba odczytać z magazynu.
 */
export function SiteStorageSettings() {
  const study = useStudy();
  const sites = useSiteDirectory();
  const [rows, setRows] = useState<{ name: string; bytes: number }[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function count() {
    setBusy(true);
    try {
      const out: { name: string; bytes: number }[] = [];
      for (const s of sites) {
        const bytes = await measure(siteStorageRefs(study.journal, s), imageSize);
        if (bytes > 0) out.push({ name: s.name, bytes });
      }
      setRows(out.sort((a, b) => b.bytes - a.bytes));
    } finally {
      setBusy(false);
    }
  }

  const total = rows?.reduce((n, r) => n + r.bytes, 0) ?? 0;
  return (
    <Section title="Miejsce na zdjęcia budów">
      <div className="space-y-2" data-testid="site-storage-settings">
        <p className="text-xs text-muted-foreground">Zdjęcia, nagrania i dokumenty z Pracy na tym urządzeniu, budowa po budowie.</p>
        {rows && (
          rows.length === 0 ? <p className="text-sm">Brak zdjęć i plików budów.</p> : (
            <>
              <p className="text-sm font-medium tabular-nums">Razem: {formatFileSize(total)}</p>
              <ul className="space-y-0.5 text-sm">
                {rows.map((r) => (
                  <li key={r.name} className="flex justify-between gap-2"><span className="min-w-0 truncate">{r.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{formatFileSize(r.bytes)}</span></li>
                ))}
              </ul>
            </>
          )
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => void count()} disabled={busy} className="coarse:h-11">
          {busy ? "Liczę…" : rows ? "Policz ponownie" : "Policz miejsce"}
        </Button>
      </div>
    </Section>
  );
}
