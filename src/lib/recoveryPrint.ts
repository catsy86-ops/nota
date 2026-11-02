/**
 * Skarbiec 1.7: wydruk kodu awaryjnego. Kartka powstaje w osobnej, niewidocznej ramce (`iframe` bez skryptów
 * strony), żeby kod nie trafiał do DOM aplikacji ani do zrzutów; ramka znika po wydruku.
 */
export function printRecoveryCode(code: string, now: Date = new Date()): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.right = "0";
  frame.style.bottom = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  const day = now.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  const groups = code.split("-");
  const page = doc.createElement("main");
  page.style.cssText = "font: 14px/1.5 system-ui, sans-serif; color: #111; padding: 32px; max-width: 560px";
  const h1 = doc.createElement("h1");
  h1.textContent = "Kod awaryjny skarbca notki";
  h1.style.cssText = "font-size: 20px; margin: 0 0 4px";
  const date = doc.createElement("p");
  date.textContent = `Wygenerowany ${day}`;
  date.style.cssText = "margin: 0 0 24px; color: #555";
  const box = doc.createElement("p");
  box.style.cssText = "font: 600 22px/1.8 ui-monospace, 'JetBrains Mono', monospace; letter-spacing: 0.08em; border: 2px solid #111; border-radius: 8px; padding: 16px; margin: 0 0 24px; word-spacing: 0.4em";
  box.textContent = groups.join(" ");
  const how = doc.createElement("ol");
  how.style.cssText = "margin: 0; padding-left: 20px";
  for (const line of [
    "Kod odblokowuje Twoje prywatne notatki, gdy zapomnisz hasła: okno skarbca → „Mam kod awaryjny”.",
    "Kto zna ten kod, może odczytać prywatne notatki. Trzymaj kartkę osobno od telefonu i komputera.",
    "Po użyciu kodu aplikacja wygeneruje nowy — ten przestanie działać. Tę kartkę wtedy zniszcz.",
  ]) {
    const li = doc.createElement("li");
    li.textContent = line;
    li.style.marginBottom = "6px";
    how.appendChild(li);
  }
  page.append(h1, date, box, how);
  doc.title = "Kod awaryjny";
  doc.body.style.margin = "0";
  doc.body.appendChild(page);
  const win = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 0);
  win?.addEventListener("afterprint", cleanup, { once: true });
  // Bez `afterprint` (część przeglądarek mobilnych) ramka i tak znika po minucie.
  setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60_000);
  win?.focus();
  win?.print();
}
