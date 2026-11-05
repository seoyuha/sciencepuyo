// 사이언스 뿌요 팡! — 게임 서버
// 3학년 과학 3단원 〈소리의 성질〉 문제를 맞혀 뿌요 한 쌍을 얻고, 같은 색 4개 이상을 이어 없애고, 연쇄로 상대에게 방해 뿌요를 보내는 대전 게임
// 실행: npm install → npm start → 학생 http://localhost:3000   교사 http://localhost:3000/teacher.html
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { UNITS, ALL_UNITS, TYPES, buildQuestions } = require('./questions');
const E = require('./public/engine.js');

const PORT = process.env.PORT || 3000;
const FAST = process.env.FAST === '1'; // 시험용: 대기 시간을 짧게
// 교사 비밀번호: 그랑프리와 같은 비밀번호를 써요 (코드에는 알아볼 수 없는 값만 들어 있어요).
// Render의 Environment에 TEACHER_PASSWORD 를 넣으면 그 값으로 바뀌어요.
const PW_SALT = 'd057941223c441b7d5e80c1f', PW_HASH = 'c16e713ee933471431d0657ac15d0886d387e97319e6ab154de8e6ecb5aee38e';
function checkPw(pw) {
  pw = String(pw || '');
  if (process.env.TEACHER_PASSWORD) return pw === process.env.TEACHER_PASSWORD;
  const a = crypto.scryptSync(pw, PW_SALT, 32), b = Buffer.from(PW_HASH, 'hex');
  return crypto.timingSafeEqual(a, b);
}
const BASE_Q = buildQuestions();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/teacher', (q, res) => res.sendFile(path.join(__dirname, 'public', 'teacher.html')));
app.get('/healthz', (q, res) => res.json({ ok: true, classes: Object.keys(DB.classes).length, matches: matches.size, uptimeMin: Math.round(process.uptime() / 60) }));
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

/* ===================== 저장 ===================== */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const DB = { classes: {}, custom: [], disabled: [], qseq: 0 };
const teacherTokens = new Set();
let saveTimer = null;
function serialize() {
  const classes = {};
  for (const [code, c] of Object.entries(DB.classes)) {
    classes[code] = {
      code, name: c.name, grade: c.grade, createdAt: c.createdAt, settings: c.settings, results: c.results.slice(-3000), wrongCount: c.wrongCount,
      students: Object.fromEntries(Object.values(c.students).map(s => [s.id, { id: s.id, name: s.name, token: s.token, stats: s.stats, joinedAt: s.joinedAt, mastery: s.mastery }])),
    };
  }
  return { version: 1, savedAt: Date.now(), classes, custom: DB.custom, disabled: DB.disabled, qseq: DB.qseq };
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(serialize())); }
    catch (e) { console.error('저장 실패:', e.message); }
  }, 700);
}
function restore(raw) {
  DB.classes = {};
  DB.custom = Array.isArray(raw.custom) ? raw.custom : [];
  DB.disabled = Array.isArray(raw.disabled) ? raw.disabled : [];
  DB.qseq = raw.qseq || DB.custom.length;
  for (const [code, c] of Object.entries(raw.classes || {})) {
    const cl = blankClass(code, c.name, c.grade);
    cl.createdAt = c.createdAt || Date.now();
    cl.settings = Object.assign(defaultSettings(), c.settings || {});
    cl.settings.types = cl.settings.types.filter(t => TYPES[t]); if (!cl.settings.types.length) cl.settings.types = Object.keys(TYPES);
    cl.settings.units = (cl.settings.units || []).filter(u => UNITS[u]); if (!cl.settings.units.length) cl.settings.units = [99];
    cl.results = c.results || []; cl.wrongCount = c.wrongCount || {};
    for (const s of Object.values(c.students || {})) { cl.students[s.id] = newStudentObj(s.id, s.name, s.token, s.stats, s.joinedAt); cl.students[s.id].mastery = s.mastery || {}; }
    DB.classes[code] = cl;
  }
}
function load() {
  try { restore(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); console.log('불러온 반:', Object.values(DB.classes).map(c => c.name).join(', ') || '없음'); }
  catch (e) { /* 처음 실행 */ }
}

/* ===================== 반·학생 ===================== */
function defaultSettings() {
  return { mode: 2, units: [99], types: Object.keys(TYPES), matchMin: 5, colors: 3, easy: true, garbageCap: 12, aiFill: true, review: true, challenge: false };
}
function blankClass(code, name, grade) {
  return { code, name: name || `${code}반`, grade: Number(grade) || 3, createdAt: Date.now(), settings: defaultSettings(), students: {}, results: [], wrongCount: {}, running: false, paused: false, pausedAt: 0 };
}
function blankStats() { return { games: 0, wins: 0, points: 0, first: 0, retry: 0, wrongTries: 0, seen: 0, bestChain: 0, score: 0, sent: 0, chains2: 0, events: 0, bestStreak: 0, aiGames: 0, challengeWins: 0, defenses: 0, ranked: 0 }; }
function newStudentObj(id, name, token, stats, joinedAt) {
  return { id, name, token, stats: Object.assign(blankStats(), stats || {}), joinedAt: joinedAt || Date.now(), online: false, socketId: null, status: 'lobby', matchId: null, waitSince: 0, readyAt: 0, lastOpp: [], mastery: {}, challenge: null };
}
const uid = (n = 8) => crypto.randomBytes(n).toString('hex');
function newCode() { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (DB.classes[c]); return c; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clean = (s, n = 12) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);

/* ===================== 문제 ===================== */
function allQuestions() { return BASE_Q.concat(DB.custom); }
function activeQuestions() { const off = new Set(DB.disabled); return allQuestions().filter(q => !off.has(q.id)); }
function poolFor(settings) {
  const units = new Set(settings.units && settings.units.length ? settings.units : [99]);
  if (units.has(99)) ALL_UNITS.forEach(u => units.add(u)); // 99 = 3단원 전체 (모든 차시)
  const types = new Set(settings.types && settings.types.length ? settings.types : Object.keys(TYPES));
  let pool = activeQuestions().filter(q => units.has(q.unit) && types.has(q.type));
  if (!pool.length) pool = activeQuestions().filter(q => units.has(q.unit));
  if (!pool.length) pool = BASE_Q;
  return pool;
}
// 반복 학습 출제: 낱말·문장(item)마다 학생이 얼마나 익혔는지 기억해 두고,
// 틀렸던 문제은 자주, 처음 보는 문제은 보통, 두 번 이상 첫 시도에 맞힌 문제은 가끔 나와요.
// 같은 문제도 '단어 뜻 → 뜻 보고 단어 → 그림', '문장 뜻 → 뜻 보고 문장 → 문장 조립'처럼 모양을 바꿔 다시 물어요.
function itemWeight(e) {
  if (!e) return 1.5;               // 처음 보는 문제
  if (e.w > 0 && e.c < 2) return 3; // 틀린 적 있고 아직 못 익힌 문제
  if (e.c >= 2) return 0.35;        // 익힌 문제
  return 1;
}
function pickQuestion(m, p) {
  let q = null, review = false;
  // 오답 다시 나오기: 첫 시도에 틀린 문제을 3문제 뒤에 (가능하면 다른 모양으로) 한 번 더
  if (m.settings.review && p.reviewQ.length && p.qCount - p.reviewQ[0].at >= 3) {
    const r = p.reviewQ.shift();
    const orig = allQuestions().find(x => x.id === r.id);
    if (orig) {
      const forms = (m.items.get(orig.item) || []).filter(x => x.id !== orig.id);
      q = forms.length && Math.random() < 0.7 ? forms[Math.floor(Math.random() * forms.length)] : orig;
      review = true;
    }
  }
  if (!q) {
    const ms = p.mastery || {};
    const recent = new Set(p.recentItems);
    let keys = [...m.items.keys()].filter(k => !recent.has(k));
    if (!keys.length) keys = [...m.items.keys()];
    const w = keys.map(k => itemWeight(ms[k]));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < keys.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
    const forms = m.items.get(keys[i]);
    const unseen = forms.filter(x => !p.seen.has(x.id));
    const from = unseen.length ? unseen : forms;
    q = from[Math.floor(Math.random() * from.length)];
  }
  p.seen.add(q.id);
  p.recentItems.push(q.item); if (p.recentItems.length > 6) p.recentItems.shift();
  const golden = !review && p.qCount >= 2 && Math.random() < 0.12; // 🎁 황금 문제
  return present(q, review, golden);
}
function present(q, review, golden) {
  const out = { id: q.id, item: q.item || q.id, unit: q.unit, type: q.type, q: q.q, ask: q.ask, pic: q.pic, img: q.img, review, golden: !!golden };
  if (q.type === 'order') { out.tokens = shuffleNotSame(q.tokens); out.answerKey = q.answer; }
  else { const order = shuffle([0, 1, 2, 3].slice(0, q.choices.length)); out.choices = order.map(i => q.choices[i]); out.answer = order.indexOf(0); }
  out.exp = q.exp || '';
  return out;
}
function shuffleNotSame(tk) { if (tk.length < 2) return tk.slice(); let a; let g = 0; do { a = shuffle(tk.slice()); } while (a.join(' ') === tk.join(' ') && g++ < 10); return a; }
const publicQ = q => Object.assign({ id: q.id, unit: q.unit, type: q.type, q: q.q, ask: q.ask, pic: q.pic, img: q.img, choices: q.choices, tokens: q.tokens, review: q.review, golden: q.golden },
  FAST && process.env.SIM_ANSWERS === '1' ? { _a: q.type === 'order' ? q.answerKey : q.answer } : {}); // 자동 시험에서만 정답을 함께 보내요
