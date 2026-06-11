# AZ Kviz - realizace architektury

Tento dokument popisuje realne vrstvy reseni, jejich spolupraci a bezpecnostni model v aktualni implementaci.

## 0. Kde je kod (repo map)

- `az-kviz`:
  - hlavni frontend aplikace (Admin FE + Herni FE), staticke soubory pro provoz na GitHub Pages.
  - klicove cesty: `admin.html`, `play.html`, `js/`.
- `az-kviz-gas`:
  - zdrojovy repozitar pro nasazovani backendu do Google Apps Script pres `clasp`.
  - klicove cesty: `src/Code.gs`, `src/appsscript.json`.
- `az-kviz-tests`:
  - Playwright testy (API a pripadne UI), overeni funkce endpointu a regresi.
  - klicove cesty: `tests/`, `config/`, `playwright.config.ts`.

Poznamka: produkcni backend bezi jako nasazeny Google Apps Script Web App; repozitar `az-kviz-gas` je jediny zdroj pravdy pro deployment backendu.

## 1. Vrstvy reseni

- FE vrstva:
  - Admin FE (admin.html + js/auth.js + js/api.js): sprava kvizu, editace, ukladani a mazani.
  - Herni FE (play.html + js/play.js + js/game.js): nacteni kvizu pro hru a samotny gameplay.
- Autentizacni vrstva:
  - Google Identity Services (GIS) pro prihlaseni admina a ziskani ID tokenu.
- BE vrstva:
  - Google Apps Script Web App (doGet, doPost) jako API brana a aplikacni logika.
- Datova vrstva:
  - Google Sheets (quizzes, questions) jako uloziste kvizu a otazek.

## 2. PUML diagram vrstev a spoluprace

Samostatny PUML soubor je zde:

- `docs/diagrams/az-kviz-architecture-dependencies.puml`

## 3. Komunikace mezi vrstvami

### 3.1 Admin tok (autorizovany)

1. Admin FE inicializuje Google Sign-In.
2. Uzivatel se prihlasi Google uctem, FE ziska ID token.
3. FE vola GAS endpointy (listQuizzes, getQuiz, saveQuiz, deleteQuiz) a posila idToken.
4. GAS overi token pres https://oauth2.googleapis.com/tokeninfo.
5. GAS validuje:
   - aud tokenu odpovida OAUTH_CLIENT_ID,
   - email je na whitelistu ALLOWED_EMAILS.
6. Po uspesne autorizaci GAS cte/zapisuje data v Google Sheets.
7. FE dostane JSON odpoved (ok: true) nebo chybu Unauthorized.

### 3.2 Herni tok (verejny)

1. Herni FE vola action=getQuizForPlay&id=<quizId>.
2. GAS vrati kviz pro hru bez admin autentizace.
3. Vyhodnoceni odpovedi a stav hry probiha na klientovi (v browseru ucitele).

## 4. Security model

### 4.1 Co je chranene

- Admin API akce (listQuizzes, getQuiz, saveQuiz, deleteQuiz) jsou chranene dvojitou kontrolou:
  - validita Google ID tokenu,
  - whitelist e-mailu adminu.
- Aktualizace dat v Google Sheets je mozna jen pres autorizovany admin tok.

### 4.2 Co je verejne

- getQuizForPlay je navrzene jako verejny endpoint pro jednoduchou distribuci odkazu na hru.
- Web App je nasazena s pristupem Who has access: Anyone; bezpecnost admin casti je tedy postavena na token + whitelist kontrole v aplikacni logice.

### 4.3 Provozni doporuceni

- Drzet OAUTH_CLIENT_ID, SPREADSHEET_ID, ALLOWED_EMAILS pouze v Script Properties.
- Pravidelne revidovat ALLOWED_EMAILS (odebrat neaktivni ucty).
- Nepublikovat js/config.js s citlivymi hodnotami mimo potrebny rozsah.
- Nepouzivat debug endpoint v produkci dlouhodobe.
- Pouzivat pouze HTTPS URL pro FE i GAS endpoint.
- Po kazdem deployi overit endpoint volanim `action=listQuizzes` bez tokenu.
- Pokud endpoint redirectuje na `accounts.google.com`, deployment nema spravne nastaveny pristup (ma byt `Execute as: Me`, `Who has access: Anyone`).

## 5. Datovy model v ulozisti

- Sheet quizzes:
  - id, name, ownerEmail, settings, createdAt, updatedAt
