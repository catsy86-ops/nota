import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import type { ComposerAction } from "@/components/AddNoteBar";
import { whenNotesReady, type useNotes } from "@/hooks/useNotes";
import { useLatestRef } from "@/hooks/useLatestRef";
import { claimShare, parseShare, SHARE_PATH } from "@/lib/shareTarget";
import { sweepShareInbox, takeShareInbox } from "@/lib/shareInbox";
import { importNoteFiles, warnImportedFiles } from "@/lib/inboxFiles";
import { yStudy } from "@/lib/study/data";

type AddNote = ReturnType<typeof useNotes>["addNote"];

export interface LaunchIntentsDeps {
  navigate: NavigateFunction;
  /** Dodaje notatkę (z poświatą i kontekstem widoku) i zwraca jej id. */
  addNote: AddNote;
  openNote: (id: string) => void;
  expandComposer: (action?: ComposerAction) => void;
  /** Skrót PWA „Do skrzynki” (`?skrzynka=1`, Skrzynka 2.3). */
  openQuickInbox?: () => void;
}

/**
 * Wejścia z `manifest.webmanifest`, raz przy starcie: skróty z ekranu głównego „Nowa notatka” (`?new=1`),
 * „Nowa lista” (`?new=list`), „Szukaj” (`?szukaj=1`) i Web Share Target (`/share?share-title/-text/-url=`,
 * z plikami — `?inbox=<id>` odłożone przez service worker). Adres czyści się od razu.
 */