function hintFor(q, tries, wrongIdx) {
  if (q.type === 'order') {
    const w = q.answerKey.split(/\s+/);
    return { text: tries >= 2 ? `정답: ${q.answerKey}` : `처음 낱말은 "${w[0]}"${w.length > 3 ? `, 둘째는 "${w[1]}"` : ''}예요.`, lead: tries >= 2 ? w.length : Math.min(2, w.length - 1) };
  }
  const right = q.choices[q.answer];
  const off = q.choices.map((c, i) => i).filter(i => i !== q.answer && (i === wrongIdx || (q.offs || []).includes(i)));
  q.offs = off;
  if (tries >= 2) return { text: `정답은 "${right}"이에요. 눌러 보세요.`, off: q.choices.map((c, i) => i).filter(i => i !== q.answer), show: q.answer };
  if (q.type === 'quiz') {
    // 3학년용: 처음 틀리면 틀린 보기 2개를 지워 둘 중에 고르게, 두 번째에 정답을 알려 줘요
    const wrongs = q.choices.map((c, i) => i).filter(i => i !== q.answer && !off.includes(i));
    while (off.length < 2 && wrongs.length) off.push(wrongs.splice(Math.floor(Math.random() * wrongs.length), 1)[0]);
    q.offs = off;
    return { text: '틀린 보기를 지웠어요. 남은 두 개 중에서 골라 보세요!', off };
  }
  let text = '';
  if (q.type === 'word' || q.type === 'picture') text = `첫 글자는 "${right[0]}"(으)로 시작해요.`;
  else if (q.type === 'meaning') text = '남은 보기 중에서 다시 골라 보세요.';
  else text = q.exp ? `힌트: ${q.exp}` : '다시 한 번 읽어 보세요.';
  return { text, off };
}

/* ===================== 경기 ===================== */
// AI 난이도 — 1인용(AI)에서는 학생이 고르고, 2인·3인전에서 짝 대신 들어오는 AI는 반 설정(쉬운 모드면 쉬움, 아니면 보통)을 따라요
// curse: 안개·뒤죽박죽 사용 · solve: AI가 문제를 푸는 시간(최소, 더하는 폭) · right: AI 첫 시도 정답률 · skill: 뿌요 쌓는 실력 배율
// colors: 뿌요 색 수(null이면 반 설정) · win: 1인용에서 이겼을 때 순위 점수 (어려울수록 더 많이)
const LEVELS = {
  easy: { name: '쉬움', icon: '🐣', curse: false, solve: [7000, 8000], right: 0.6, skill: 0.6, place: [1600, 1200], colors: 3, win: 14 },
  normal: { name: '보통', icon: '🙂', curse: true, solve: [5000, 7000], right: 0.68, skill: 1, place: [900, 1200], colors: null, win: 20 },
  hard: { name: '어려움', icon: '🔥', curse: true, solve: [3000, 4000], right: 0.82, skill: 1.3, place: [450, 600], colors: 4, win: 26 },
};
const matches = new Map();
const BOT_NAMES = ['🤖 AI 말랑', '🤖 AI 몽글', '🤖 AI 탱글', '🤖 AI 쫀득', '🤖 AI 폭신'];
// 순위 점수: 1등 20점, 2등 8점(3인전), 2인전 2등·3인전 3등 3점. AI와의 경기도 똑같이 점수에 들어가요.
function placePoints(rank, n) { return rank === 1 ? 20 : (n === 3 && rank === 2) ? 8 : 3; }

function createMatch(c, humans, botCount, opts = {}) {
  const id = uid(5);
  const settings = Object.assign({}, c.settings, opts.practice ? { mode: 2 } : {});
  const solo = !opts.practice && settings.mode === 1;
  const level = LEVELS[opts.level] ? opts.level : settings.easy ? 'easy' : 'normal';
  if (solo) { const L = LEVELS[level]; if (L.colors === 3) settings.colors = 3; if (L.colors === 4) settings.colors = Math.max(4, settings.colors); }
  const m = {
    id, code: c.code, practice: !!opts.practice, settings, pool: poolFor(settings), state: 'countdown', createdAt: Date.now(),
    startAt: Date.now() + (FAST ? 300 : opts.ranked ? 5000 : 3000), durMs: (opts.practice ? 3 : settings.matchMin || 30) * (FAST ? 6000 : 60000), pausedLeft: null, death: !opts.practice && settings.matchMin === 0,
    seq: E.pairSeq(Math.floor(Math.random() * 1e9), settings.colors, 600), players: [], deadOrder: [], timers: new Set(), log: [],
    items: new Map(), fever: false, sprint: false, ranked: opts.ranked || null, solo, level,
  };
  for (const q of m.pool) { const k = q.item || q.id; if (!m.items.has(k)) m.items.set(k, []); m.items.get(k).push(q); }
  // ⭐ 피버 타임: 경기 35~55% 지점에서 30초 동안
  m.feverAt = m.death ? (FAST ? 2000 : 90000) : Math.round(m.durMs * (0.35 + Math.random() * 0.2)); m.feverDur = FAST ? 3000 : 30000;
  const mk = (pid, name, isBot) => ({
    pid, name, isBot, board: E.toStr(E.empty()), score: 0, alive: true, pending: 0, target: null, stars: 0, streak: 0,
    phase: 'wait', q: null, tries: 0, pairIdx: 0, pair: null, seen: new Set(), reviewQ: [], qCount: 0,
    st: { first: 0, retry: 0, wrongTries: 0, seen: 0, maxChain: 0, sent: 0, chains2: 0, events: 0, bestStreak: 0 }, wrongs: [], rank: 0, skill: 0.55 + Math.random() * 0.3,
    recentItems: [], mastery: null, curse: { fog: 0, reverse: 0 }, learned: [], practiced: new Set(), comebackAt: -9,
  });
  humans.forEach(s => { const p = mk(s.id, s.name, false); p.mastery = opts.practice ? {} : (s.mastery = s.mastery || {}); m.players.push(p); });
  const used = new Set();
  for (let i = 0; i < botCount; i++) { let n; do { n = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]; } while (used.has(n)); used.add(n); m.players.push(mk('bot-' + uid(3), n, true)); }
  shuffle(m.players);
  // 처음 공격 대상: 3인전은 시계 방향 다음 사람
  m.players.forEach((p, i) => { p.target = m.players[(i + 1) % m.players.length].pid; });
  matches.set(id, m);
  for (const s of humans) {
    if (s.matchId && s.matchId !== id) leaveMatch(c, s, true);
    s.status = 'playing'; s.matchId = id; s.waitSince = 0;
    s.lastOpp = m.players.filter(p => p.pid !== s.id && !p.isBot).map(p => p.pid);
  }
  later(m, () => startMatch(m), m.startAt - Date.now());
  pushMatch(m); pushClass(c);
  return m;
}
function later(m, fn, ms) { const t = setTimeout(() => { m.timers.delete(t); fn(); }, Math.max(0, ms)); m.timers.add(t); return t; }
function clsOf(m) { return DB.classes[m.code]; }
function playerSock(m, p) { const c = clsOf(m); const s = c && c.students[p.pid]; return s && s.online && s.matchId === m.id ? s.socketId : null; }

function startMatch(m) {
  if (m.state !== 'countdown') return;
  m.state = 'playing'; m.startAt = Date.now(); m.endAt = Date.now() + m.durMs;
  m.endTimer = later(m, () => endMatch(m, 'time'), m.durMs);
  for (const p of m.players) nextQuestion(m, p);
  pushMatch(m);
}
function remaining(m) { if (m.pausedLeft != null) return m.pausedLeft; if (m.state === 'countdown') return m.durMs; return Math.max(0, (m.endAt || 0) - Date.now()); }

function nextQuestion(m, p) {
  if (!p.alive || m.state !== 'playing') return;
  p.q = pickQuestion(m, p); p.tries = 0; p.phase = 'question'; p.qCount++; p.st.seen++; p.qAt = Date.now();
  const sid = playerSock(m, p);
  if (sid) io.to(sid).emit('m:q', publicQ(p.q));
  if (p.isBot) botThink(m, p);
}

