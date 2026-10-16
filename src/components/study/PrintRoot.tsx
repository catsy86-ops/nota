import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Wydruk z działu Praca (raport budowy, protokół odbioru): treść w osobnym korzeniu pod `body`,
 * reszta strony schowana stylem `html.printing-report` (index.css, `#report-print`). Drukujemy
 * dopiero po wczytaniu zdjęć (najwyżej 3 s czekania). `onDone` po zamknięciu okna drukowania.
 */
export function PrintRoot({ children, onDone, testId = "report-print" }: { children: ReactNode; onDone: () => void; testId?: string }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root) return;
    let alive = true;
    const html = document.documentElement;
    const finish = () => {
      html.classList.remove("printing-report");
      window.removeEventListener("afterprint", finish);
      if (alive) onDone();
    };
    const loaded = () => [...root.querySelectorAll("img")].every((img) => img.complete) && !root.querySelector('[aria-label="Wczytywanie obrazu"]');
    const started = Date.now();
    const tick = () => {
      if (!alive) return;
      if (!loaded() && Date.now() - started < 3000) { setTimeout(tick, 100); return; }
      html.classList.add("printing-report");
      window.addEventListener("afterprint", finish);
      window.print();
      // Część przeglądarek (Android, Safari) nie wysyła `afterprint` albo `print()` nie czeka
      // na zamknięcie okna — sprzątamy przy pierwszym dotknięciu po powrocie. Klasa działa
      // tylko w `@media print`, więc na ekranie niczego nie zmienia.
      setTimeout(() => { if (alive) window.addEventListener("pointerdown", finish, { once: true }); }, 500);
    };
    tick();
    return () => {
      alive = false;
      html.classList.remove("printing-report");
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, [root, onDone]);

  return createPortal(
    <div id="report-print" ref={setRoot} data-testid={testId}>
      {children}
    </div>,
    document.body,
  );
}