export function useLaunchIntents(deps: LaunchIntentsDeps) {
  // Funkcje z ostatniego renderu — efekt biegnie raz, a zapis czeka na wczytanie bazy.
  const latest = useLatestRef(deps);
  useEffect(() => {
    const { navigate, expandComposer } = latest.current;
    const add: AddNote = (...args) => latest.current.addNote(...args);
    const open = (id: string) => latest.current.openNote(id);
    const params = new URLSearchParams(window.location.search);
    const shared = parseShare(window.location.pathname, window.location.search);
    const inbox = params.get("inbox");
    // Porzucone wpisy udostępnień z plikami (Plan-nowy 1.10) — po starcie, bez pośpiechu.
    const sweep = window.setTimeout(() => void sweepShareInbox(), 10_000);
    if (inbox !== null && window.location.pathname === SHARE_PATH) {
      // Udostępnienie z plikami: service worker odłożył je pod `?inbox=<id>` (sw-share.js).
      // `0` = SW nie zdołał zapisać, nie ma czego odbierać.
      navigate("/", { replace: true });
      void whenNotesReady().then(async () => {
        const received = inbox === "0" ? null : await takeShareInbox(inbox);
        if (!received) {
          toast.error("Nie udało się odebrać udostępnionych plików", { description: "Spróbuj udostępnić jeszcze raz." });
          return;
        }
        if (received.skipped > 0) toast.warning(received.skipped === 1 ? "Jeden plik pominięty" : `Pominięte pliki: ${received.skipped}`, { description: "Jedno udostępnienie przyjmuje do 30 plików, każdy do 10 MB." });
        // Formularz z obcej strony też może trafić na `/share` (Origin: null przechodzi sprawdzenie w sw-share.js), więc
        // zapis czeka na „Zapisz” jak przy udostępnieniu samego tekstu (S6 audytu).
        const preview = parseShare(SHARE_PATH, received.query);
        const saveIt = await new Promise<boolean>((resolve) => {
          const n = received.files.length;
          toast("Zapisać udostępnione w NOTKACH?", {
            id: "share-inbox-confirm",
            duration: 30_000,
            description: preview?.title || (n > 0 ? (n === 1 ? "1 plik" : `Pliki: ${n}`) : preview?.content.slice(0, 120)),
            action: { label: "Zapisz", onClick: () => resolve(true) },
            cancel: { label: "Pomiń", onClick: () => resolve(false) },
            onDismiss: () => resolve(false),
            onAutoClose: () => resolve(false),
          });
        });
        if (!saveIt) return;
        const imported = await importNoteFiles(received.files);
        const text = preview ?? { title: "", content: "" };
        if (!text.title && !text.content && imported.images.length === 0 && imported.attachments.length === 0) {
          toast.error("Z udostępnienia nie ma czego zapisać");
          return;
        }
        const warn = () => warnImportedFiles(imported);
        const saveAsNote = () => {
          const id = add(text.title, text.content, "default", [], null, imported.images, [], "none", null, imported.attachments);
          warn();
          toast.success("Zapisano w NOTKACH", { action: { label: "Otwórz", onClick: () => open(id) } });
        };
        // H4.1: same zdjęcia, a Praca jest w użyciu — pytamy, czy to wpis z budowy. Zamknięcie dymku albo brak
        // odpowiedzi zapisuje notatkę jak dotąd, więc zdjęcia nigdy nie przepadają.
        const study = yStudy.get();
        const usesWork = study.journal.length > 0 || Object.keys(study.sites).length > 0;
        if (imported.images.length === 0 || imported.attachments.length > 0 || !usesWork) { saveAsNote(); return; }
        let decided = false;
        const asNote = () => { if (decided) return; decided = true; saveAsNote(); };
        const asEntry = () => {
          if (decided) return;
          decided = true;
          void import("@/lib/study/shareToEntry").then(({ sharedToEntry }) => {
            const extra = sharedToEntry(imported.images, [text.title, text.content].filter(Boolean).join("\n"));
            warn();
            latest.current.navigate("/praca?wpis=1");
            // U góry: na dole leży „Zapisz wpis” otwartego arkusza.
            if (extra > 0) toast.success(extra === 1 ? "Reszta zdjęć zapisana w kolejnym wpisie" : `Reszta zdjęć zapisana w ${extra} kolejnych wpisach`, { position: "top-center" });
          }, () => asNoteAfterFailure());
        };
        // Moduł wpisu nie doszedł (brak sieci przy pierwszym użyciu) — zdjęcia idą do notatki.
        const asNoteAfterFailure = () => saveAsNote();
        const n = imported.images.length;
        toast(`Zapisać ${n === 1 ? "zdjęcie" : `${n} zdjęć`} jako…`, {
          id: "share-choice",
          duration: 20_000,
          description: study.site ? `Wpis z budowy: ${study.site}` : undefined,
          action: { label: "Wpis z budowy", onClick: asEntry },
          cancel: { label: "Notatka", onClick: asNote },
          onDismiss: asNote,
          onAutoClose: asNote,
        });
      });
    } else if (shared) {
      // Adres czyścimy od razu — odświeżenie nie ma co powtarzać; `claimShare`
      // łapie jeszcze przypadek odświeżenia, zanim router zdążył zamienić wpis.
      navigate("/", { replace: true });
      // Adres `/share?…` może otworzyć każda strona (link, zakładka-clipper), więc zapis czeka na „Zapisz”:
      // obca strona nie dopisze po cichu notatki, która rozeszłaby się synchronizacją (Plan-nowy 1.8).
      if (claimShare(shared)) {
        void whenNotesReady().then(() => {
          toast("Zapisać w NOTKACH?", {
            id: "share-confirm",
            duration: 30_000,
            description: shared.title || shared.content.slice(0, 120),
            action: {
              label: "Zapisz",
              onClick: () => {
                const id = add(shared.title, shared.content);
                toast.success("Zapisano w NOTKACH", { action: { label: "Otwórz", onClick: () => open(id) } });
              },
            },
            cancel: { label: "Pomiń", onClick: () => {} },
          });
        });
      }
    } else if (window.location.pathname === SHARE_PATH) {
      // Pusty `/share` (np. ręcznie wpisany adres) — po prostu wróć do Notatek.
      navigate("/", { replace: true });
    } else if (params.get("new")) {
      // Skrót „Nowa lista” (`?new=list`) otwiera kompozytor od razu w trybie listy.
      expandComposer(params.get("new") === "list" ? "list" : undefined);
      window.history.replaceState(null, "", window.location.pathname);
    } else if (params.get("skrzynka")) {
      // Skrót „Do skrzynki”: małe okno z polem Skrzynki nad widokiem startowym.
      window.history.replaceState(null, "", window.location.pathname);
      latest.current.openQuickInbox?.();
    } else if (params.get("szukaj")) {
      // Skrót „Szukaj”: kursor w polu wyszukiwania (widocznym — na telefonie i komputerze to inne pola).
      // Bez gestu iOS nie otworzy klawiatury; Android tak.
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(() => {
        const input = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find((el) => el.offsetParent !== null);
        input?.focus();
      }, 300);
    }
    return () => window.clearTimeout(sweep);
  }, [latest]);
}