function answer(m, p, ans) {
  if (m.state !== 'playing' || !p.alive || p.phase !== 'question' || !p.q) return { err: '지금은 답할 수 없어요.' };
  if (clsOf(m) && clsOf(m).paused && !m.practice) return { err: '선생님이 잠시 멈췄어요.' };
  const q = p.q;
  const ok = q.type === 'order' ? norm(ans) === norm(q.answerKey) : Number(ans) === q.answer;
  if (!ok) {
    p.tries++; p.st.wrongTries++; p.streak = 0;
    if (p.tries === 1) {
      if (!p.wrongs.some(w => w.id === q.id)) p.wrongs.push({ id: q.id, unit: q.unit, q: q.q || '', pic: q.pic, img: q.img, ask: q.ask, answer: q.type === 'order' ? q.answerKey : q.choices[q.answer], exp: q.exp, type: q.type, choices: q.choices, ans: q.answer, pick: q.type === 'order' ? -1 : Number(ans), tried: q.type === 'order' ? String(ans) : '' });
      if (!q.review) p.reviewQ.push({ id: q.id, at: p.qCount });
      if (p.mastery) { const e = p.mastery[q.item || q.id] = p.mastery[q.item || q.id] || { c: 0, w: 0 }; e.w++; }
      if (!m.practice) { const c = clsOf(m); if (c) { c.wrongCount[q.id] = (c.wrongCount[q.id] || 0) + 1; } }
    }
    const idx = q.type === 'order' ? -1 : Number(ans);
    return { ok: false, hint: hintFor(q, p.tries, idx) };
  }
  const first = p.tries === 0;
  const fx = [];
  if (first) {
    p.st.first++; p.streak++; p.st.bestStreak = Math.max(p.st.bestStreak, p.streak);
    p.stars += m.fever ? 2 : 1; // 피버 타임에는 별 2개
  } else { p.st.retry++; p.streak = 0; }
  // 반복 학습 기록
  const key = q.item || q.id; p.practiced.add(key);
  if (p.mastery) {
    const e = p.mastery[key] = p.mastery[key] || { c: 0, w: 0 };
    if (first) { e.c++; if (e.c === 2) p.learned.push(q.type === 'quiz' ? q.choices[q.answer] : (q.exp || key)); }
  }
  // 🎁 황금 문제: 첫 시도에 맞히면 별 +2, 상대에게 방해 젤리 3개
  if (first && q.golden) {
    p.stars += 2; const t = targetOf(m, p);
    if (t) { t.pending += 3; p.st.sent += 3; }
    fx.push({ kind: 'golden', from: p.name, fromPid: p.pid, to: t && t.name, toPid: t && t.pid });
  }
  if (first) streakEvent(m, p, fx);
  // 🆘 역전 찬스: 판이 9줄 넘게 찼을 때 정답을 맞히면 방해 젤리 6개가 사라져요 (4문제에 한 번)
  let board = null;
  const b = E.fromStr(p.board);
  if (E.stackHeight(b) >= 9 && p.qCount - p.comebackAt >= 4) {
    p.comebackAt = p.qCount;
    const r = E.clearGarbage(b, 6); let gone = r.removed;
    const fromPend = Math.min(p.pending, 6 - gone); p.pending -= fromPend; gone += fromPend;
    if (gone > 0) { p.board = E.toStr(r.board); board = p.board; fx.push({ kind: 'comeback', from: p.name, fromPid: p.pid, n: gone }); }
  }
  for (const e of fx) broadcastFx(m, Object.assign({ type: 'event' }, e));
  // 친구가 보낸 안개·뒤죽박죽은 이번에 받는 젤리에 걸려요
  const fog = p.curse.fog > 0, reverse = p.curse.reverse > 0;
  p.curse.fog = 0; p.curse.reverse = 0;
  p.pair = m.seq[p.pairIdx % m.seq.length]; p.pairIdx++;
  p.phase = 'place';
  const preview = p.streak >= 3 ? 2 : 1;
  const next = []; for (let i = 0; i < preview; i++) next.push(m.seq[(p.pairIdx + i) % m.seq.length]);
  pushMatch(m);
  return { ok: true, first, golden: !!q.golden, exp: q.exp, answer: q.type === 'order' ? q.answerKey : q.choices[q.answer], pair: p.pair, next, stars: p.stars, streak: p.streak, fog, reverse, board, fever: m.fever };
}

// 🔥 연속 정답 이벤트 (첫 시도에 연달아 맞힐 때, 공격 대상에게)
// 3연속 💨 안개: 상대의 다음 젤리 미리보기·떨어질 자리·판 윗부분이 가려져요
// 5연속 🌀 뒤죽박죽: 상대의 다음 젤리를 옮길 때 ◀▶가 반대로 움직여요
// 7연속 💣 방해 폭탄: 상대에게 방해 젤리 6개(한 줄)
// 10연속부터 3문제마다 👑 과학왕: 상대에게 방해 젤리 12개 + 내게 오던 방해 젤리 모두 없애기
// 3연속 이상 맞히고 있는 친구는 🛡️ 방어막으로 안개·뒤죽박죽을 막아요
const STREAK_EVENTS = { 3: 'fog', 5: 'reverse', 7: 'bomb' };
function streakEvent(m, p, fx) {
  const n = p.streak;
  const kind = STREAK_EVENTS[n] || (n >= 10 && (n - 10) % 3 === 0 ? 'king' : null);
  if (!kind) return;
  // 3학년 쉬운 모드: 안개·뒤죽박죽(조작을 헷갈리게 하는 방해)은 쓰지 않아요
  if (!LEVELS[m.level].curse && (kind === 'fog' || kind === 'reverse')) return;
  const t = targetOf(m, p); if (!t) return;
  p.st.events++;
  const base = { from: p.name, fromPid: p.pid, to: t.name, toPid: t.pid, streak: n };
  if ((kind === 'fog' || kind === 'reverse') && t.streak >= 3) { fx.push(Object.assign({ kind: 'shield', blocked: kind }, base)); return; }
  if (kind === 'fog') t.curse.fog = 1;
  if (kind === 'reverse') t.curse.reverse = 1;
  if (kind === 'bomb') { t.pending += 6; p.st.sent += 6; }
  if (kind === 'king') { t.pending += 12; p.st.sent += 12; base.cleared = p.pending; p.pending = 0; }
  fx.push(Object.assign({ kind }, base));
}
function remainingPlay(m) { return m.state === 'playing' ? remaining(m) : m.durMs; }
// 피버 타임·막판 스퍼트 켜고 끄기 (일시정지 중에는 시간이 멈춰 있어요)
function eventTick(m) {
  if (m.state !== 'playing') return;
  const left = remainingPlay(m), elapsed = m.durMs - left;
  const fever = elapsed >= m.feverAt && elapsed < m.feverAt + m.feverDur;
  // 데스매치는 5분이 지나면 공격 2배로 끝을 앞당겨요
  const sprint = m.death ? elapsed >= (FAST ? 6000 : 300000) : left <= Math.min(FAST ? 3000 : 60000, m.durMs * 0.25);
  if (fever !== m.fever) { m.fever = fever; broadcastFx(m, { type: 'event', kind: fever ? 'feverOn' : 'feverOff' }); }
  if (sprint !== m.sprint) { m.sprint = sprint; if (sprint) broadcastFx(m, { type: 'event', kind: 'sprint' }); }
}
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();

