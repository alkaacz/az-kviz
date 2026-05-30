# AZ Kvíz

Webová verze populární hry AZ kvíz pro školní použití. Vanilla JS + SVG frontend, Google Apps Script + Sheets backend.

## Setup

### 1. Google Sheet

1. Vytvořte nový Google Sheet s názvem `AZ-Kviz-Data` na [sheets.google.com](https://sheets.google.com)
2. Zkopírujte **Spreadsheet ID** z URL: `https://docs.google.com/spreadsheets/d/**TOTO-JE-ID**/edit`
3. Sheety `quizzes` a `questions` se vytvoří automaticky při prvním spuštění

### 2. Google Apps Script

1. Jděte na [script.google.com](https://script.google.com) → **New project**
2. Nahraďte obsah editoru obsahem souboru `gas/Code.gs`
3. **Project Settings → Script Properties** → přidejte:
   - `SPREADSHEET_ID` = ID vašeho sheetu
   - `OAUTH_CLIENT_ID` = Client ID z Google Cloud Console
   - `ALLOWED_EMAILS` = `vas@gmail.com,ucitelka@skola.cz`
4. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Zkopírujte **Web App URL** (vypadá jako `https://script.google.com/macros/s/.../exec`)

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

Otevřete `http://localhost:8080/play.html` pro hru nebo `http://localhost:8080/admin.html` pro admin.

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
├── gas/Code.gs         # Backend (Google Apps Script)
├── mock/sample-quiz.json
└── zadani.md
```

---

## Checklist před prvním spuštěním

- [ ] Google Sheet vytvořen, Spreadsheet ID zkopírováno
- [ ] GAS projekt vytvořen, `Code.gs` nahráno
- [ ] Script Properties vyplněny (`SPREADSHEET_ID`, `OAUTH_CLIENT_ID`, `ALLOWED_EMAILS`)
- [ ] GAS nasazen jako Web App, URL zkopírována
- [ ] `js/config.js` vyplněn (Client ID + API URL)
- [ ] GitHub Pages aktivovány (pro produkci)
- [ ] OAuth origins obsahují vaši GitHub Pages URL
