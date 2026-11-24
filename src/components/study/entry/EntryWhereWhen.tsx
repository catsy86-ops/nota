import { Clock, LocateFixed, MapPin, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DelayedSpinner } from "@/components/DelayedSpinner";
import { cn } from "@/lib/utils";
import { accuracyLabel, mapsUrl } from "@/lib/study/geo";
import { fromLocalInput, toLocalInput, whenLabel } from "@/lib/study/journalView";
import type { JournalDraft } from "@/lib/study/draft";

type Geo = NonNullable<JournalDraft["geo"]>;

/**
 * Górny wiersz arkusza wpisu (R2.1): budowa (pigułka albo pole), lokalizacja „Tu jestem”, budowa obok,
 * zapis lokalizacji budowy i chwila wpisu. Stan i zapisy zostają w `JournalEntrySheet` — tu sam widok.
 */
export function EntryWhereWhen(p: {
  site: string;
  editingSite: boolean;
  siteText: string;
  onSiteText: (text: string) => void;
  onOpenSiteEditor: () => void;
  onCommitSite: () => void;
  /** Ostatnie budowy do wyboru jednym dotykiem (pigułki pod polem budowy). */
  siteChips: readonly string[];
  geo: Geo | null;
  onClearGeo: () => void;
  locating: boolean;
  onLocate: () => void;
  nearbyName: string | null;
  onPickSite: (name: string) => void;
  /** Budowa bez zapisanej lokalizacji — propozycja zapisu bieżącej (`null` = nie proponujemy). */
  saveSiteGeoFor: string | null;
  onSaveSiteGeo: () => void;
  editingWhen: boolean;
  onEditingWhen: (on: boolean) => void;
  at: number | null;
  onAt: (at: number | null) => void;
}) {
  const { site, editingSite, geo, at } = p;
  /** Ostatnie budowy: jeden dotyk zamiast pisania adresu na rusztowaniu. */
  const chipsRow = p.siteChips.length > 0 && (
    <div className="flex w-full flex-wrap gap-1.5" role="group" aria-label="Ostatnie budowy" data-testid="journal-site-chips">
      {p.siteChips.map((s) => (
        // Bez utraty fokusu: pole nie zamyka się przed kliknięciem pigułki.
        <Button key={s} type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => p.onPickSite(s)} variant="chip-add" size="chip" className="max-w-full">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{s}</span>
        </Button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {editingSite ? (
        <label className="block w-full space-y-1 text-xs text-muted-foreground">
          Inwestycja / adres
          <input
            autoFocus
            value={p.siteText}
            onChange={(e) => p.onSiteText(e.target.value)}
            onBlur={p.onCommitSite}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.onCommitSite(); } }}
            placeholder="np. Dom Kowalskich, ul. Leśna 4"
            enterKeyHint="done"
            className="w-full rounded-field border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
          />
        </label>
      ) : (
        <Button
          type="button"
          onClick={p.onOpenSiteEditor}
          aria-label={site ? `Budowa: ${site}. Zmień` : "Dodaj budowę"}
          variant="chip" size="chip-md" className="max-w-full bg-muted/50"
        >
          <MapPin className="size-4 shrink-0 text-primary-ink" aria-hidden />
          <span className={cn("truncate", !site && "text-muted-foreground")}>{site || "Dodaj budowę"}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      )}
      {editingSite && chipsRow}
      {!editingSite && (geo ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 pl-3 text-sm coarse:min-h-11" data-testid="journal-geo">
          <LocateFixed className="size-4 shrink-0 text-primary-ink" aria-hidden />
          <a href={mapsUrl(geo)} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-2 hover:underline">Tu ({accuracyLabel(geo)})</a>
          <button type="button" onClick={p.onClearGeo} aria-label="Usuń lokalizację wpisu" className="pressable rounded-full p-1.5 text-muted-foreground hover:text-foreground coarse:-my-2.5 coarse:-mr-1 coarse:inline-flex coarse:size-11 coarse:items-center coarse:justify-center">
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ) : (
        <Button
          type="button"
          onClick={p.onLocate}
          disabled={p.locating}
          variant="chip-add" size="chip-md"
        >
          {p.locating ? <DelayedSpinner active className="size-4" /> : <LocateFixed className="size-4" aria-hidden />}
          {p.locating ? "Szukam…" : "Tu jestem"}
        </Button>
      ))}
      {/* Lokalizacja wpisu obok zapisanej budowy: jeden dotyk zamiast wybierania. */}
      {!editingSite && p.nearbyName && p.nearbyName !== site && (
        <Button type="button" onClick={() => p.onPickSite(p.nearbyName!)} data-testid="journal-nearby-site" variant="pill" size="chip-md">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Budowa obok: {p.nearbyName}</span>
        </Button>
      )}
      {/* Pierwszy raz na tej budowie: zapisz jej lokalizację, następne wpisy podpowiedzą ją same. */}
      {!editingSite && geo && p.saveSiteGeoFor && (
        <Button type="button" onClick={p.onSaveSiteGeo} data-testid="journal-save-site-geo" variant="chip-add" size="chip-md" className="max-w-full text-primary-ink border-primary/40">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Zapisz jako lokalizację budowy</span>
        </Button>
      )}
      {/* Wpis „za wczoraj”: data i godzina zwinięte w pigułkę, domyślnie chwila zapisu. */}
      {p.editingWhen ? (
        <div className="flex w-full items-end gap-2">
          <label className="block min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
            Kiedy
            <input
              type="datetime-local"
              autoFocus
              value={toLocalInput(at ?? Date.now())}
              max={toLocalInput(Date.now())}
              onChange={(e) => { const next = fromLocalInput(e.target.value); if (next !== null) p.onAt(next); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.onEditingWhen(false); } }}
              className="w-full rounded-field border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
            />
          </label>
          <Button type="button" variant="outline" onClick={() => { p.onAt(null); p.onEditingWhen(false); }} className="coarse:h-11">Teraz</Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => p.onEditingWhen(true)}
          aria-label={`Kiedy: ${at === null ? "teraz" : whenLabel(at)}. Zmień`}
          variant="chip" size="chip-md" className="max-w-full bg-muted/50"
        >
          <Clock className="size-4 shrink-0 text-primary-ink" aria-hidden />
          <span className={cn("truncate tabular-nums", at === null && "text-muted-foreground")}>{at === null ? "Teraz" : whenLabel(at)}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      )}
      {!editingSite && chipsRow}
    </div>
  );
}