// 학생이 뿌요를 놓고 연쇄가 끝난 결과를 보내요
function placed(m, p, data) {
  if (m.state !== 'playing' || !p.alive || p.phase !== 'place') return { err: '지금은 놓을 수 없어요.' };
  const chain = Math.max(0, Math.min(19, Number(data.chain) || 0));
  const cleared = Math.max(0, Number(data.cleared) || 0);
  p.score += Math.max(0, Math.min(500000, Number(data.score) || 0));
  if (typeof data.board === 'string' && /^[0-6]{72}$/.test(data.board)) p.board = data.board;
  p.st.maxChain = Math.max(p.st.maxChain, chain);
  if (chain >= 2) p.st.chains2++;
  let atk = E.attackFor(chain, Math.max(0, cleared - chain * 4));
  if (atk > 0) atk = Math.ceil(atk * (m.sprint ? 2 : m.fever ? 1.5 : 1)); // ⚡ 막판 스퍼트 2배 · ⭐ 피버 1.5배
  // 상쇄: 내게 오고 있던 방해 뿌요부터 지워요
  let offset = 0;
  if (atk > 0 && p.pending > 0) { offset = Math.min(atk, p.pending); p.pending -= offset; atk -= offset; }
  let sentTo = null;
  if (atk > 0) {
    const t = targetOf(m, p);
    if (t) { t.pending += atk; p.st.sent += atk; sentTo = t.pid; notify(m, t, { type: 'incoming', from: p.name, n: atk }); }
  }
  // 내 연쇄가 끝난 뒤, 대기 중이던 방해 뿌요가 떨어져요 (한 번에 최대 garbageCap개)
  const drop = Math.min(p.pending, m.settings.garbageCap);
  p.pending -= drop;
  p.phase = 'settle';
  if (chain >= 2) broadcastFx(m, { type: 'chain', pid: p.pid, chain, atk, offset, to: sentTo });
  pushMatch(m);
  return { ok: true, garbage: drop, attack: atk, offset, to: sentTo };
}
function settled(m, p, data) {
  if (m.state !== 'playing' || !p.alive || p.phase !== 'settle') return { err: 'no' };
  if (typeof data.board === 'string' && /^[0-6]{72}$/.test(data.board)) p.board = data.board;
  if (data.dead || E.isDead(E.fromStr(p.board))) { knockOut(m, p); return { ok: true, dead: true }; }
  nextQuestion(m, p); pushMatch(m);
  return { ok: true };
}
function useItem(m, p, kind, data) {
  if (m.state !== 'playing' || !p.alive) return { err: '지금은 쓸 수 없어요.' };
  if (kind === 'color') {
    if (p.phase !== 'place' || p.stars < 2) return { err: '별 2개가 필요해요.' };
    const a = Math.max(1, Math.min(m.settings.colors, Number(data.a) || 1)), b = Math.max(1, Math.min(m.settings.colors, Number(data.b) || 1));
    p.stars -= 2; p.pair = [a, b]; pushMatch(m); return { ok: true, pair: p.pair, stars: p.stars };
  }
  if (kind === 'clear') {
    if (p.phase !== 'place' && p.phase !== 'question') return { err: '지금은 쓸 수 없어요.' };
    if (p.stars < 3) return { err: '별 3개가 필요해요.' };
    const r = E.clearGarbage(E.fromStr(p.board), 6);
    if (!r.removed && p.pending <= 0) return { err: '없앨 방해 뿌요가 없어요.' };
    p.stars -= 3;
    const fromPending = r.removed < 6 ? Math.min(p.pending, 6 - r.removed) : 0; p.pending -= fromPending;
    p.board = E.toStr(r.board); pushMatch(m);
    return { ok: true, board: p.board, removed: r.removed + fromPending, stars: p.stars };
  }
  return { err: '알 수 없는 아이템' };
}
function targetOf(m, p) {
  let t = m.players.find(x => x.pid === p.target && x.alive && x.pid !== p.pid);
  if (!t) { t = m.players.filter(x => x.alive && x.pid !== p.pid).sort((a, b) => E.countCells(E.fromStr(a.board)) - E.countCells(E.fromStr(b.board)))[0]; if (t) p.target = t.pid; }
  return t;
}
function knockOut(m, p) {
  if (!p.alive) return;
  p.alive = false; p.phase = 'out'; m.deadOrder.push(p.pid);
  broadcastFx(m, { type: 'ko', pid: p.pid, name: p.name });
  const alive = m.players.filter(x => x.alive);
  for (const x of alive) if (x.target === p.pid) targetOf(m, Object.assign(x, { target: null }));
  if (alive.length <= 1) endMatch(m, 'ko');
  else pushMatch(m);
}

function endMatch(m, why) {
  if (m.state === 'ended') return;
  m.state = 'ended'; m.endedAt = Date.now(); m.why = why;
  for (const t of m.timers) clearTimeout(t); m.timers.clear();
  // 순위: 살아남은 사람(게임 점수 순) → 늦게 떨어진 사람 순
  const alive = m.players.filter(p => p.alive).sort((a, b) => b.score - a.score);
  const dead = m.deadOrder.slice().reverse().map(pid => m.players.find(p => p.pid === pid));
  [...alive, ...dead].forEach((p, i) => { p.rank = i + 1; });
  const c = clsOf(m);
  const humans = m.players.filter(p => !p.isBot);
  const vsAI = m.players.some(p => p.isBot);
  if (c && !m.practice) {
    for (const p of humans) {
      const s = c.students[p.pid]; if (!s) continue;
      let bonus = 0;
      if (m.ranked) { // 랭킹전: 도전 성공 +10 · 방어 성공 +5
        if (p.pid === m.ranked.challenger && p.rank === 1) { bonus = 10; s.stats.challengeWins++; }
        if (p.pid === m.ranked.defender && p.rank === 1) { bonus = 5; s.stats.defenses++; }
        s.stats.ranked++;
      }
      const pts = p.st.first * 3 + p.st.retry + (m.solo && p.rank === 1 ? LEVELS[m.level].win : placePoints(p.rank, m.players.length)) + bonus;
      p.points = pts; p.bonus = bonus;
      const S = s.stats;
      S.games++; if (p.rank === 1) S.wins++; S.points += pts; S.first += p.st.first; S.retry += p.st.retry; S.wrongTries += p.st.wrongTries;
      S.seen += p.st.seen; S.bestChain = Math.max(S.bestChain, p.st.maxChain); S.score += p.score; S.sent += p.st.sent; S.chains2 += p.st.chains2;
      S.events += p.st.events; S.bestStreak = Math.max(S.bestStreak, p.st.bestStreak); if (vsAI) S.aiGames++;
      c.results.push({
        at: Date.now(), match: m.id, sid: s.id, name: s.name, mode: m.solo ? 1 : m.players.length, rank: p.rank, vsAI, points: pts, score: p.score,
        maxChain: p.st.maxChain, first: p.st.first, retry: p.st.retry, wrongTries: p.st.wrongTries, seen: p.st.seen, sent: p.st.sent, bestStreak: p.st.bestStreak, events: p.st.events, learned: p.learned.length,
        ranked: m.ranked ? (p.pid === m.ranked.challenger ? '도전' : '방어') : '', bonus, level: m.solo ? LEVELS[m.level].name : '',
        units: m.settings.units.map(u => u === 99 ? '전체' : u + '차시').join('·'), opp: m.players.filter(x => x.pid !== p.pid).map(x => x.name).join(', '),
      });
    }
    save();
  }
  pushMatch(m);
  for (const p of humans) {
    const sid = playerSock(m, p);
    if (sid) io.to(sid).emit('m:end', resultView(m, p));
  }
  // 경기가 끝나면 결과·오답 복습을 보며 기다리다가 자동으로 다음 상대와 붙어요 (4초 뒤부터 짝짓기, 8초가 지나도 짝이 없으면 AI)
  if (c) for (const p of humans) {
    const s = c.students[p.pid]; if (!s || s.matchId !== m.id) continue;
    if (c.running && !m.practice) { s.status = 'waiting'; s.matchId = null; s.waitSince = Date.now(); s.readyAt = Date.now() + (FAST ? 200 : 4000); }
    else { s.status = 'result'; }
  }
  if (c) pushClass(c);
  setTimeout(() => matches.delete(m.id), 10 * 60000);
}
function resultView(m, p) {
  const c = clsOf(m);
  return {
    practice: m.practice, why: m.why, rank: p.rank, of: m.players.length, points: p.points || 0, bonus: p.bonus || 0,
    ranked: m.ranked ? { role: p.pid === m.ranked.challenger ? 'challenger' : 'defender', cName: m.ranked.cName, dName: m.ranked.dName, cPos: m.ranked.cPos, dPos: m.ranked.dPos } : null, score: p.score, st: p.st,
    wrongs: p.wrongs.slice(0, 12), learned: p.learned.slice(0, 20), practiced: p.practiced.size, running: !!(c && c.running), table: m.players.slice().sort((a, b) => a.rank - b.rank).map(x => ({ name: x.name, rank: x.rank, score: x.score, maxChain: x.st.maxChain, bot: x.isBot, me: x.pid === p.pid })),
    myRank: c && !m.practice ? myRanks(c, p.pid) : null,
  };
}
function leaveMatch(c, s, silent) {
  const m = matches.get(s.matchId); if (!m) return;
  const p = m.players.find(x => x.pid === s.id);
  if (m.practice) { m.state = 'ended'; for (const t of m.timers) clearTimeout(t); matches.delete(m.id); return; }
  if (p && p.alive && m.state !== 'ended') knockOut(m, p);
}

