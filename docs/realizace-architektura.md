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
