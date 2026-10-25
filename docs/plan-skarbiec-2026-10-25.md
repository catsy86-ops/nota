# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie „Skarbca” (notatki prywatne) (2026-10-25)

Dziesiąty plan z serii „dział po dziale”, w tym samym układzie. Skarbiec to szyfrowanie notatek prywatnych: `lib/vault.ts` (kryptografia), `lib/privateNotes.ts` (sesja, kolejka zapisu, blokada), `lib/vaultAutoLock.ts`, `components/vault/*`.

**Zasada tego planu:** każda zmiana w kryptografii i formacie (Etap 3) przechodzi przegląd bezpieczeństwa (`security-reviewer` albo `/security-review`), ma wektory testowe i odczyt starego formatu. Nic nie osłabia obecnej ochrony, nawet tymczasowo.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Skarbiec z 2026-10-10 (`roadmap.md` → „Prywatne notatki”): jedno hasło, PBKDF2-SHA-256 600 000 iteracji, sól 16 B, losowy klucz danych opakowany kluczem z hasła, AES-256-GCM z IV 12 B na zapis, AAD = id notatki, format `v1.<iv>.<ct>`; kod awaryjny pokazywany raz; klucz tylko w pamięci (`extractable: false`); projekcja zablokowanej notatki pusta (wyszukiwanie, graf, eksport, kopia, Skrzynka nic nie widzą); wersje wyłączone dla prywatnych; zagęszczanie IndexedDB po blokadzie; auto-blokada po bezczynności i po ukryciu karty; ograniczanie prób hasła (`throttleDelayMs`).
- `plan-dzialy-2026-10-22.md` §12 Poprawa 1 — wykrycie: sesja pamięta odcisk metadanych (`sessionFingerprint`: epoch, sól, klucz opakowany, kod sprawdzający) i blokuje się przy rozjeździe, także gdy dwa skarbce założone offline mają ten sam `epoch` (Fala 1, `privateNotes.ts:167`).
- §12 Poprawa 5 częściowo i Dopracowanie: pola wyboru jako `Checkbox`, miernik hasła ogłasza zmianę poziomu, nie każdy znak (Fala 3).
- §12 Poprawa 6 częściowo: kod awaryjny pobierany przez `downloadBlob` z opóźnionym `revokeObjectURL`.

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| opis.md | **Skarbiec nie ma sekcji w `opis.md`** — opis jest tylko w `roadmap.md` (2026-10-10) i we wpisach Fal. CLAUDE.md wymaga opisu każdej funkcji | `grep "Skarbiec" opis.md` |
| §12 Popr. 1 (naprawa) | Po rozjeździe albo po zmianie hasła na innym urządzeniu notatki z innego skarbca są „nieodszyfrowywalne”; `rekey` przy zmianie hasła je pomija (`skipped`) i zostają takie na zawsze. Brak „Odszyfruj starym hasłem” i przeszyfrowania | `privateNotes.ts:425` (`rekey` → `skipped`), `:498` |
| §12 Popr. 4 | Nieodszyfrowana notatka to ślepy zaułek: kafel pokazuje tylko zdanie, bez akcji (stare hasło / kod awaryjny, pobierz szyfrogram, usuń) | `LockedNoteTile.tsx:114-115` |
| §12 Popr. 2 | Minimum hasła 8 znaków (`MIN_PASSWORD_LENGTH`), „Słabe” przechodzi; otwarta decyzja „≥ 12” | `vault.ts:275` |
| §12 Popr. 3 | Format `v1`: `epoch` nie wchodzi do AAD; w dokumencie jawne zostają kolor, przypięcie, folder, daty, termin, `parentId` (widać, *że* jest notatka prywatna w folderze X z terminem Y) | `vault.ts:10,22,74`, `roadmap.md` (Fala B) |
| §12 Popr. 5 | Brak ostrzeżenia i odliczania przed auto-blokadą (notatka w edycji blokuje się bez uprzedzenia) | `vaultAutoLock.ts` |
| §12 Popr. 6 | Ustawienia auto-blokady (`hiddenLock`, `autoLock`) poza kopią i synchronizacją ustawień | `vaultAutoLock.ts:5-23` |
| §12 Dopr. | Pole hasła przy odblokowaniu `autoComplete="off"` — menedżer haseł nie podpowie (**decyzja**); kod awaryjny bez „Drukuj” i bez grupowania przy wpisywaniu (auto-myślniki); przejście przy blokadzie | `VaultDialogs.tsx:159,329,361-362` |
| §12 Rozb. 1–4 | Brak listy notatek prywatnych (`ma:prywatne` — wyszukiwanie celowo je pomija, ale nie ma nawet filtra „pokaż prywatne”); brak odblokowania biometrią (WebAuthn PRF); brak okresowego testu hasła i stanu kodu awaryjnego; brak „Nowa notatka prywatna” (dziś: utwórz jawną → zablokuj); obrazy i załączniki nieszyfrowane (notatki z plikami nie da się zablokować) | `searchNotes.ts:122`, brak `PublicKeyCredential` w `src/` |
| §12 Wygląd | Brak ikony stanu skarbca (otwarta kłódka) w nagłówku; kafel prywatny ma 2 z 4 stanów wizualnych (zablokowana, odszyfrowuję, nieodszyfrowywalna, brak skarbca — tekstem); miernik hasła na kolorach stałych | `AppHeader.tsx`, `LockedNoteTile.tsx` |

