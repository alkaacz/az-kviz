/**
 * Code.gs — AZ Kvíz backend (Google Apps Script)
 *
 * Deploy jako Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Script Properties (File → Project properties → Script properties):
 *   SPREADSHEET_ID   — ID Google Sheetu AZ-Kviz-Data
 *   OAUTH_CLIENT_ID  — OAuth Client ID z Google Cloud Console
 *   ALLOWED_EMAILS   — čárkou oddělené e-maily adminů, např. a@gmail.com,b@skola.cz
 */

// ── Helpers ───────────────────────────────────────────────────────────────

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(data) { return json({ ok: true, data: data }); }
function err(msg) { return json({ ok: false, error: msg }); }

/** Verify Google ID token, return email or null. */
function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    const props = PropertiesService.getScriptProperties();
    const clientId = props.getProperty('OAUTH_CLIENT_ID');
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    const payload = JSON.parse(res.getContentText());
    if (payload.aud !== clientId) return null;
    return payload.email || null;
  } catch (e) {
    return null;
  }
}

/** Check if email is in the whitelist. */
function isAllowed(email) {
  if (!email) return false;
  const props = PropertiesService.getScriptProperties();
  const list = (props.getProperty('ALLOWED_EMAILS') || '').split(',').map(s => s.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

/** Get the spreadsheet. */
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  return SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
}

/** Get sheet by name, create with headers if missing. */
function getSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function generateId() {
  return Utilities.getUuid();
}

// ── Sheet accessors ───────────────────────────────────────────────────────

const QUIZ_HEADERS = ['id', 'name', 'ownerEmail', 'settings', 'createdAt', 'updatedAt'];
const Q_HEADERS    = ['quizId', 'id', 'text', 'imageUrl', 'options', 'correctIndex'];

function quizzesSheet(ss)   { return getSheet(ss, 'quizzes',   QUIZ_HEADERS); }
function questionsSheet(ss) { return getSheet(ss, 'questions', Q_HEADERS);   }

/** Read all rows (skip header) as array of objects. */
function readRows(sheet, headers) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ── Actions ───────────────────────────────────────────────────────────────

function listQuizzes(ss) {
  const quizRows = readRows(quizzesSheet(ss), QUIZ_HEADERS);
  const qRows    = readRows(questionsSheet(ss), Q_HEADERS);

  const countMap = {};
  qRows.forEach(q => { countMap[q.quizId] = (countMap[q.quizId] || 0) + 1; });

  return quizRows.map(q => ({
    id:            q.id,
    name:          q.name,
    ownerEmail:    q.ownerEmail,
    questionCount: countMap[q.id] || 0,
    updatedAt:     q.updatedAt,
  }));
}

function getQuiz(ss, id) {
  const quizRows = readRows(quizzesSheet(ss), QUIZ_HEADERS);
  const quiz = quizRows.find(q => q.id === id);
  if (!quiz) return null;

  const qRows = readRows(questionsSheet(ss), Q_HEADERS)
    .filter(q => q.quizId === id)
    .map(q => ({
      id:           q.id,
      text:         q.text,
      imageUrl:     q.imageUrl || null,
      options:      JSON.parse(q.options),
      correctIndex: Number(q.correctIndex),
    }));

  return {
    id:         quiz.id,
    name:       quiz.name,
    ownerEmail: quiz.ownerEmail,
    createdAt:  quiz.createdAt,
    updatedAt:  quiz.updatedAt,
    settings:   JSON.parse(quiz.settings),
    questions:  qRows,
  };
}

function saveQuiz(ss, payload, email) {
  const now = new Date().toISOString();
  const qSheet     = quizzesSheet(ss);
  const questSheet = questionsSheet(ss);

  const isNew = !payload.id;
  const id = isNew ? generateId() : payload.id;

  if (isNew) {
    qSheet.appendRow([
      id,
      payload.name,
      email,
      JSON.stringify(payload.settings || { timeLimitSec: 0, shuffleAnswers: true }),
      now,
      now,
    ]);
  } else {
    const data = qSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        qSheet.getRange(i + 1, 2).setValue(payload.name);
        qSheet.getRange(i + 1, 4).setValue(JSON.stringify(payload.settings || {}));
        qSheet.getRange(i + 1, 6).setValue(now);
        break;
      }
    }
    // Delete existing questions for this quiz
    const qData = questSheet.getDataRange().getValues();
    for (let i = qData.length - 1; i >= 1; i--) {
      if (qData[i][0] === id) questSheet.deleteRow(i + 1);
    }
  }

  (payload.questions || []).forEach(q => {
    questSheet.appendRow([
      id,
      q.id || generateId(),
      q.text,
      q.imageUrl || '',
      JSON.stringify(q.options),
      q.correctIndex,
    ]);
  });

  return id;
}

function deleteQuiz(ss, id) {
  const qSheet     = quizzesSheet(ss);
  const questSheet = questionsSheet(ss);

  const qData = qSheet.getDataRange().getValues();
  for (let i = qData.length - 1; i >= 1; i--) {
    if (qData[i][0] === id) { qSheet.deleteRow(i + 1); break; }
  }

  const questData = questSheet.getDataRange().getValues();
  for (let i = questData.length - 1; i >= 1; i--) {
    if (questData[i][0] === id) questSheet.deleteRow(i + 1);
  }
}

// ── Router ────────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = getSpreadsheet();

    if (action === 'getQuizForPlay') {
      const quiz = getQuiz(ss, e.parameter.id);
      return quiz ? ok(quiz) : err('Quiz not found');
    }

    const email = verifyIdToken(e.parameter.idToken);
    if (!isAllowed(email)) return err('Unauthorized');

    if (action === 'listQuizzes') return ok(listQuizzes(ss));
    if (action === 'getQuiz')     return ok(getQuiz(ss, e.parameter.id));

    return err('Unknown action');
  } catch (ex) {
    return err(ex.message);
  }
}

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss     = getSpreadsheet();

    const email = verifyIdToken(body.idToken);
    if (!isAllowed(email)) return err('Unauthorized');

    if (action === 'saveQuiz') {
      const id = saveQuiz(ss, body.payload, email);
      return ok({ id });
    }
    if (action === 'deleteQuiz') {
      deleteQuiz(ss, body.payload.id);
      return ok({});
    }

    return err('Unknown action');
  } catch (ex) {
    return err(ex.message);
  }
}
