import { addDays } from "date-fns";
import { BookOpen, Brain, Calendar, CalendarRange, Copy, Download, HardHat, Inbox, Keyboard, Lock, LockOpen, Moon, Network, Palette, Plus, RotateCcw, Settings, Share2, SunMoon, Trophy, Type, ZoomIn, ZoomOut } from "lucide-react";
import { APP_FONTS, APP_FONT_META, setAppFont } from "@/lib/appFont";
import { canShareBackupFile } from "@/lib/backup/canShare";
import { toast } from "@/lib/notify";
import { requestLinkGraph } from "@/lib/graphRequest";
import { privateNotes } from "@/lib/privateNotes";
import { lockEverywhere } from "@/lib/vaultAutoLock";
import { vaultUi } from "@/lib/vaultUi";
import { shortcutFor } from "@/lib/shortcuts";
import { dayKey } from "@/lib/reminderOccurrences";
import { requestSettingsTab, type SettingsTab } from "@/lib/settingsDeepLink";
import { requestShiftAction } from "@/lib/shifts/shiftActions";
import { SKINS } from "@/lib/skins";
import { SKIN_META } from "@/lib/skinGallery";
import { trySkin } from "@/lib/skinTry";
import { JOURNAL_REPORT_PARAM, reportParam } from "@/lib/study/reportLink";
import { changeTextSize, resetTextSize } from "@/lib/textSize";
import { viewLabel } from "@/lib/viewMeta";
import { registerCommandSource } from "./registry";
import type { Command, CommandContext } from "./types";

/**
 * A3.4 Wbudowane źródła poleceń (dawniej wpisane w `CommandPalette.tsx`). Nowy dział dopisuje własne źródło
 * `registerCommandSource` w swoim module — paleta pokaże je bez zmian w swoim kodzie.
 */

const nextSkin = (ctx: CommandContext) => SKINS[(SKINS.indexOf(ctx.skin) + 1) % SKINS.length];

/** Skróty do kart Ustawień (Powłoka 2.5). */
const SETTINGS_SHORTCUTS: { tab: SettingsTab; label: string; keywords: string; icon: Command["icon"] }[] = [
  { tab: "appearance", label: "Ustawienia: Wygląd", keywords: "styl motyw krój jasność kolor", icon: Palette },
  { tab: "general", label: "Ustawienia: Ogólne", keywords: "przypomnienia praca seria faktury", icon: Settings },
  { tab: "backup", label: "Ustawienia: Kopia i dane", keywords: "backup kopia eksport przywróć dane", icon: Copy },
  { tab: "sync", label: "Połącz urządzenie (Sync)", keywords: "synchronizacja telefon komputer parowanie kod qr", icon: Network },
];

/**
 * „Zrób kopię teraz” z palety: gdy kopia pominęłaby załączniki, paleta nie decyduje za użytkownika —
 * otwiera Ustawienia → Kopia i dane, gdzie jest pytanie z wyborem (D3).
 */
const confirmInSettings = (ctx: CommandContext) => async () => {
  toast("Kopia pominęłaby część załączników", { description: "Zdecyduj w Ustawieniach → Kopia i dane." });
  requestSettingsTab("backup");
  ctx.openSettings();
  return false;
};

const THEME_MODES: { mode: "light" | "dark" | "system"; label: string; keywords: string }[] = [
  { mode: "light", label: "Jasność: jasna", keywords: "jasny tryb dzienny" },
  { mode: "dark", label: "Jasność: ciemna", keywords: "ciemny tryb nocny" },
  { mode: "system", label: "Jasność: jak w systemie", keywords: "systemowy automatyczny auto" },
];

let registered = false;

