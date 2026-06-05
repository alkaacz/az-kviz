# AZ Kvíz

Webová verze populární hry AZ kvíz pro školní použití. Vanilla JS + SVG frontend, Google Apps Script + Sheets backend.

## Setup

### 1. Google Sheet

1. Vytvořte nový Google Sheet s názvem `AZ-Kviz-Data` na [sheets.google.com](https://sheets.google.com)
2. Zkopírujte **Spreadsheet ID** z URL: `https://docs.google.com/spreadsheets/d/**TOTO-JE-ID**/edit`
3. Sheety `quizzes` a `questions` se vytvoří automaticky při prvním spuštění

### 2. Google Apps Script

1. Jděte na [script.google.com](https://script.google.com) → **New project**
2. Nahraďte obsah editoru obsahem souboru [az-kviz-gas/src/Code.gs](../az-kviz-gas/src/Code.gs)
3. **Project Settings → Script Properties** → přidejte:
   - `SPREADSHEET_ID` = ID vašeho sheetu
   - `OAUTH_CLIENT_ID` = Client ID z Google Cloud Console
   - `ALLOWED_EMAILS` = `vas@gmail.com,ucitelka@skola.cz`
4. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Zkopírujte **Web App URL** (vypadá jako `https://script.google.com/macros/s/.../exec`)

Poznámka: Backend source of truth je v repozitáři [az-kviz-gas/src/Code.gs](../az-kviz-gas/src/Code.gs). V tomto repo už kopie GAS backendu není.

### 3. OAuth Client ID

1. Jděte na [console.cloud.google.com](https://console.cloud.google.com) → váš projekt
2. **APIs & Services → Credentials → + Create Credentials → OAuth Client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:5500` (Live Server)
   - `https://YOUR-USERNAME.github.io`
5. Zkopírujte **Client ID**

### 4. Konfigurace frontendu

Otevřete `js/config.js` a vyplňte:

```js
export const CONFIG = {
  OAUTH_CLIENT_ID: 'vase-client-id.apps.googleusercontent.com',
  API_URL: 'https://script.google.com/macros/s/.../exec',
  SPREADSHEET_ID: 'vas-spreadsheet-id',  // (jen pro referenci, nepoužíváno přímo)
};
```

> ⚠️ `js/config.js` je v `.gitignore` — nikdy ho nepushujte!

---

## Local dev

```bash
# Python
python -m http.server 8080

# nebo VS Code Live Server (port 5500)
```

Otevřete `http://localhost:5500/play.html` pro hru nebo `http://localhost:5500/admin.html` pro admin.

Bez `?quizId=...` se `play.html` načte z `mock/sample-quiz.json` (lokální testování).

---

## Deploy (GitHub Pages)

1. Pushněte na `main` branch
2. **Settings → Pages → Source: main / root**
3. Hra bude dostupná na `https://alkaacz.github.io/az-kviz/`

Herní odkaz pro žáky: `https://alkaacz.github.io/az-kviz/play.html?quizId=ID-KVIZU`

---

## Struktura

```
az-kviz/
├── index.html          # Rozcestník
├── play.html           # Herní obrazovka
├── admin.html          # Admin (správa kvízů)
├── board-test.html     # Testovací stránka hex plánu (M1)
├── css/styles.css
├── js/
│   ├── board.js        # SVG hex plán + detekce výhry
│   ├── game.js         # Herní stav a logika
│   ├── play.js         # UI herní obrazovky
│   ├── admin.js        # (logika v admin.html inline)
│   ├── auth.js         # Google Sign-In (GIS)
│   ├── api.js          # Wrapper nad GAS Web App
│   └── config.js       # ⚠️ NENÍ V GITU — vyplňte lokálně
├── mock/sample-quiz.json
└── zadani.md
```

---

## Checklist před prvním spuštěním

- [ ] Google Sheet vytvořen, Spreadsheet ID zkopírováno
- [ ] GAS projekt vytvořen, [az-kviz-gas/src/Code.gs](../az-kviz-gas/src/Code.gs) nahrán
- [ ] Script Properties vyplněny (`SPREADSHEET_ID`, `OAUTH_CLIENT_ID`, `ALLOWED_EMAILS`)
- [ ] GAS nasazen jako Web App, URL zkopírována
- [ ] `js/config.js` vyplněn (Client ID + API URL)
- [ ] GitHub Pages aktivovány (pro produkci)
- [ ] OAuth origins obsahují vaši GitHub Pages URL

---

## Troubleshooting (OAuth + GAS)

### OAuth login: `origin_mismatch`

Google kontroluje `origin` vcetne portu. Pokud je povolene `http://localhost:5500`, ale aplikace bezi na `http://localhost:8080`, login bude blokovany.

Doporuceni:
- Pridat do OAuth klienta vsechny pouzivane originy (napr. `http://localhost:5500`, `http://localhost:8080`, `https://alkaacz.github.io`).
- Overit, ze `OAUTH_CLIENT_ID` ve [js/config.js](js/config.js) odpovida stejnemu klientovi v Google Cloud.

### `Unauthorized` i kdyz login probehl

Pokud frontend ziska `az_id_token`, ale backend vraci `Unauthorized`, zkontrolujte:
- `ALLOWED_EMAILS` ve Script Properties.
- `OAUTH_CLIENT_ID` ve Script Properties proti `aud` v tokenu.

Pro diagnostiku lze pouzit `action=debug` endpoint na GAS backendu.

### GAS zmeny lokalne vs produkce

Zmena [az-kviz-gas/src/Code.gs](../az-kviz-gas/src/Code.gs) sama o sobe nestaci. Je nutne:
- pushnout kod do Apps Script projektu,
- vytvorit novy Web App deployment,
- zkontrolovat, ze [js/config.js](js/config.js) ukazuje na aktualni `/exec` URL.

Pokud endpoint vraci CORS chybu a v network je redirect na `accounts.google.com`, deployment neni verejny. Opravte v GAS:
- Execute as: `Me`
- Who has access: `Anyone`

### Save kvízu: pomaly beh nebo `400`

Ukladani velkeho kvízu muze byt pomale, pokud backend dela mnoho jednotlivych operaci nad Sheets.

Aktualni implementace:
- klient uklada pres `POST` v [js/api.js](js/api.js),
- backend pouziva batch zapis v [az-kviz-gas/src/Code.gs](../az-kviz-gas/src/Code.gs),
- save je upsert (novy zaznam v `quizzes` se vytvori i pri klientem predgenerovanem `id`).

---

## Stav k 2026-06-05

### Aktuální stav

- Source of truth pro backend je repozitář `az-kviz-gas`.
- Frontend je nakonfigurován na Web App deployment `@16` v [js/config.js](js/config.js).
- Admin flow (login, save quiz, list quiz) funguje bez CORS chyby.
- Herní flow (`play.html`) je ověřený jako funkční.
- API smoke test v `az-kviz-tests` umí fallback načíst URL z [js/config.js](js/config.js).

### Jaká máme repa a k čemu slouží

- `az-kviz`:
   hlavní FE projekt hry (admin + play), lokální vývoj a GitHub Pages.
- `az-kviz-gas`:
   zdrojový repozitář pro backend v Google Apps Script (správa přes `clasp`, push/deploy).
- `az-kviz-tests`:
   Playwright testy (UI + API), logování request/response a běh smoke testů.

### Co retestovat po každém deployi

Admin:
- login admin účtem
- list kvízů
- vytvoření + editace + smazání kvízu

Play:
- otevření `play.html?quizId=...`
- načtení otázek
- dohrání kvízu