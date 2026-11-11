# Integracja z KSeF — wnioski z badania (2026-11-11)

Źródło: trzy raporty agentów (specyfikacja techniczna API 2.0, dopasowanie do architektury aplikacji, bezpieczeństwo). Fakty z dokumentacji MF zweryfikował agent techniczny (oznaczone [DOK]/[TEST]); raporty o architekturze i bezpieczeństwie opierają się częściowo na pamięci i mają oznaczone punkty „do weryfikacji”. **To jest rozpoznanie, nie decyzja** — przed kodem trzeba odpowiedzieć na pytania z końca dokumentu i zapisać ADR (uchylenie decyzji H-3 „faktur nie ma”).

## 1. Najważniejsze ustalenia

1. **Przeglądarka nie może wołać API KSeF bezpośrednio.** [TEST] Zapytanie z `Origin: https://example.com` na hosty prod/test/demo: preflight `OPTIONS` daje 405, zwykłe `POST /auth/challenge` zwraca 200 **bez** `Access-Control-Allow-Origin`. Więc PWA potrzebuje własnego, cienkiego serwera-pośrednika (albo robi tylko eksport/wizualizację faktury). Wariant „wszystko w przeglądarce” odpada.
2. **Terminy (stan na dziś, [DOK]):** od 1.04.2026 obowiązek dla pozostałych podatników; do końca 2026 r. uproszczenie — faktury poza KSeF wolno wystawiać, gdy miesięczna sprzedaż brutto nie przekracza 10 000 zł. Od 1.01.2027 obowiązek obejmuje także najmniejsze firmy. Kary (art. 106ni) mają działać od 1.01.2027; zapowiedź odroczenia do 2028 to źródła wtórne — **do sprawdzenia w Dz.U.**
3. **Środowiska [DOK]:** TEST `https://api-test.ksef.mf.gov.pl/v2` (dozwolone certyfikaty samopodpisane, losowe NIP-y, limity 10× wyższe), DEMO `https://api-demo.ksef.mf.gov.pl/v2`, PROD `https://api.ksef.mf.gov.pl/v2`. OpenAPI: `https://api.ksef.mf.gov.pl/docs/v2/openapi.json`, dokumentacja: `github.com/CIRFMF/ksef-docs`, schemat FA(3): `https://crd.gov.pl/wzor/2025/06/25/13775/schemat.xsd`.
4. **Uwierzytelnianie:** `POST /auth/challenge` → (XAdES `POST /auth/xades-signature` **albo** token KSeF `POST /auth/ksef-token`, RSA-OAEP SHA-256 na `{token}|{timestampMs}`) → odpytywanie `GET /auth/{ref}` → jednorazowy `POST /auth/token/redeem` → `accessToken` (krótki) + `refreshToken` (do 7 dni). Token KSeF generuje się po zalogowaniu XAdES; pierwszy certyfikat/token wymaga kwalifikowanego podpisu, pieczęci albo Profilu Zaufanego. **Najprostsze dla jednego wykonawcy: token KSeF trzymany po stronie serwera.**
5. **Wysyłka:** sesja interaktywna `POST /sessions/online` (klucz AES-256 + IV, klucz szyfrowany RSA-OAEP publicznym kluczem MF z `/security/public-key-certificates`), `POST .../invoices` (hash SHA-256 w Base64, treść AES-256-CBC), `close`, UPO. Duplikat wykrywany po NIP + rodzaj + numer faktury (P_2), nie po hashu. Limity: faktura 1 MB, ~10 żądań/s i 120/h na wiele endpointów.
6. **Brak oficjalnego klienta JS/TS** (tylko C# i Java). Nieoficjalne pakiety npm (`ksef-client`, `ksef-client-ts`, `@ksefnik/http`) — niezweryfikowane (licencja, aktualność), działają w Node. Trudna część to XAdES; token KSeF go omija.
7. **Tryby offline [DOK]:** offline24 (wybór podatnika; dosłanie do następnego dnia roboczego), offline (ogłoszona niedostępność), awaryjny (do 7 dni roboczych po awarii), awaria całkowita (papier, bez dosłania). Kod QR I na każdej fakturze, kod II (z certyfikatem typu Offline) tylko w trybach offline.
8. **FA(3) dla usługodawcy [DOK + domysły]:** wszystkie pola P_13/P_14 obowiązkowe (zera), `Adnotacje` obowiązkowe; zwolnienie podmiotowe: `P_19=1` + podstawa w `P_19A`, w wierszach `P_12="zw"`; odwrotne obciążenie w usługach budowlanych: `P_18=1`, `P_12="oo"` — **dokładne reguły (GTU, P_13_x) do potwierdzenia w broszurze MF**, to ryzyko poprawności.

## 2. Rekomendowana ścieżka (etapami)

**Etap 0 — decyzje i rozpoznanie (bez kodu produktu).** Odpowiedzi na pytania niżej; ADR uchylający H-3; sprawdzenie na TEST: token vs certyfikat, UPO, FA(3) z odwrotnym obciążeniem; terminy kar w Dz.U.

**Etap 1 — MVP bez sieci (wariant „D”).** Wystawianie faktury z wyceny zlecenia: czysta funkcja generująca XML FA(3) (`src/lib/ksef/fa3.ts`, typowane struktury, escapowanie XML, kwoty w groszach), model faktury w osobnej mapie Yjs `studyInvoices` (pozycje kopiowane z wyceny w chwili wystawienia; faktura po wystawieniu niezmienna, korekta zamiast edycji), numeracja bez kolizji (jedno urządzenie „kasa” albo serie per urządzenie — licznik w Yjs odpada, bo offline daje duplikaty), wizualizacja PDF z kodem QR I, eksport XML do ręcznego wgrania lub do programu księgowego. Dane sprzedawcy (NIP, adres) lokalnie jak `companyPrefs`. Moduł ładowany leniwie (budżet paczki).

**Etap 2 — wysyłka przez własny serwer.** Nowy mały `ksef-server/` (nie rozszerzać `push-server`: inny model zaufania) z tokenem KSeF w sekretach serwera, endpointami „wyślij fakturę / status / UPO”, kolejką dosłania i idempotencją (status po hashu, nie ślepe ponowienia). Aplikacja woła go jak przekaźnik (adres w ustawieniach), `connect-src` bez zmian (`https:` już dozwolone).

**Etap 3 — korekty, powiązanie z wpłatami (`billing.ts`), pobieranie faktur zakupowych, tryby offline24 z kodem QR II.**

**Wariant „C” (zewnętrzna bramka/dostawca)** — tylko jeśli właściciel woli płacić za zgodność zamiast utrzymywać serwer.

## 3. Bezpieczeństwo — twarde zasady

- Token KSeF, klucze prywatne, `accessToken`/`refreshToken`: **nigdy** w Yjs, przekaźniku, kopii zapasowej (`SETTINGS_KEYS` to biała lista — nie dodawać), logach (`logDiag`) ani cache Service Workera. Test regresyjny: kopia nie zawiera wzorca JWT/tokenu.
- Wystawiona faktura = niezmienny XML + SHA-256 + numer KSeF + UPO; źródłem prawdy jest zapisany XML, nie obiekt do renderowania. Status „przyjęta” nie przychodzi z kopii ani od peera bez weryfikacji w KSeF.
- Serializacja XML wyłącznie z własnych struktur, usuwanie znaków niedozwolonych w XML 1.0, odrzucanie `DOCTYPE`/`ENTITY` przy parsowaniu UPO i odpowiedzi; kwoty w groszach, sumy kontrolne, walidacja NIP.
- Środowisko jako enum (`test` domyślnie), baner „ŚRODOWISKO TESTOWE”, osobne magazyny poświadczeń; w testach i e2e wyłącznie dane fikcyjne.
- RODO: minimalizacja pól, kartoteka klientów osobno od faktur, blokada usuwania faktur w okresie retencji, **szyfrowany** eksport faktur (kopia JSON jest dziś jawna, a repo leży w OneDrive), faktury poza share inbox.
- Serwer-pośrednik: stałe adresy MF w kodzie, `redirect: "error"`, `Cache-Control: no-store`, `redact()` w logach, brak danych faktur w logach.

## 4. Punkty styku z kodem

`src/lib/study/jobs.ts` (komentarz „Faktur nie ma (decyzja H-3)” do zmiany), `SiteJobPanel.tsx` (przycisk „Wystaw fakturę” przy statusie „Zrobione”), `billing.ts` (wpłata ↔ faktura), `companyPrefs.ts` (dane sprzedawcy), `pdfWriter.ts`/`jobPdf.ts` (wizualizacja), `exportNotes.ts` (tylko sekcja faktur, szyfrowana), `docs/adr.md` (nowy ADR), `vercel.json`/`netlify.toml` (bez zmian CSP w wariancie z serwerem).

## 5. Pytania do właściciela (potrzebne przed Etapem 1)

1. Czy jesteś **zwolniony z VAT** (art. 113), czy czynnym podatnikiem? Ceny w wycenie netto czy brutto? Jakie stawki (23/8)?
2. Czy wykonujesz **usługi budowlane rozliczane odwrotnym obciążeniem** (dla podwykonawców)? To zmienia FA(3).
3. Czy **jesteś już zobowiązany** (obrót) czy korzystasz z uproszczenia do 10 000 zł/mies. do końca 2026? Od kiedy chcesz być w KSeF?
4. Czy masz **księgową/program księgowy**, do którego mają trafiać faktury (eksport XML/PDF wystarczy na start)?
5. **Ile telefonów wystawia faktury?** (jedna „kasa” czy kilka z seriami)
6. **Token czy certyfikat** KSeF; czy masz już konto w Aplikacji Podatnika i uprawnienia?
7. Czy akceptujesz **utrzymanie małego serwera** (Etap 2), czy wolisz sam eksport XML (Etap 1) / zewnętrznego dostawcę?
8. Czy uchylamy decyzję **H-3** (brak faktur w aplikacji)?

## 6. Co nie jest zweryfikowane

Czy odroczenie kar do 2028 weszło w życie; okresy ważności tokenów; dokładne reguły FA(3) dla odwrotnego obciążenia w budownictwie (GTU); jakość i licencje nieoficjalnych bibliotek npm; limity rozmiaru kodu QR na wizualizacji. Wszystko to do potwierdzenia na środowisku TEST i w broszurze MF przed implementacją.