/** Rejestruje źródła raz (paleta woła przy imporcie modułu). */
export function registerBuiltinCommands(): void {
  if (registered) return;
  registered = true;

  registerCommandSource({
    group: () => viewLabel("calendar"),
    order: 10,
    mutedIcons: true,
    commands: [
      // Adres dnia kalendarza (K1.5): „Dziś” i „Jutro” otwierają kalendarz na właściwym dniu.
      { id: "kalendarz.dzis", label: "Terminy na dziś", icon: Calendar, keywords: "kalendarz terminy dziś", run: (c) => c.navigate(`/kalendarz?dzien=${dayKey(new Date())}`) },
      { id: "kalendarz.jutro", label: "Terminy na jutro", icon: Calendar, keywords: "kalendarz terminy jutro", run: (c) => c.navigate(`/kalendarz?dzien=${dayKey(addDays(new Date(), 1))}`) },
    ],
  });

  registerCommandSource({
    group: "Praca",
    order: 20,
    mutedIcons: true,
    commands: [
      { id: "praca.nowy-wpis", label: "Nowy wpis w Pracy", icon: Plus, keywords: "praca nowy wpis", run: (c) => c.navigate("/praca?wpis=1") },
      { id: "praca.raport-dnia", label: "Raport dnia", icon: HardHat, keywords: "praca raport dnia", run: (c) => c.navigate(`/praca?${JOURNAL_REPORT_PARAM}=${reportParam({ range: "day", allSites: false })}`) },
    ],
  });

  registerCommandSource({
    group: () => viewLabel("shifts"),
    order: 30,
    commands: [
      { id: "grafik.dodaj-dzis", label: "Dodaj zmianę dziś", keywords: "grafik dodaj zmiane dzis", run: (c) => { requestShiftAction("addToday"); c.go("shifts"); } },
      { id: "grafik.cykl", label: "Nałóż cykl zmian", keywords: "grafik nałóż cykl", run: (c) => { requestShiftAction("pattern"); c.go("shifts"); } },
      { id: "grafik.obraz", label: "Obraz miesiąca (PNG)", keywords: "grafik obraz miesiaca png", run: (c) => { requestShiftAction("image"); c.go("shifts"); } },
    ],
  });

  registerCommandSource({
    group: "Akcje",
    order: 40,
    commands: [
      { id: "akcje.nowa-notatka", label: "Nowa notatka", icon: Plus, shortcut: () => shortcutFor("Nowa notatka"), run: (c) => c.newNote() },
      { id: "akcje.do-skrzynki", label: "Do skrzynki…", icon: Inbox, keywords: "do skrzynki zapisz pomysl przechwyc", shortcut: () => shortcutFor("Do skrzynki (z każdego miejsca)"), run: (c) => c.quickInbox() },
      { id: "akcje.notatka-dnia", label: "Notatka dnia", icon: BookOpen, run: (c) => c.dailyNote() },
      { id: "akcje.notatka-tygodnia", label: "Notatka tygodnia", icon: CalendarRange, keywords: "notatka tygodnia", run: (c) => c.periodNote("week") },
      { id: "akcje.notatka-miesiaca", label: "Notatka miesiąca", icon: CalendarRange, keywords: "notatka miesiaca", run: (c) => c.periodNote("month") },
      { id: "akcje.kopiuj-md", label: "Kopiuj notatkę jako Markdown", icon: Copy, keywords: "kopiuj notatke jako markdown", when: (c) => !!c.copyNote, run: (c) => c.copyNote?.("markdown") },
      { id: "akcje.kopiuj-tekst", label: "Kopiuj notatkę jako tekst", icon: Copy, keywords: "kopiuj notatke jako tekst", when: (c) => !!c.copyNote, run: (c) => c.copyNote?.("text") },
      { id: "akcje.zablokuj", label: "Zablokuj prywatne notatki teraz", icon: Lock, keywords: "zablokuj prywatne notatki teraz", when: (c) => c.vaultPhase === "unlocked", run: () => { void lockEverywhere(privateNotes); } },
      { id: "akcje.odblokuj", label: "Odblokuj prywatne notatki", icon: LockOpen, keywords: "odblokuj prywatne notatki", when: (c) => c.vaultPhase === "locked", run: () => vaultUi.open("unlock") },
      { id: "akcje.ustawienia", label: "Ustawienia", icon: Settings, shortcut: () => shortcutFor("Ustawienia"), run: (c) => c.openSettings() },
      // Powłoka 2.5: od razu na karcie Ustawień (te same karty co link `?settings=`).
      ...SETTINGS_SHORTCUTS.map((t): Command => ({ id: `ustawienia.${t.tab}`, label: t.label, icon: t.icon, keywords: `ustawienia ${t.keywords}`, run: (c) => { requestSettingsTab(t.tab); c.openSettings(); } })),
      { id: "akcje.zrob-kopie", label: "Zrób kopię teraz", icon: Download, keywords: "backup kopia zapasowa pobierz eksport", run: (c) => { void import("@/lib/backup/actions").then((m) => m.exportNow(confirmInSettings(c))); } },
      { id: "akcje.wyslij-kopie", label: "Wyślij kopię", icon: Share2, keywords: "backup kopia udostępnij wyślij telefon", when: () => canShareBackupFile(), run: (c) => { void import("@/lib/backup/actions").then((m) => m.shareNow(confirmInSettings(c))); } },
      { id: "akcje.statystyki", label: "Statystyki i osiągnięcia", icon: Trophy, shortcut: () => shortcutFor("Statystyki"), run: (c) => c.openStats() },
      { id: "akcje.graf", label: "Graf powiązań", icon: Network, run: (c) => { requestLinkGraph(); c.openStats(); } },
      { id: "akcje.skupienie", label: "Tryb skupienia", icon: Brain, run: (c) => c.openFocusMode() },
      { id: "akcje.tekst-wiekszy", label: "Powiększ tekst", icon: ZoomIn, run: () => changeTextSize(1) },
      { id: "akcje.tekst-mniejszy", label: "Pomniejsz tekst", icon: ZoomOut, run: () => changeTextSize(-1) },
      { id: "akcje.tekst-domyslny", label: "Domyślny rozmiar tekstu", icon: RotateCcw, run: () => resetTextSize() },
      { id: "akcje.motyw", label: "Przełącz motyw jasny/ciemny", icon: Moon, run: (c) => c.toggleTheme() },
      { id: "akcje.nastepny-styl", label: "Następny styl", icon: Palette, keywords: "nastepny styl motyw skorka wyglad", hint: (c) => SKIN_META[nextSkin(c)].label, run: (c) => trySkin(nextSkin(c)) },
      { id: "akcje.skroty", label: "Skróty klawiszowe", icon: Keyboard, shortcut: () => shortcutFor("Pokaż tę listę skrótów"), run: (c) => c.openShortcuts() },
    ],
  });

  // Plan motywów 3.3 i Powłoka 2.5: długie listy dopiero po wpisaniu tekstu, żeby nie zasłaniały pustej palety.
  // Zmiana stylu przez `trySkin` — z „Cofnij”.
  registerCommandSource({
    group: "Styl",
    order: 50,
    cheatSheet: false,
    commands: SKINS.map((s): Command => ({
      id: `styl.${s}`, label: `Styl: ${SKIN_META[s].label}`, icon: Palette, keywords: `styl motyw skorka ${s}`,
      hint: () => SKIN_META[s].blurb, when: (c) => c.hasQuery && c.skin !== s, run: () => trySkin(s),
    })),
  });

  registerCommandSource({
    group: "Krój i jasność",
    order: 60,
    cheatSheet: false,
    commands: [
      ...APP_FONTS.map((f): Command => ({
        id: `kroj.${f}`, label: `Krój: ${APP_FONT_META[f].label}`, icon: Type, keywords: `kroj czcionka font pismo ${f}`,
        hint: () => APP_FONT_META[f].blurb, when: (c) => c.hasQuery && c.font !== f,
        run: () => { setAppFont(f); toast.success(`Krój: ${APP_FONT_META[f].label}`); },
      })),
      ...THEME_MODES.map((t): Command => ({
        id: `jasnosc.${t.mode}`, label: t.label, icon: SunMoon, keywords: `jasnosc motyw ${t.keywords}`, when: (c) => c.hasQuery,
        run: (c) => c.setThemeMode(t.mode),
      })),
    ],
  });
}