**Powiązania:** Terminy 1.5 (akcja z powiadomienia na prywatnej notatce), Dziś 1.2 i Kalendarz (tytuł „Notatka prywatna” wszędzie — wspólny helper), Praca 3.1 (wersja aplikacji w awareness — tu potrzebna przed zmianą formatu w Etapie 3), Ustawienia (karta „Prywatne notatki”), Długi D-2 (Długi za skarbcem — na razie nie).

**Ograniczenia:**
- **Bezpieczeństwo przede wszystkim:** klucz nigdy poza pamięcią, żadnych logów z treścią, hasłem ani kodem (`logDiag` tylko nazwy błędów), raport diagnostyczny bez metadanych skarbca. Test „nic jawnego w dokumencie” po każdej zmianie.
- **Zgodność formatu:** `v2` czytane obok `v1`; zapis `v2` dopiero, gdy wszystkie urządzenia znają `v2` (ostrzeżenie z Praca 3.1). Kopia zapasowa z `v1` zawsze się wczytuje.
- **Paczka startowa:** `vault.ts` i dialogi leniwe; w paczce startowej tylko to, co jest dziś (stan, kafel).
- **WCAG 2.2 AA** (3.3.8 dostępne uwierzytelnianie: wklejanie hasła i menedżery haseł dozwolone). Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: opis i poprawki bez zmiany formatu (najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **„Skarbiec — stan aktualny” w `opis.md`:** model zagrożeń (przed czym chroni: odczyt pliku, kopii, cudzego urządzenia bez hasła; przed czym nie: metadane, obrazy, zainfekowane urządzenie, zapomniane hasło), format, sesja, auto-blokada, kod awaryjny, rozjazd, testy. Bez zmian w kodzie. | `opis.md` | 3 | S |
| 1.2 | **Notatka nieodszyfrowywalna ma wyjście:** na kaflu „Odszyfruj innym hasłem / kodem awaryjnym” (jednorazowo, klucz z poprzedniego skarbca → przeszyfrowanie bieżącym kluczem), „Pobierz szyfrogram” (plik `.notki-vault` do ręcznego odzysku), „Usuń” (z potwierdzeniem). Po zmianie hasła lista pominiętych notatek (`skipped`) w dymku z tą samą akcją. | `LockedNoteTile.tsx`, `privateNotes.ts` (`recoverWith(password)`), `VaultDialogs.tsx` | 3 | M |
| 1.3 | **Ostrzeżenie przed auto-blokadą:** 30 s przed blokadą przy otwartej prywatnej notatce dymek „Zablokuję za 30 s — [Jeszcze 5 min]”; szkic w edycji zapisuje się przed blokadą (już jest kolejka — test, że nic nie ginie). | `vaultAutoLock.ts`, `PrivateNoteGate.tsx` | 2 | S |
| 1.4 | **Minimum hasła 12 znaków** dla nowych haseł i zmiany hasła (stare hasła dalej działają); „Słabe” nie przechodzi; miernik z podpowiedzią „4 słowa ze spacjami są mocniejsze niż krótkie z cyframi”. Po decyzji V-1. | `vault.ts:275,323`, `VaultDialogs.tsx` | 2 | S |
| 1.5 | **Menedżer haseł przy odblokowaniu:** `autoComplete="current-password"` + ukryte pole `username` „Skarbiec hydra”, żeby menedżer wiedział, do czego hasło. Po decyzji V-2. | `VaultDialogs.tsx:159` | 2 | S |
| 1.6 | **Ustawienia auto-blokady w kopii** (sekcja ustawień urządzenia) i jednoznaczny opis „na tym urządzeniu”. | `vaultAutoLock.ts`, kopia ustawień | 1 | S |
| 1.7 | **Kod awaryjny:** „Drukuj” (kartka z kodem w grupach po 4, datą i instrukcją), przy wpisywaniu auto-myślniki i wielkie litery, wklejanie z dowolnymi separatorami. | `VaultDialogs.tsx:329,361` | 1 | S |

## Etap 2: codzienne używanie

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Ikona stanu w nagłówku:** kłódka zamknięta / otwarta (z czasem do auto-blokady w podpowiedzi), stuknięcie = „Zablokuj teraz” albo „Odblokuj”. Tylko gdy skarbiec jest ustawiony. | 3 | S |
| 2.2 | **Nowa notatka prywatna:** w kompozytorze przełącznik „Prywatna” (wymaga odblokowanego skarbca) — notatka od pierwszego znaku zapisuje się zaszyfrowana; jawna wersja nigdy nie trafia do dokumentu. | 2 | M |
| 2.3 | **Lista notatek prywatnych:** pozycja „Prywatne” w pasku bocznym (licznik), widok kafli zablokowanych / odblokowanych; filtr `ma:prywatne` w wyszukiwarce zwraca same kafle (bez przeszukiwania treści — treść nadal poza indeksem). | 2 | S |
| 2.4 | **Okresowy test hasła:** raz na 90 dni (wyłączalne) przy odblokowaniu „Sprawdź, czy pamiętasz kod awaryjny” albo przypomnienie „Masz kod awaryjny zapisany? Ostatnio sprawdzany: nigdy”. Stan w karcie Ustawień. | 2 | S |
| 2.5 | **Karta stanu w Ustawieniach:** skarbiec ustawiony (data), kod awaryjny (jest / brak / sprawdzony), liczba notatek prywatnych, nieodszyfrowywalne (z akcją 1.2), auto-blokada. | 1 | S |

## Etap 3: format i kryptografia (L, po przeglądzie bezpieczeństwa)

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Format `v2`:** `epoch` skarbca w AAD (szyfrogram z innego skarbca albo epoki nie odszyfruje się nawet przy kolizji klucza), metadane notatki (kolor, folder, `parentId`, ikona) w szyfrogramie; w dokumencie zostają tylko: `locked`, `vault`, daty i termin (termin potrzebny do powiadomień bez odblokowania). Odczyt `v1` i `v2`, zapis `v2` po potwierdzeniu wersji urządzeń (Praca 3.1). Wektory testowe w `vault.test.ts`. **Decyzja V-3** (co zostaje jawne). | 2 | L |
| 3.2 | **Odblokowanie biometrią (WebAuthn PRF):** klucz z rozszerzenia PRF passkeya opakowuje klucz danych (drugie opakowanie obok hasła, jak kod awaryjny). Hasło dalej działa. Tylko na urządzeniach z PRF (Android Chrome, iOS 18+ Safari); bez PRF przycisku nie ma. Przegląd bezpieczeństwa obowiązkowy. **Decyzja V-4.** | 2 | L |
| 3.3 | **Szyfrowane obrazy i załączniki:** pliki notatki prywatnej szyfrowane kluczem danych przed zapisem w `imageStore`, kopii i przekaźniku; miniatury tylko po odblokowaniu. Znosi ograniczenie „notatki z plikami nie da się zablokować”. Po 3.1. | 1 | L |

## Etap 4: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Kafel prywatny w 4 stanach:** zablokowana (zamazane linie, kłódka), odszyfrowuję (puls linii, bez przy redukcji ruchu), nieodszyfrowywalna (obwódka `destructive`, akcje z 1.2), brak skarbca na urządzeniu (szara, „Ustaw skarbiec, żeby otworzyć”). | 2 | S |
| 4.2 | **Przejście przy blokadzie:** odszyfrowana treść zamienia się w zamazane linie (krótkie przenikanie), zamiast zniknąć. Przy redukcji ruchu od razu. | 1 | S |
| 4.3 | **Miernik hasła z tokenów** (`destructive-ink`, `warning-ink`, `success-ink`) i opis słowny obok koloru. | 1 | S |
| 4.4 | **Dialogi skarbca w stylu aplikacji:** ikona tarczy, krótkie zdania, przy kodzie awaryjnym karta z kodem w JetBrains Mono w grupach. | 1 | S |

## Etap 5: QA i bezpieczeństwo

- Przegląd bezpieczeństwa całego skarbca przed Etapem 3 i po nim (`/security-review` albo agent `security-reviewer`).
- Testy: dwa dokumenty Yjs — rozjazd, odzysk z 1.2, zmiana hasła na jednym urządzeniu i edycja na drugim; „nic jawnego w dokumencie, IndexedDB i kopii” dla `v1` i `v2`; wektory testowe formatu.
- E2E: ustawienie, blokada, auto-blokada z ostrzeżeniem, kod awaryjny, nieodszyfrowywalna notatka z odzyskiem, notatka prywatna z kompozytora.
- axe: dialogi skarbca, kafel w 4 stanach. Ręcznie na telefonie: menedżer haseł, biometria (jeśli 3.2).

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| V-1 | Minimum hasła 12 znaków (1.4)? | Tak, dla nowych haseł. Stare działają; przy następnej zmianie hasła obowiązuje nowe minimum. |
| V-2 | Menedżer haseł przy odblokowaniu (`current-password`, 1.5)? | Tak. Menedżer haseł to mocniejsze hasło w praktyce; WCAG 3.3.8 tego wymaga. |
| V-3 | Format `v2` (3.1): co zostaje jawne? | Tylko `locked`, `vault`, daty i termin przypomnienia (powiadomienia muszą działać bez odblokowania; tytuł przypomnienia już jest stały). Folder, kolor, ikona i rodzic do szyfrogramu. |
| V-4 | Biometria (3.2)? | Tak, ale jako ostatni punkt, po przeglądzie bezpieczeństwa i tylko z PRF (bez „zapamiętaj hasło w przeglądarce”). |

## Kolejność wdrażania

1. Etap 1: 1.1, 1.2, 1.3, 1.7, 1.6, 1.4 (po V-1), 1.5 (po V-2).
2. Etap 2: 2.1, 2.3, 2.5, 2.4, 2.2.
3. Etap 4 po fundamencie z planu przekrojowego.
4. Przegląd bezpieczeństwa, potem Etap 3: 3.1 (po V-3 i Praca 3.1), 3.3, 3.2 (po V-4).
5. Etap 5 na koniec każdego etapu.

Następny plan w serii: **Ustawienia i synchronizacja**, potem **powłoka** (`plan-dzialy-2026-10-22.md` §0, §13).
