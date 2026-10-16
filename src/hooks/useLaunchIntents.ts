import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import type { ComposerAction } from "@/components/AddNoteBar";
import { whenNotesReady, type useNotes } from "@/hooks/useNotes";
import { useLatestRef } from "@/hooks/useLatestRef";
import { claimShare, parseShare, SHARE_PATH } from "@/lib/shareTarget";
import { takeShareInbox, importSharedFiles } from "@/lib/shareInbox";
import { describeRejections } from "@/lib/attachments";
import { yjsStore } from "@/lib/yjsStore";

type AddNote = ReturnType<typeof useNotes>["addNote"];

export interface LaunchIntentsDeps {
  navigate: NavigateFunction;
  /** Dodaje notatkę (z poświatą i kontekstem widoku) i zwraca jej id. */
  addNote: AddNote;
  openNote: (id: string) => void;
  expandComposer: (action?: ComposerAction) => void;
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
        const used = new Map<string, number>();
        yjsStore.referencedAttachments().forEach((a, hash) => used.set(hash, a.size));
        const imported = await importSharedFiles(received.files, used);
        const text = parseShare(SHARE_PATH, received.query) ?? { title: "", content: "" };
        if (!text.title && !text.content && imported.images.length === 0 && imported.attachments.length === 0) {
          toast.error("Z udostępnienia nie ma czego zapisać");
          return;
        }
        const id = add(text.title, text.content, "default", [], null, imported.images, [], "none", null, imported.attachments);
        if (imported.unsupported.length) {
          toast.error(`Nie przyjęto: ${imported.unsupported.join(", ")}`, { description: "Z plików przyjmuję obrazy i PDF.", duration: 9000 });
        }
        if (imported.skippedImages > 0) {
          toast.error(imported.skippedImages === 1 ? "Nie udało się zmniejszyć obrazka do 2 MB" : `${imported.skippedImages} obrazków nie udało się zmniejszyć do 2 MB`);
        }
        const problem = describeRejections(imported.rejected);
        if (problem) toast.error("Część plików nie została dodana", { description: problem, duration: 9000 });
        toast.success("Zapisano w NOTKACH", { action: { label: "Otwórz", onClick: () => open(id) } });
      });
    } else if (shared) {
      // Adres czyścimy od razu — odświeżenie nie ma co powtarzać; `claimShare`
      // łapie jeszcze przypadek odświeżenia, zanim router zdążył zamienić wpis.
      navigate("/", { replace: true });
      if (claimShare(shared)) {
        void whenNotesReady().then(() => {
          const id = add(shared.title, shared.content);
          toast.success("Zapisano w NOTKACH", { action: { label: "Otwórz", onClick: () => open(id) } });
        });
      }
    } else if (window.location.pathname === SHARE_PATH) {
      // Pusty `/share` (np. ręcznie wpisany adres) — po prostu wróć do Notatek.
      navigate("/", { replace: true });
    } else if (params.get("new")) {
      // Skrót „Nowa lista” (`?new=list`) otwiera kompozytor od razu w trybie listy.
      expandComposer(params.get("new") === "list" ? "list" : undefined);
      window.history.replaceState(null, "", window.location.pathname);
    } else if (params.get("szukaj")) {
      // Skrót „Szukaj”: kursor w polu wyszukiwania (widocznym — na telefonie i komputerze to inne pola).
      // Bez gestu iOS nie otworzy klawiatury; Android tak.
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(() => {
        const input = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find((el) => el.offsetParent !== null);
        input?.focus();
      }, 300);
    }
  }, [latest]);
}