/* ===================== AI 상대 ===================== */
function botThink(m, p) {
  const c = clsOf(m);
  const L = LEVELS[m.level];
  const solve = (FAST ? 300 : L.solve[0]) + Math.random() * (FAST ? 400 : L.solve[1]); // 난이도에 따라 문제 푸는 시간
  later(m, () => {
    if (!p.alive || p.phase !== 'question' || m.state !== 'playing') return;
    if (c && c.paused && !m.practice) return botThink(m, p);
    const right = Math.random() < L.right;
    let r = answer(m, p, right ? (p.q.type === 'order' ? p.q.answerKey : p.q.answer) : (p.q.type === 'order' ? 'x' : (p.q.answer + 1) % 4));
    if (!r.ok) { later(m, () => { if (p.phase === 'question') { answer(m, p, p.q.type === 'order' ? p.q.answerKey : p.q.answer); botPlace(m, p); } }, FAST ? 200 : 2500); return; }
    botPlace(m, p);
  }, solve);
}
function botPlace(m, p) {
  later(m, () => {
    if (!p.alive || p.phase !== 'place' || m.state !== 'playing') return;
    const b = E.fromStr(p.board);
    const mv = E.bestMove(b, { a: p.pair[0], b: p.pair[1], col: 2, rot: 0 }, Math.min(0.98, p.skill * LEVELS[m.level].skill));
    const d = E.drop(b, mv); const res = E.resolve(d.board);
    const r = placed(m, p, { board: E.toStr(res.board), chain: res.chain, cleared: res.cleared, score: res.score });
    let nb = res.board;
    if (r.garbage) nb = E.addGarbage(nb, r.garbage);
    later(m, () => settled(m, p, { board: E.toStr(nb), dead: E.isDead(nb) || d.cells.some(x => x.r < 0) }), FAST ? 50 : 300 + res.chain * 700);
  }, FAST ? 100 : LEVELS[m.level].place[0] + Math.random() * LEVELS[m.level].place[1]);
}

/* ===================== 자동 매칭 ===================== */
// 선생님이 시작하면: 기다리는 학생을 2명(또는 3명)씩 자동으로 묶고, 같은 상대와 연달아 붙지 않게 해요.
// 짝이 맞지 않아 남은 학생은 경기가 끝난(들어온) 뒤 8초가 지나면 AI와 대결해요. AI전도 랭킹 점수에 들어가요.
// 랭킹전에서 아무도 고르지 않은 학생은 이 시간이 지나면 자동으로 상대가 정해져요
const RANK_WAIT = FAST ? 1500 : 20000;
const rankMode = c => !!(c.settings.challenge && c.settings.mode === 2);
// 랭킹전 사다리: 점수 → 정답률 → 경기 수 → 먼저 들어온 순서로 한 줄 세우기 (같은 순위 없음)
function ladder(c) {
  return Object.values(c.students).slice().sort((a, b) => b.stats.points - a.stats.points || acc(b.stats) - acc(a.stats) || b.stats.games - a.stats.games || a.joinedAt - b.joinedAt);
}
function ladderPos(c) { const m = new Map(); ladder(c).forEach((s, i) => m.set(s.id, i + 1)); return m; }
function canChallenge(c, s, t, pos) {
  if (!rankMode(c) || !s || !t || s.id === t.id || !t.online) return false;
  pos = pos || ladderPos(c);
  return pos.get(t.id) < pos.get(s.id);
}
function pairUp(c, list, used, n, aiAfter) {
  let made = false;
  for (const s of list) {
    if (used.has(s.id)) continue;
    const rest = list.filter(x => !used.has(x.id) && x.id !== s.id);
    if (rest.length < n - 1) break;
    // 지난 경기 상대가 아닌 학생을 먼저 골라요
    const fresh = rest.filter(x => !s.lastOpp.includes(x.id) && !x.lastOpp.includes(s.id));
    const pick = fresh.concat(rest.filter(x => !fresh.includes(x))).slice(0, n - 1);
    // 혼자 남는 학생이 다른 사람과 바로 붙을 수 있는데 지난 상대만 남았다면 3초는 기다려 봐요
    if (!fresh.length && rest.length === n - 1 && Date.now() - s.waitSince < 3000 && list.length > n) continue;
    [s, ...pick].forEach(x => used.add(x.id));
    createMatch(c, [s, ...pick], 0); made = true;
  }
  if (c.settings.aiFill) {
    const left = list.filter(x => !used.has(x.id));
    if (left.length && left.length < n && Date.now() - left[0].waitSince >= aiAfter) { left.forEach(x => used.add(x.id)); createMatch(c, left, n - left.length); made = true; }
  }
  return made;
}
function matchmake(c) {
  if (!c.running || c.paused) return;
  const n = c.settings.mode === 3 ? 3 : 2;
  const now = Date.now();
  const waiting = Object.values(c.students).filter(s => s.online && (s.status === 'waiting' || s.status === 'practice') && (s.readyAt || 0) <= now).sort((a, b) => a.waitSince - b.waitSince);
  const used = new Set();
  let made = false;
  if (c.settings.mode === 1) { // 1인용: 난이도를 고른 학생마다 바로 AI와 1:1
    for (const s of waiting) if (s.level) { createMatch(c, [s], 1, { level: s.level }); made = true; }
  } else if (rankMode(c)) {
    const pos = ladderPos(c);
    // ① 도전: 도전한 학생과 도전받은 학생이 둘 다 기다리는 중이면 바로 대결
    const chal = Object.values(c.students).filter(s => s.challenge).sort((a, b) => a.challenge.at - b.challenge.at);
    for (const s of chal) {
      const t = c.students[s.challenge.target];
      if (!s.online || !canChallenge(c, s, t, pos)) { s.challenge = null; made = true; continue; }
      if (used.has(s.id) || used.has(t.id) || !waiting.includes(s) || !waiting.includes(t)) continue;
      used.add(s.id); used.add(t.id);
      const ranked = { challenger: s.id, defender: t.id, cName: s.name, dName: t.name, cPos: pos.get(s.id), dPos: pos.get(t.id) };
      s.challenge = null; if (t.challenge) t.challenge = null;
      createMatch(c, [s, t], 0, { ranked }); made = true;
      feed(c, `${ranked.cPos}위 ${s.name} ⚔ ${ranked.dPos}위 ${t.name} 랭킹전 시작!`);
    }
    // ② 고르지 않은 학생: 기다린 지 20초가 지나면 자동으로 짝 (도전 신청 중인 학생은 기다려요)
    const free = waiting.filter(x => !used.has(x.id) && !x.challenge && now - x.waitSince >= RANK_WAIT);
    if (pairUp(c, free, used, 2, FAST ? 300 : 3000)) made = true;
  } else if (pairUp(c, waiting, used, n, FAST ? 600 : 8000)) made = true;
  if (made) pushClass(c);
}
function feed(c, text) { for (const s of Object.values(c.students)) if (s.online && s.socketId) io.to(s.socketId).emit('feed', text); }
setInterval(() => { for (const c of Object.values(DB.classes)) matchmake(c); }, FAST ? 200 : 1000);

/* ===================== 랭킹 ===================== */
const acc = S => S.seen ? Math.round(S.first / S.seen * 100) : 0;
function studentRow(c, s) {
  const S = s.stats;
  return { id: s.id, name: s.name, cls: c.name, code: c.code, points: S.points, games: S.games, wins: S.wins, acc: acc(S), first: S.first, retry: S.retry, seen: S.seen, bestChain: S.bestChain, sent: S.sent, score: S.score, online: s.online, status: s.status, bestStreak: S.bestStreak, events: S.events, aiGames: S.aiGames, challengeWins: S.challengeWins || 0, defenses: S.defenses || 0,
    mastered: Object.values(s.mastery || {}).filter(e => e.c >= 2).length, practiced: Object.keys(s.mastery || {}).length };
}
const SORTS = { points: (a, b) => b.points - a.points || b.acc - a.acc, acc: (a, b) => b.acc - a.acc || b.seen - a.seen, chain: (a, b) => b.bestChain - a.bestChain || b.points - a.points };
function rankRows(rows, by) { rows = rows.slice().sort(SORTS[by] || SORTS.points); let prev = null, r = 0; rows.forEach((x, i) => { const k = by === 'acc' ? x.acc : by === 'chain' ? x.bestChain : x.points; if (k !== prev) r = i + 1; x.rank = r; prev = k; }); return rows; }
function titles(rows) {
  const t = {};
  const give = (key, label, icon, pick) => { const p = rows.filter(pick.ok).sort(pick.cmp)[0]; if (p) (t[p.id] = t[p.id] || []).push({ key, label, icon }); };
  give('chain', '연쇄왕', '🔗', { ok: x => x.bestChain >= 2, cmp: (a, b) => b.bestChain - a.bestChain || b.points - a.points });
  give('acc', '정확왕', '🎯', { ok: x => x.seen >= 10, cmp: (a, b) => b.acc - a.acc || b.seen - a.seen });
  give('grit', '끈기왕', '💪', { ok: x => x.retry >= 3, cmp: (a, b) => b.retry - a.retry });
  give('atk', '공격왕', '💥', { ok: x => x.sent >= 3, cmp: (a, b) => b.sent - a.sent });
  give('streak', '연속왕', '🔥', { ok: x => x.bestStreak >= 5, cmp: (a, b) => b.bestStreak - a.bestStreak });
  give('chal', '도전왕', '⚔️', { ok: x => x.challengeWins >= 1, cmp: (a, b) => b.challengeWins - a.challengeWins });
  give('learn', '복습왕', '📚', { ok: x => x.mastered >= 5, cmp: (a, b) => b.mastered - a.mastered });
  return t;
}
function classRanking(c, by) {
  const rows = Object.values(c.students).map(s => studentRow(c, s));
  const t = titles(rows); rows.forEach(r => { r.titles = t[r.id] || []; });
  return rankRows(rows, by);
}
function gradeRanking(grade, by) {
  const rows = [];
  for (const c of Object.values(DB.classes)) if (c.grade === grade) for (const s of Object.values(c.students)) rows.push(studentRow(c, s));
  const t = titles(rows); rows.forEach(r => { r.titles = t[r.id] || []; });
  return rankRows(rows, by);
}
function classBattle(grade) {
  const out = [];
  for (const c of Object.values(DB.classes)) {
    if (c.grade !== grade) continue;
    const st = Object.values(c.students).map(s => s.stats).filter(S => S.games > 0);
    const n = st.length; const sum = k => st.reduce((a, S) => a + S[k], 0);
    out.push({
      code: c.code, name: c.name, players: n, total: Object.keys(c.students).length, avgPoints: n ? Math.round(sum('points') / n) : 0,
      acc: sum('seen') ? Math.round(sum('first') / sum('seen') * 100) : 0, games: sum('games'), chains2: sum('chains2'), bestChain: Math.max(0, ...st.map(S => S.bestChain)),
    });
  }
  out.sort((a, b) => b.avgPoints - a.avgPoints || b.acc - a.acc);
  out.forEach((x, i) => { x.rank = i + 1; });
  return out;
}
function myRanks(c, sid) {
  const cr = classRanking(c, 'points'); const me = cr.find(x => x.id === sid);
  const gr = gradeRanking(c.grade, 'points'); const g = gr.find(x => x.id === sid && x.code === c.code);
  const cb = classBattle(c.grade); const cbMe = cb.find(x => x.code === c.code);
  return me ? { cls: me.rank, clsOf: cr.length, grade: g ? g.rank : null, gradeOf: gr.length, points: me.points, acc: me.acc, titles: me.titles, classBattle: cb.length > 1 && cbMe ? { rank: cbMe.rank, of: cb.length } : null } : null;
}