- Sheet questions:
  - quizId, id, text, imageUrl, options, correctIndex

Model uklada cely kviz jako metadatovou hlavicku + otazky v samostatnych radcich. Operace saveQuiz funguje jako upsert dle id kvizu.

## 6. Limity a vedome kompromisy

- Herni data se vyhodnocuji na klientovi, proto je potreba provozni pravidlo: hraci nemaji pristup k ucitelskemu zarizeni nebo DevTools.
- Public herni endpoint je zjednoduseni UX; neni to model pro vysokou uroven utajeni obsahu otazek.
- Google Sheets je vhodne pro skolu a MVP, ne pro vysokou soubeznost.

## 7. Technicka priloha (slouceno z puvodniho README)

### 7.1 Setup backendu a konfigurace

1. Google Sheet
1. Vytvorte novy Google Sheet s nazvem `AZ-Kviz-Data` na https://sheets.google.com.
1. Zkopirujte Spreadsheet ID z URL.
1. Sheety `quizzes` a `questions` se vytvori automaticky pri prvnim spusteni.

2. Google Apps Script
1. Otevrete https://script.google.com a vytvorte novy projekt.
1. Nahrajte backend kod ze souboru [az-kviz-gas/src/Code.gs](../az-kviz-gas/src/Code.gs).
1. V `Script Properties` nastavte:
- `SPREADSHEET_ID`
- `OAUTH_CLIENT_ID`
- `ALLOWED_EMAILS`
1. Udelejte deployment jako `Web app`:
- Execute as: `Me`
- Who has access: `Anyone`

3. OAuth Client ID
1. V Google Cloud vytvorte `OAuth Client ID` typu `Web application`.
1. Pridejte autorizovane origins pro lokalni beh i produkci (napr. `http://localhost:5500`, `http://localhost:8080`, `https://alkaacz.github.io`).

4. Frontend konfigurace
1. Vyplnte [js/config.js](../js/config.js):
- `OAUTH_CLIENT_ID`
- `API_URL`
- `SPREADSHEET_ID` (referencni)
1. [js/config.js](../js/config.js) je v `.gitignore` a nema se commitovat.

Poznamka: source of truth pro backend je repo `az-kviz-gas`, ne frontend repo.

### 7.2 Lokalni vyvoj

1. Spustte staticky server:
1. `python -m http.server 8080`
1. nebo VS Code Live Server (obvykle port 5500)

2. Otevrete:
1. `http://localhost:5500/play.html` pro hru
1. `http://localhost:5500/admin.html` pro admin

Bez parametru `quizId` se `play.html` nacte z `mock/sample-quiz.json`.

### 7.3 Deploy frontendu (GitHub Pages)

1. Push na `main` branch.
1. V GitHub Settings zapnout Pages: source `main/root`.
1. Produkcni URL: `https://alkaacz.github.io/az-kviz/`.

Herni odkaz pro zaky:
`https://alkaacz.github.io/az-kviz/play.html?quizId=ID-KVIZU`

### 7.4 Troubleshooting

1. OAuth `origin_mismatch`
- Zkontrolovat, ze origin i port odpovida tomu, kde FE bezi.
- Doplneni vsech pouzivanych originu do OAuth klienta.

2. Unauthorized po prihlaseni
- Zkontrolovat `ALLOWED_EMAILS`.
- Zkontrolovat shodu `aud` v tokenu a `OAUTH_CLIENT_ID` v Script Properties.

3. GAS zmeny se neprojevi
- Samotna zmena kodu nestaci, je nutny novy Web App deployment.
- Overit, ze [js/config.js](../js/config.js) ukazuje na aktualni `/exec` URL.

4. CORS/redirect na accounts.google.com
- Deployment neni verejny, opravit na:
- Execute as: `Me`
- Who has access: `Anyone`

5. Pomalost saveQuiz
- Save je upsert a backend pouziva batch zapis.
- U velkych kvizu muze byt beh pomalejsi kvuli operacim nad Google Sheets.

### 7.5 Stav a provozni overeni (snapshot)

K 2026-06-05 bylo overeno:
- funkcni admin flow (login, list, create/edit/save, delete)
- funkcni herni flow (`play.html?quizId=...`)
- API smoke testy v `az-kviz-tests`

Po kazdem deployi retestovat:
- admin login
- list kvizu
- vytvoreni + editace + smazani kvizu
- otevreni herniho odkazu
- nacteni otazek a dohrani hry