/* ===================== 화면에 보내기 ===================== */
function matchView(m) {
  const c = clsOf(m);
  return {
    id: m.id, state: m.state, practice: m.practice, solo: !!m.solo, level: m.level, mode: m.players.length, ranked: m.ranked, death: !!m.death, elapsed: m.state === 'playing' ? m.durMs - remaining(m) : 0, colors: m.settings.colors, left: remaining(m), paused: !!(c && c.paused && !m.practice), fever: m.fever, sprint: m.sprint,
    feverLeft: m.fever ? Math.max(0, m.feverAt + m.feverDur - (m.durMs - remainingPlay(m))) : 0,
    countdown: m.state === 'countdown' ? Math.max(0, m.startAt - Date.now()) : 0,
    players: m.players.map(p => ({ pid: p.pid, name: p.name, bot: p.isBot, board: p.board, score: p.score, alive: p.alive, pending: p.pending, target: p.target, stars: p.stars, streak: p.streak, phase: p.phase, rank: p.rank, maxChain: p.st.maxChain, first: p.st.first, seen: p.st.seen, fog: p.curse.fog > 0, reverse: p.curse.reverse > 0, golden: !!(p.q && p.q.golden && p.phase === 'question') })),
  };
}
const pushTimers = new Map();
function pushMatch(m) {
  if (pushTimers.has(m.id)) return;
  pushTimers.set(m.id, setTimeout(() => {
    pushTimers.delete(m.id);
    const v = matchView(m);
    for (const p of m.players) { const sid = playerSock(m, p); if (sid) io.to(sid).emit('m:state', v); }
    const c = clsOf(m); if (c && !m.practice) pushClass(c);
  }, 60));
}
function notify(m, p, data) { const sid = playerSock(m, p); if (sid) io.to(sid).emit('m:fx', data); }
function broadcastFx(m, data) { for (const p of m.players) notify(m, p, data); }

function ladderView(c) {
  if (!rankMode(c)) return null;
  const list = ladder(c);
  const challengers = {};
  for (const s of list) if (s.challenge) (challengers[s.challenge.target] = challengers[s.challenge.target] || []).push(s.name);
  return list.map((s, i) => ({ id: s.id, name: s.name, pos: i + 1, points: s.stats.points, acc: acc(s.stats), online: s.online, status: s.status, by: challengers[s.id] || [] }));
}
function studentView(c, s, lad) {
  const v = { id: s.id, code: c.code, cls: c.name, grade: c.grade, name: s.name, status: s.status, running: c.running, paused: c.paused, mode: c.settings.mode, easy: !!c.settings.easy, level: s.level || null, units: c.settings.units, matchMin: c.settings.matchMin, matchId: s.matchId, myRank: myRanks(c, s.id) };
  if (rankMode(c)) {
    v.rankMode = true;
    v.ladder = lad === undefined ? ladderView(c) : lad;
    const t = s.challenge && c.students[s.challenge.target];
    v.myChallenge = t ? { target: t.id, name: t.name, status: t.status, online: t.online } : null;
    v.autoIn = s.status === 'waiting' && !s.challenge && c.running ? Math.max(0, RANK_WAIT - (Date.now() - s.waitSince)) + Math.max(0, (s.readyAt || 0) - Date.now()) : null;
  }
  return v;
}
function teacherView(c) {
  const live = [...matches.values()].filter(m => m.code === c.code && !m.practice && m.state !== 'ended' || (m.code === c.code && !m.practice && m.state === 'ended' && Date.now() - m.endedAt < 20000));
  return {
    code: c.code, name: c.name, grade: c.grade, settings: c.settings, running: c.running, paused: c.paused,
    students: Object.values(c.students).map(s => ({ id: s.id, name: s.name, online: s.online, status: s.status, points: s.stats.points, games: s.stats.games, acc: acc(s.stats) })).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    matches: live.map(matchView),
  };
}
const classPush = new Map();
function pushClass(c) {
  if (classPush.has(c.code)) return;
  classPush.set(c.code, setTimeout(() => {
    classPush.delete(c.code);
    const lad = ladderView(c);
    for (const s of Object.values(c.students)) if (s.online && s.socketId) io.to(s.socketId).emit('state', studentView(c, s, lad));
    io.to('t:' + c.code).emit('tstate', teacherView(c));
  }, 120));
}
function classList() {
  return Object.values(DB.classes).sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'ko', { numeric: true }))
    .map(c => ({ code: c.code, name: c.name, grade: c.grade, students: Object.keys(c.students).length, online: Object.values(c.students).filter(s => s.online).length, running: c.running }));
}
setInterval(() => { for (const m of matches.values()) if (m.state !== 'ended') { eventTick(m); pushMatch(m); } }, FAST ? 250 : 1000);

/* ===================== 접속 ===================== */
io.on('connection', socket => {
  let me = null; // { c, s }
  let isTeacher = false;
  const T = fn => (data, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (!isTeacher) return cb({ err: '교사 로그인이 필요해요.' });
    try { cb(fn(data || {}) || { ok: true }); } catch (e) { console.error(e); cb({ err: '처리 중 문제가 생겼어요.' }); }
  };
  const S = fn => (data, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (!me) return cb({ err: '다시 들어와 주세요.', relogin: true });
    try { cb(fn(data || {}) || { ok: true }); } catch (e) { console.error(e); cb({ err: '처리 중 문제가 생겼어요.' }); }
  };
  const myMatch = () => { const m = me && matches.get(me.s.matchId); const p = m && m.players.find(x => x.pid === me.s.id); return m && p ? { m, p } : null; };

  /* ---------- 학생 ---------- */
  socket.on('join', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    d = d || {};
    const c = DB.classes[String(d.code || '').trim()];
    if (!c) return cb({ err: '입장 코드를 다시 확인해 주세요.' });
    let s = d.token && Object.values(c.students).find(x => x.token === d.token);
    const name = clean(d.name);
    if (!s) {
      if (!name) return cb({ err: '이름을 적어 주세요.' });
      s = Object.values(c.students).find(x => x.name === name);
      if (!s) { const id = uid(4); s = newStudentObj(id, name, uid(8)); c.students[id] = s; save(); }
    }
    if (s.socketId && s.socketId !== socket.id) io.to(s.socketId).emit('kicked', '다른 기기에서 같은 이름으로 들어왔어요.');
    s.online = true; s.socketId = socket.id; me = { c, s };
    if (s.status === 'playing' && !matches.has(s.matchId)) s.status = 'lobby';
    if ((s.status === 'lobby' || s.status === 'result') && c.running) { s.status = 'waiting'; s.waitSince = Date.now(); s.readyAt = 0; }
    cb({ ok: true, token: s.token, view: studentView(c, s) });
    const mm = myMatch();
    if (mm && mm.m.state !== 'ended') {
      socket.emit('m:state', matchView(mm.m));
      if (mm.p.phase === 'question' && mm.p.q) socket.emit('m:q', publicQ(mm.p.q));
      if (mm.p.phase === 'place') socket.emit('m:resume', { pair: mm.p.pair, next: [mm.m.seq[mm.p.pairIdx % mm.m.seq.length]], stars: mm.p.stars });
      if (mm.p.phase === 'settle') { mm.p.phase = 'place'; mm.p.pair = mm.p.pair || [1, 1]; nextQuestion(mm.m, mm.p); }
    }
    pushClass(c);
  });
  socket.on('setLevel', S(d => { // 1인용: 학생이 AI 난이도 고르기 (고르면 바로 대결이 열려요)
    const { c, s } = me;
    if (!LEVELS[d.level]) return { err: '난이도를 다시 골라 주세요.' };
    s.level = d.level; pushClass(c); matchmake(c);
    return { ok: true, level: s.level };
  }));
  socket.on('ready', S(() => { // 결과 화면 → 다음 경기 기다리기
    const { c, s } = me;
    if (s.status === 'playing') { const mm = myMatch(); if (mm && mm.m.state !== 'ended') return { err: '경기 중이에요.' }; }
    s.matchId = null; s.status = c.running ? 'waiting' : 'lobby'; s.waitSince = Date.now(); s.readyAt = 0; pushClass(c);
  }));
  socket.on('practice', S(() => { // 기다리는 동안 AI와 연습
    const { c, s } = me;
    if (s.status === 'playing') return { err: '경기 중이에요.' };
    const was = s.status === 'waiting' ? s.waitSince : 0;
    const m = createMatch(c, [s], 1, { practice: true });
    s.status = 'practice'; s.waitSince = c.running ? (was || Date.now()) : 0;
    return { ok: true, id: m.id };
  }));
  socket.on('leavePractice', S(() => { const { c, s } = me; const m = matches.get(s.matchId); if (m && m.practice) leaveMatch(c, s); s.matchId = null; s.status = c.running ? 'waiting' : 'lobby'; s.waitSince = s.waitSince || Date.now(); pushClass(c); }));
  socket.on('m:answer', S(d => { const mm = myMatch(); return mm ? answer(mm.m, mm.p, d.ans) : { err: '경기가 없어요.' }; }));
  socket.on('m:place', S(d => { const mm = myMatch(); return mm ? placed(mm.m, mm.p, d) : { err: '경기가 없어요.' }; }));
  socket.on('m:settled', S(d => { const mm = myMatch(); return mm ? settled(mm.m, mm.p, d) : { err: '경기가 없어요.' }; }));
  socket.on('m:item', S(d => { const mm = myMatch(); return mm ? useItem(mm.m, mm.p, d.kind, d) : { err: '경기가 없어요.' }; }));
  socket.on('m:target', S(d => {
    const mm = myMatch(); if (!mm) return { err: '경기가 없어요.' };
    const t = mm.m.players.find(x => x.pid === d.pid && x.alive && x.pid !== mm.p.pid);
    if (!t) return { err: '그 친구는 고를 수 없어요.' };
    mm.p.target = t.pid; pushMatch(mm.m); return { ok: true };
  }));
  socket.on('challenge', S(d => {
    const { c, s } = me;
    if (!rankMode(c)) return { err: '지금은 랭킹전이 아니에요.' };
    const t = c.students[d.target];
    if (!t) return { err: '그 친구를 찾을 수 없어요.' };
    if (!t.online) return { err: '그 친구는 지금 접속해 있지 않아요.' };
    if (!canChallenge(c, s, t)) return { err: '나보다 순위가 높은 친구에게만 도전할 수 있어요.' };
    s.challenge = { target: t.id, at: Date.now() };
    if (t.socketId) io.to(t.socketId).emit('challenged', { from: s.name });
    pushClass(c); return { ok: true };
  }));
  socket.on('cancelChallenge', S(() => { const { c, s } = me; s.challenge = null; s.waitSince = Math.max(s.waitSince, Date.now() - RANK_WAIT + 8000); pushClass(c); }));
  socket.on('myRanking', S(d => { const { c, s } = me; const by = d.by || 'points'; return { ok: true, cls: classRanking(c, by).slice(0, 30), me: myRanks(c, s.id) }; }));

  /* ---------- 교사 ---------- */
  socket.on('t:login', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    d = d || {};
    if (d.token && teacherTokens.has(d.token)) { isTeacher = true; return cb({ ok: true, token: d.token, classes: classList(), units: UNITS, types: TYPES }); }
    if (!checkPw(d.pw)) return setTimeout(() => cb({ err: '비밀번호가 맞지 않아요.' }), 600);
    const token = uid(12); teacherTokens.add(token); isTeacher = true;
    cb({ ok: true, token, classes: classList(), units: UNITS, types: TYPES });
  });
  socket.on('t:classes', T(() => ({ ok: true, classes: classList() })));
  socket.on('t:newClass', T(d => {
    const code = newCode(); const c = blankClass(code, clean(d.name, 16) || `3학년 ${Object.keys(DB.classes).length + 1}반`, d.grade || 3);
    DB.classes[code] = c; save(); return { ok: true, code, classes: classList() };
  }));
  socket.on('t:renameClass', T(d => { const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' }; c.name = clean(d.name, 16) || c.name; c.grade = Number(d.grade) || c.grade; save(); pushClass(c); return { ok: true, classes: classList() }; }));
  socket.on('t:deleteClass', T(d => {
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    for (const s of Object.values(c.students)) { if (s.socketId) io.to(s.socketId).emit('kicked', '선생님이 반을 정리했어요.'); }
    for (const m of matches.values()) if (m.code === c.code) { for (const t of m.timers) clearTimeout(t); matches.delete(m.id); }
    delete DB.classes[d.code]; save(); return { ok: true, classes: classList() };
  }));
  socket.on('t:open', T(d => {
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    for (const r of socket.rooms) if (r.startsWith('t:')) socket.leave(r);
    socket.join('t:' + c.code); return { ok: true, view: teacherView(c) };
  }));
  socket.on('t:settings', T(d => {
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    const v = d.settings || {}; const st = c.settings;
    if ([1, 2, 3].includes(Number(v.mode))) st.mode = Number(v.mode);
    if (Array.isArray(v.units)) { const u = v.units.map(Number).filter(x => UNITS[x]); if (u.length) st.units = u; }
    if (Array.isArray(v.types)) { const t = v.types.filter(x => TYPES[x]); if (t.length) st.types = t; }
    if ([0, 3, 5, 7, 10].includes(Number(v.matchMin))) st.matchMin = Number(v.matchMin);
    if ([3, 4, 5].includes(Number(v.colors))) st.colors = Number(v.colors);
    if ([12, 18, 30].includes(Number(v.garbageCap))) st.garbageCap = Number(v.garbageCap);
    if (typeof v.aiFill === 'boolean') st.aiFill = v.aiFill;
    if (typeof v.review === 'boolean') st.review = v.review;
    if (typeof v.easy === 'boolean') st.easy = v.easy;
    if (st.mode !== 2) st.challenge = false;
    if (typeof v.challenge === 'boolean') {
      st.challenge = v.challenge; if (v.challenge) st.mode = 2;
      // 랭킹전을 켜면 기다리던 학생도 고를 시간을 20초 줘요 · 끄면 도전 신청을 모두 지워요
      for (const s of Object.values(c.students)) { if (v.challenge && s.status === 'waiting') s.waitSince = Date.now(); if (!v.challenge) s.challenge = null; }
      feed(c, v.challenge ? '랭킹전이 시작됐어요! 나보다 순위가 높은 친구에게 도전하세요' : '랭킹전이 끝났어요. 다시 자동으로 상대가 정해져요');
    }
    save(); pushClass(c); return { ok: true, settings: st };
  }));
  socket.on('t:start', T(d => { // 모두 자동 배정하고 시작
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    c.running = true; c.paused = false;
    let t = Date.now() - 20000; // 지금 들어와 있는 학생은 바로 짝지어요
    for (const s of shuffle(Object.values(c.students))) if (s.online && (s.status === 'lobby' || s.status === 'result' || s.status === 'waiting')) { s.status = 'waiting'; s.matchId = null; s.waitSince = t++; s.readyAt = 0; }
    for (const s of Object.values(c.students)) if (s.online && s.status === 'practice') s.waitSince = t++;
    if (rankMode(c)) for (const s of Object.values(c.students)) if (s.status === 'waiting') s.waitSince = Date.now();
    matchmake(c); pushClass(c); return { ok: true };
  }));
  socket.on('t:pause', T(d => {
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    c.paused = !!d.on;
    for (const m of matches.values()) {
      if (m.code !== c.code || m.practice || m.state !== 'playing') continue;
      if (c.paused) { m.pausedLeft = remaining(m); if (m.endTimer) { clearTimeout(m.endTimer); m.timers.delete(m.endTimer); } }
      else if (m.pausedLeft != null) { m.endAt = Date.now() + m.pausedLeft; m.pausedLeft = null; m.endTimer = later(m, () => endMatch(m, 'time'), m.endAt - Date.now()); }
      pushMatch(m);
    }
    pushClass(c); return { ok: true };
  }));
  socket.on('t:stop', T(d => { // 경기 모두 끝내기 (지금 점수로 순위)
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    c.running = false; c.paused = false;
    for (const m of [...matches.values()]) if (m.code === c.code && m.state !== 'ended') { if (m.practice) { for (const t of m.timers) clearTimeout(t); matches.delete(m.id); } else endMatch(m, 'teacher'); }
    for (const s of Object.values(c.students)) { s.challenge = null; if (s.status === 'waiting' || s.status === 'practice') { s.status = 'lobby'; s.matchId = null; } }
    pushClass(c); return { ok: true };
  }));
  socket.on('t:endMatch', T(d => { const m = matches.get(d.id); if (m && m.state !== 'ended') endMatch(m, 'teacher'); return { ok: true }; }));
  socket.on('t:kick', T(d => {
    const c = DB.classes[d.code]; const s = c && c.students[d.id]; if (!s) return { err: '학생이 없어요.' };
    leaveMatch(c, s, true);
    if (s.socketId) io.to(s.socketId).emit('kicked', '선생님이 내보냈어요. 다시 들어오려면 코드를 입력하세요.');
    if (d.remove) delete c.students[d.id]; else { s.online = false; s.socketId = null; s.status = 'lobby'; s.matchId = null; }
    save(); pushClass(c); return { ok: true };
  }));
  socket.on('t:ranking', T(d => {
    const by = d.by || 'points';
    const c = DB.classes[d.code];
    const grade = Number(d.grade) || (c && c.grade) || 3;
    return { ok: true, cls: c ? classRanking(c, by) : [], grade: gradeRanking(grade, by), battle: classBattle(grade), gradeNo: grade };
  }));
  socket.on('t:records', T(d => {
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    const qs = Object.fromEntries(allQuestions().map(q => [q.id, q]));
    const wrongTop = Object.entries(c.wrongCount).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, n]) => {
      const q = qs[id]; return q ? { id, n, unit: q.unit, type: TYPES[q.type], text: q.q || q.say || q.pic, img: q.img, answer: q.type === 'order' ? q.answer : q.choices[0] } : null;
    }).filter(Boolean);
    return { ok: true, results: c.results.slice(-1500), students: classRanking(c, 'points'), wrongTop };
  }));
  socket.on('t:resetRecords', T(d => {
    const c = DB.classes[d.code]; if (!c) return { err: '반이 없어요.' };
    c.results = []; c.wrongCount = {}; for (const s of Object.values(c.students)) s.stats = blankStats();
    save(); pushClass(c); return { ok: true };
  }));
  // 문제 관리 (모든 반이 같이 써요)
  socket.on('t:questions', T(() => ({ ok: true, list: allQuestions().filter(q => TYPES[q.type]).map(q => ({ id: q.id, unit: q.unit, type: q.type, q: q.q, pic: q.pic, img: q.img, choices: q.choices, answer: q.answer, exp: q.exp, custom: !!q.custom, off: DB.disabled.includes(q.id) })) })));
  socket.on('t:toggleQ', T(d => {
    const ids = Array.isArray(d.ids) ? d.ids : [d.id];
    for (const id of ids) { const i = DB.disabled.indexOf(id); if (d.off && i < 0) DB.disabled.push(id); if (!d.off && i >= 0) DB.disabled.splice(i, 1); }
    save(); return { ok: true };
  }));
  socket.on('t:addQuestions', T(d => {
    const rows = Array.isArray(d.rows) ? d.rows : []; let added = 0; const errors = [];
    const typeKey = v => { v = String(v || '').trim(); return TYPES[v] ? v : Object.keys(TYPES).find(k => TYPES[k] === v || TYPES[k].replace(/\s/g, '') === v.replace(/\s/g, '') || TYPES[k].startsWith(v)) || null; };
    if (d.replace) DB.custom = [];
    rows.forEach((r, i) => {
      const unit = parseInt(String(r.unit).replace(/[^0-9]/g, ''), 10);
      const type = typeKey(r.type) || 'quiz';
      const text = String(r.q || '').trim(), ans = String(r.answer || '').trim();
      const wrong = [r.w1, r.w2, r.w3].map(x => String(x || '').trim()).filter(Boolean);
      if (!UNITS[unit]) return errors.push(`${i + 2}줄: 차시는 1~9 중 하나`);
      if (!type) return errors.push(`${i + 2}줄: 유형을 알 수 없어요`);
      if (!ans) return errors.push(`${i + 2}줄: 정답이 비었어요`);
      const q = { id: 'c' + (++DB.qseq), unit, type, custom: true, exp: String(r.exp || '').trim() }; q.item = 'c:' + q.id;
      const ASK = { quiz: `${unit}. ${(UNITS[unit] || {}).short || ''}`, meaning: '이 낱말의 뜻은?', word: '알맞은 영어 낱말은?', picture: '그림에 알맞은 낱말은?', smeaning: '이 문장의 뜻은?', sentence: '알맞은 영어 문장은?', blank: '빈칸에 알맞은 말은?', response: '빈칸에 알맞은 말은?', order: '낱말을 순서대로 눌러 문장을 만드세요.' };
      q.ask = ASK[type];
      if (type === 'order') { q.q = text; q.answer = ans; q.tokens = ans.split(/\s+/); if (q.tokens.length < 2) return errors.push(`${i + 2}줄: 문장 조립은 두 낱말 이상`); }
      else {
        if (wrong.length < 3) return errors.push(`${i + 2}줄: 오답 3개가 필요해요`);
        q.choices = [ans, ...wrong.slice(0, 3)];
        if (type === 'picture' && /\p{Extended_Pictographic}/u.test(text) && text.length <= 8) { q.pic = text; q.q = ''; } else q.q = text;
      }
      DB.custom.push(q); added++;
    });
    save(); return { ok: true, added, errors: errors.slice(0, 20) };
  }));
  socket.on('t:deleteQ', T(d => { DB.custom = DB.custom.filter(q => q.id !== d.id); save(); return { ok: true }; }));
  socket.on('t:backup', T(() => ({ ok: true, data: serialize() })));
  socket.on('t:restore', T(d => {
    if (!d.data || typeof d.data !== 'object' || !d.data.classes) return { err: '백업 파일이 올바르지 않아요.' };
    const online = !isFresh() && !d.force;
    if (online) return { err: '서버에 이미 기록이 있어요.', needForce: true };
    for (const m of matches.values()) for (const t of m.timers) clearTimeout(t);
    matches.clear(); restore(d.data); ensureDefaultClasses(); save(); return { ok: true, classes: classList() };
  }));
  socket.on('t:info', T(() => ({ ok: true, empty: isFresh(), classes: classList() })));

  socket.on('disconnect', () => {
    if (!me) return;
    const { c, s } = me;
    if (s.socketId !== socket.id) return;
    s.online = false; s.socketId = null; s.challenge = null;
    const m = matches.get(s.matchId);
    if (m && m.practice) { leaveMatch(c, s); s.matchId = null; }
    if (s.status === 'waiting' || s.status === 'practice') s.status = 'lobby';
    // 경기 중에 끊기면 60초 기다렸다가 돌아오지 않으면 탈락 처리
    if (m && !m.practice && m.state !== 'ended') {
      setTimeout(() => { if (!s.online && s.matchId === m.id && m.state !== 'ended') { const p = m.players.find(x => x.pid === s.id); if (p && p.alive) knockOut(m, p); } }, FAST ? 1500 : 60000);
    }
    pushClass(c);
  });
});

// 우리 학년 반: 3학년 1~7반 (입장 코드 0301~0307 — 서버가 다시 켜져도 코드가 그대로예요)
const DEFAULT_CLASSES = [1, 2, 3, 4, 5, 6, 7].map(n => ['030' + n, `3학년 ${n}반`]);
function ensureDefaultClasses() {
  let made = false;
  for (const [code, name] of DEFAULT_CLASSES) if (!DB.classes[code] && !Object.values(DB.classes).some(c => c.name === name)) { DB.classes[code] = blankClass(code, name, 3); made = true; }
  if (made) save();
}
// 학생도 기록도 없는 '새 서버'인지 (Render가 잠들었다 깨면 이렇게 돼요)
const isFresh = () => Object.values(DB.classes).every(c => !Object.keys(c.students).length && !c.results.length);
load();
ensureDefaultClasses();
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  사이언스 뿌요 팡!');
  console.log(`  학생: ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT}`);
  console.log(`  교사: ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT}/teacher.html`);
  console.log(`  문제 ${BASE_Q.length}개 · 교사 비밀번호 ${process.env.TEACHER_PASSWORD ? '환경변수 사용' : '기본(그랑프리와 같음)'}\n`);
});
module.exports = { server };
