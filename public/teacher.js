/* 사이언스 뿌요 팡! — 교사 관리 화면 (네온 시안) */
(() => {
  const J = window.Jelly;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const socket = io({ transports: ['websocket', 'polling'] });
  const emit = (ev, d) => new Promise(res => socket.emit(ev, d || {}, r => res(r || {})));
  const KEY = 'puyoPang.teacher', BK = 'puyoPang.backup';
  let T = {}; try { T = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
  const saveT = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { } };
  let toastT; function toast(m, ms = 2400) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
  const unitName = u => Number(u) === 99 ? '3단원 전체' : u + '차시';
  const box = (b) => `left:${b[0]}px;top:${b[1]}px;width:${b[2] - b[0]}px;height:${b[3] - b[1]}px`;
  const today = () => new Date().toISOString().slice(0, 10);
  const mmss = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  let UNITS = {}, TYPES = {}, classes = [], cur = null, view = null;

  /* ---------- 작은 도우미: 화면 위에 버튼·글자 얹기 ---------- */
  function el(parent, tag, cls, b, html, style) {
    const e = document.createElement(tag); if (cls) e.className = cls; if (b) e.style.cssText = box(b) + ';' + (style || ''); else if (style) e.style.cssText = style;
    if (html != null) e.innerHTML = html; parent.appendChild(e); return e;
  }
  function hot(parent, b, fn, label) { const e = el(parent, 'button', 'hot', [b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3]); e.setAttribute('aria-label', label || ''); e.onclick = fn; Stage.initHot(parent.closest('.scr') || parent); return e; }
  function show(id) { $$('.scr').forEach(s => s.classList.toggle('on', s.id === id)); }
  const cur$ = () => ($('.scr.on') || {}).id;

  /* ---------- 알림 카드 (운영 알림 그림) ---------- */
  const NOTE = { saved: 'a_saved', upload: 'a_upload', uperr: 'a_uperr', backup: 'a_backup', confirm: 'a_confirm' };
  let noteCb = null;
  function note(kind, msg, ms) {
    $('#noteImg').src = `img/${NOTE[kind]}.webp`; $('#noteCard').style.width = '620px'; $('#noteMsg').textContent = msg || '';
    $('#noteNo').style.display = 'none'; $('#noteYes').style.cssText = 'left:0;top:0;width:100%;height:100%';
    $('#noteYes').onclick = () => $('#note').classList.remove('on');
    $('#note').classList.add('on');
    if (ms) setTimeout(() => $('#note').classList.remove('on'), ms);
  }
  function confirmBox(msg) {
    return new Promise(res => {
      $('#noteImg').src = 'img/a_confirm.webp'; $('#noteCard').style.width = '620px'; $('#noteMsg').textContent = msg || '';
      $('#noteNo').style.cssText = 'left:108px;top:172px;width:194px;height:72px;display:block';
      $('#noteYes').style.cssText = 'left:316px;top:172px;width:198px;height:72px;display:block';
      const done = v => { $('#note').classList.remove('on'); res(v); };
      $('#noteNo').onclick = () => done(false); $('#noteYes').onclick = () => done(true);
      $('#note').classList.add('on');
    });
  }
  function modal(html, bind) { $('#mbox').innerHTML = html; $('#modal').classList.add('on'); if (bind) bind($('#mbox')); }
  const closeModal = () => $('#modal').classList.remove('on');
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

  /* ---------- 로그인 ---------- */
  const L = $('#tLogin');
  hot(L, [283, 700, 597, 808], () => { location.href = '/'; }, '학생 화면');
  hot(L, [650, 688, 1375, 812], () => login($('#pw').value), '로그인');
  $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') login($('#pw').value); });
  async function login(pw) {
    const r = await emit('t:login', pw ? { pw } : { token: T.token });
    if (r.err) { if (pw) $('#loginErr').textContent = r.err; return false; }
    T.token = r.token; saveT(); UNITS = r.units; TYPES = r.types; classes = r.classes;
    if (cur$() === 'tLogin') show('tDash');
    await maybeRestore();
    const pick = classes.find(c => c.code === (cur || T.last)) || classes[0];
    if (pick) await openClass(pick.code); else renderDash();
    backupNow();
    return true;
  }
  socket.on('connect', () => { if (T.token) login(); });

  /* ---------- 기록 지키기 ---------- */
  async function backupNow() {
    const r = await emit('t:backup'); if (!r.ok) return;
    if (!Object.values(r.data.classes || {}).some(c => Object.keys(c.students || {}).length || (c.results || []).length)) return;
    try { localStorage.setItem(BK, JSON.stringify(r.data)); } catch (e) { }
  }
  setInterval(backupNow, 60000);
  async function maybeRestore() {
    const info = await emit('t:info'); if (!info.ok || !info.empty) return;
    let bk = null; try { bk = JSON.parse(localStorage.getItem(BK) || 'null'); } catch (e) { }
    if (!bk || !bk.classes || !Object.values(bk.classes).some(c => Object.keys(c.students || {}).length)) return;
    const when = bk.savedAt ? new Date(bk.savedAt).toLocaleString('ko-KR') : '';
    if (await confirmBox(`서버가 다시 시작됐어요. 백업(${when}, ${Object.keys(bk.classes).length}개 반)으로 되살릴까요?`)) {
      const r = await emit('t:restore', { data: bk }); if (r.ok) { classes = r.classes; toast('기록을 되살렸어요!'); }
    }
  }
  async function downloadBackup() {
    const r = await emit('t:backup'); if (!r.ok) return toast(r.err || '실패');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data)], { type: 'application/json' }));
    a.download = `사이언스뿌요팡_백업_${today()}.json`; a.click(); note('backup', '', 2500);
  }
  $('#fileBk').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch (er) { return note('uperr', '백업 파일을 읽지 못했어요.'); }
    let r = await emit('t:restore', { data });
    if (r.needForce) { if (!await confirmBox('지금 서버 기록을 지우고 백업 파일로 바꿔요')) return; r = await emit('t:restore', { data, force: true }); }
    if (r.err) return note('uperr', r.err);
    classes = r.classes; if (classes[0]) openClass(classes[0].code); note('saved', '백업을 불러왔어요', 2200);
  };

  /* ---------- 반 ---------- */
  async function openClass(code) {
    const r = await emit('t:open', { code }); if (r.err) return toast(r.err);
    cur = code; T.last = code; saveT(); view = r.view;
    const c = await emit('t:classes'); if (c.ok) classes = c.classes;
    const i = classes.findIndex(x => x.code === code); if (i >= 0) D.cpage = Math.floor(i / 3);
    renderDash(true);
    if (cur$() === 'tRank') loadRanking(); if (cur$() === 'tRec') loadRecords(); if (cur$() === 'tCls') renderCls(true);
  }
  socket.on('tstate', v => { if (v.code !== cur) return; view = v; renderDash(); if (cur$() === 'tTV') renderTV(); if (cur$() === 'tCls') renderCls(); });
  setInterval(async () => { if (!T.token) return; const r = await emit('t:classes'); if (r.ok) { classes = r.classes; renderClassList(); } }, 8000);
  function newClassModal() {
    modal(`<h2>새 반 만들기</h2>
      <div class="mrow"><span>반 이름</span><input id="ncName" maxlength="16" placeholder="예) 3학년 8반"></div>
      <div class="mrow"><span>학년</span><select id="ncGrade"><option value="3">3학년</option><option value="4">4학년</option><option value="5">5학년</option><option value="6">6학년</option></select></div>
      <div class="mnote">3학년 1반~7반은 이미 만들어져 있어요 (입장 코드 0301 ~ 0307). 반을 더 만들면 새 입장 코드가 생기고, 같은 학년끼리 학년 랭킹과 반 대항전에 함께 나와요.</div>
      <div class="mbtns"><button class="pill c" id="ncNo">취소</button><button class="pill m" id="ncOk">만들기</button></div>`, m => {
      m.querySelector('#ncName').focus();
      m.querySelector('#ncNo').onclick = closeModal;
      m.querySelector('#ncOk').onclick = async () => {
        const r = await emit('t:newClass', { name: m.querySelector('#ncName').value.trim(), grade: m.querySelector('#ncGrade').value });
        if (r.err) return toast(r.err);
        closeModal(); classes = r.classes; await openClass(r.code); toast('새 반을 만들었어요. 입장 코드를 알려 주세요!');
      };
    });
  }

  /* ================= 교사 관리(경기 운영) ================= */
  const D = { cpage: 0, mpage: 0, built: false };
  const DS = $('#tDash');
  const OPT = {
    mode: [[1, '1인(AI)', [546, 352, 672, 397]], [2, '2인전', [688, 352, 815, 397]], [3, '3인전', [831, 352, 958, 397]]],
    units: [[99, '3단원 전체', [546, 406, 700, 449]]],
    matchMin: [[3, '3분', [546, 456, 675, 500]], [5, '5분', [686, 456, 815, 500]], [0, '데스매치', [826, 456, 958, 500]]],
    colors: [[3, '3색', [546, 509, 675, 553]], [4, '4색', [686, 509, 815, 553]], [5, '5색', [826, 509, 958, 553]]],
  };
  function tabHots(scr, y, xs) {
    const go = [['dash', '경기 운영'], ['rank', '랭킹'], ['quest', '문제 관리'], ['rec', '기록'], ['cls', '반 설정']];
    xs.forEach((b, i) => hot(scr, [b[0], y[0], b[1], y[1]], () => goTab(go[i][0]), go[i][1]));
  }
  function goTab(k) {
    if (!cur && k !== 'dash') return toast('반을 먼저 만들어 주세요.');
    if (k === 'dash') { show('tDash'); renderDash(true); }
    if (k === 'rank') { show('tRank'); loadRanking(); }
    if (k === 'quest') { show('tQuest'); loadQuestions(); }
    if (k === 'rec') { show('tRec'); loadRecords(); }
    if (k === 'cls') { show('tCls'); renderCls(true); }
  }
  function buildDash() {
    if (D.built) return; D.built = true;
    el(DS, 'div', 'dataTx', [360, 124, 1046, 180], '', 'font-size:32px;padding:0 12px').id = 'dTitle';
    el(DS, 'div', 'dataTx dark', [1262, 124, 1458, 180], '', 'font-size:38px;font-family:var(--fe);font-weight:700;letter-spacing:4px').id = 'dCode';
    el(DS, 'div', 'qrBox', [1495, 116, 1609, 232]).id = 'dQR';
    tabHots(DS, [205, 265], [[352, 628], [638, 845], [855, 1075], [1085, 1270], [1282, 1472]]);
    el(DS, 'div', '', null, '', '').id = 'dSlots';
    el(DS, 'div', 'miniPager', [44, 474, 304, 500]).id = 'dCPager';
    hot(DS, [46, 502, 302, 568], newClassModal, '새 반 만들기');
    hot(DS, [48, 634, 298, 694], () => { if (!cur) return toast('반을 먼저 만들어 주세요.'); openTV(); }, 'TV 모드');
    hot(DS, [48, 712, 298, 772], downloadBackup, '기록 백업');
    hot(DS, [48, 790, 298, 852], () => $('#fileBk').click(), '백업 불러오기');
    el(DS, 'div', '', null, '').id = 'dOpts';
    const more = el(DS, 'button', 'pill c', [770, 294, 962, 348], '세부 설정', 'font-size:22px'); more.onclick = detailModal;
    hot(DS, [1016, 358, 1235, 418], async () => { if (!cur) return; const r = await emit('t:start', { code: cur }); if (r.err) toast(r.err); else toast('모두 자동 배정하고 시작했어요!'); }, '모두 시작');
    const pz = hot(DS, [1248, 358, 1428, 418], async () => { if (!cur) return; await emit('t:pause', { code: cur, on: !(view && view.paused) }); }, '일시정지'); pz.id = 'dPause';
    el(DS, 'img', 'at', [1244, 352, 1432, 424], null, 'display:none;pointer-events:none').id = 'dResume';
    $('#dResume').src = 'img/tb_resume.webp';
    hot(DS, [1442, 358, 1622, 418], async () => { if (!cur) return; if (!await confirmBox('진행 중인 경기를 지금 점수로 끝내고 자동 배정을 멈춰요')) return; await emit('t:stop', { code: cur }); toast('경기를 모두 끝냈어요.'); }, '경기 종료');
    el(DS, 'div', 'stuSum', [1178, 444, 1618, 478]).id = 'dSum';
    el(DS, 'div', 'stuBox', [1020, 486, 1618, 624]).id = 'dStu';
    el(DS, 'div', 'lab', [620, 674, 1000, 718], '', 'font-size:20px').id = 'dLiveCnt';
    el(DS, 'div', 'miniPager', [1420, 678, 1620, 716]).id = 'dMPager';
    el(DS, 'div', '', null, '').id = 'dLive';
  }
  function renderClassList() {
    if (!D.built) return;
    const pages = Math.max(1, Math.ceil(classes.length / 3)); D.cpage = Math.min(D.cpage, pages - 1);
    const slots = [[42, 244, 304, 316], [42, 324, 304, 394], [42, 404, 304, 474]];
    const list = classes.slice(D.cpage * 3, D.cpage * 3 + 3);
    $('#dSlots').innerHTML = slots.map((b, i) => {
      const c = list[i];
      if (!c) return `<div class="cSlot" style="${box(b)};background-image:url(img/bl_g.webp);opacity:.55;cursor:default"><small>${i === 0 && !classes.length ? '새 반을 만들어 주세요' : ''}</small></div>`;
      return `<button class="cSlot" data-code="${c.code}" style="${box(b)};background-image:url(img/${c.code === cur ? 'bl_y' : 'bl_c'}.webp)">${esc(c.name)}${c.running ? '<i class="live"></i>' : ''}<small>${c.online}/${c.students}명 · 코드 ${c.code}</small></button>`;
    }).join('');
    $$('#dSlots button').forEach(b => b.onclick = () => openClass(b.dataset.code));
    $('#dCPager').innerHTML = pages > 1 ? `<button id="cpP" ${D.cpage ? '' : 'disabled'}>▲</button><span>${D.cpage + 1}/${pages}</span><button id="cpN" ${D.cpage < pages - 1 ? '' : 'disabled'}>▼</button>` : '';
    if (pages > 1) { $('#cpP').onclick = () => { D.cpage--; renderClassList(); }; $('#cpN').onclick = () => { D.cpage++; renderClassList(); }; }
  }
  function renderDash(full) {
    buildDash(); renderClassList();
    const v = view;
    if (!v) { $('#dTitle').textContent = '왼쪽에서 새 반을 만들어 주세요'; $('#dCode').textContent = ''; return; }
    const s = v.settings;
    $('#dTitle').innerHTML = `${esc(v.name)} ${s.easy ? '<span style="font-size:18px;margin-left:10px;color:#2dff9a">🐣 쉬운 모드</span>' : ''}<span style="font-size:22px;margin-left:14px;color:${v.running ? (v.paused ? '#ffe23a' : '#2dff9a') : '#9ad8ff'}">${v.running ? (v.paused ? '⏸ 일시정지' : s.challenge ? '⚔ 랭킹전 진행 중 · 학생이 도전 상대를 골라요' : '● 진행 중 · 새로 온 학생도 자동 배정') : s.challenge ? '랭킹전 준비 · 모두 시작을 누르세요' : '대기 중 · 모두 시작을 누르세요'}</span>`;
    $('#dCode').textContent = v.code;
    if (full || $('#dQR').dataset.code !== v.code) {
      $('#dQR').dataset.code = v.code; $('#dQR').innerHTML = '';
      if (window.QRCode) new QRCode($('#dQR'), { text: `${location.origin}/?code=${v.code}`, width: 160, height: 160 }); else $('#dQR').innerHTML = `<span style="color:#0b1d3a;font-size:14px;text-align:center;padding:4px;word-break:break-all">${esc(location.host)}</span>`;
    }
    // 경기 설정 버튼
    $('#dOpts').innerHTML = `<div class="cover" style="${box([538, 342, 970, 458])};background:#03102b;border-radius:10px"></div>` + Object.entries(OPT).map(([k, arr]) => arr.map(([val, label, b]) => {
      const on = k === 'units' ? s.units.includes(val) : s[k] === val;
      return `<button class="pill ${on ? 'm' : 'c'}" data-k="${k}" data-v="${val}" style="${box([b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4])};font-size:${label.length > 3 ? 20 : 23}px">${label}</button>`;
    }).join('')).join('');
    // 차시 고르기 (여러 개를 고를 수 있어요)
    const picked = s.units.filter(u => u !== 99).sort((a, b) => a - b);
    const pl = picked.length ? (picked.length <= 3 ? picked.map(u => u + '차시').join('·') : `${picked.length}개 차시`) : '차시 고르기 ▾';
    $('#dOpts').insertAdjacentHTML('beforeend', `<button class="pill ${picked.length ? 'm' : 'c'}" id="dPick" style="${box([704, 402, 962, 453])};font-size:${pl.length > 9 ? 18 : 21}px">${pl}</button>`);
    $('#dPick').onclick = lessonModal;
    $('#dOpts').insertAdjacentHTML('beforeend', `<button class="ib" data-rank="1" style="${box([552, 560, 744, 618])};background-image:url(img/${s.challenge ? 'rb_on' : 'rb_off'}.webp)" aria-label="랭킹전 켜고 끄기"></button><div class="rkHint" style="${box([752, 566, 952, 612])}">${s.challenge ? '학생이 위 순위에게 도전' : '자동 배정 중'}</div>`);
    $('#dOpts [data-rank]').onclick = async () => {
      const on = !s.challenge;
      if (on && !await confirmBox('랭킹전을 켜요. 학생이 나보다 순위가 높은 친구를 골라 2인전으로 도전해요')) return;
      const r = await emit('t:settings', { code: cur, settings: { challenge: on } }); if (r.err) return toast(r.err);
      view.settings = r.settings; renderDash(); toast(on ? '랭킹전을 시작했어요! 학생 화면에 도전 버튼이 생겨요' : '랭킹전을 껐어요. 다시 자동 배정돼요');
    };
    $$('#dOpts button[data-k]').forEach(b => b.onclick = async () => {
      const k = b.dataset.k, val = Number(b.dataset.v);
      let patch;
      if (k === 'units') patch = { units: [99] };
      else patch = { [k]: val };
      const r = await emit('t:settings', { code: cur, settings: patch }); if (r.err) return toast(r.err);
      view.settings = r.settings; renderDash(); toast('다음 경기부터 적용돼요.', 1400);
    });
    $('#dResume').style.display = v.paused ? 'block' : 'none';
    // 학생 현황
    const cnt = k => v.students.filter(x => x.online && x.status === k).length;
    const on = v.students.filter(x => x.online).length;
    $('#dSum').innerHTML = `접속 <b>${on}</b>/${v.students.length} · 경기 <b>${cnt('playing')}</b> · 대기 <b>${cnt('waiting') + cnt('lobby') + cnt('result')}</b>`;
    $('#dStu').innerHTML = v.students.map(x => `<span class="chip ${x.online ? '' : 'off'}" title="${x.points}점 · 정답률 ${x.acc}%"><i class="dot ${x.online ? x.status : 'off'}"></i>${esc(x.name)}</span>`).join('') || '<span class="lab" style="position:static">학생이 입장 코드로 들어오면 여기에 보여요</span>';
    renderDashLive();
  }
  function miniBoard(cv, board, cell, alive, rank) {
    const ctx = Stage.sizeCanvas(cv, 6 * cell, 12 * cell);
    J.drawBoard(ctx, board, { cell, dead: !alive, deadText: rank ? rank + '등' : 'OUT', showX: false });
  }
  function renderDashLive() {
    const ms = view ? view.matches : [];
    const live = ms.filter(m => m.state !== 'ended').length;
    $('#dLiveCnt').textContent = ms.length ? `진행 중 ${live}경기` : '';
    const pages = Math.max(1, Math.ceil(ms.length / 3)); D.mpage = Math.min(D.mpage, pages - 1);
    $('#dMPager').innerHTML = pages > 1 ? `<button id="mpP" ${D.mpage ? '' : 'disabled'}>◀</button><span>${D.mpage + 1}/${pages}</span><button id="mpN" ${D.mpage < pages - 1 ? '' : 'disabled'}>▶</button>` : '';
    if (pages > 1) { $('#mpP').onclick = () => { D.mpage--; renderDashLive(); }; $('#mpN').onclick = () => { D.mpage++; renderDashLive(); }; }
    const slots = [[376, 740, 766, 854], [796, 740, 1186, 854], [1216, 740, 1606, 854]];
    const vis = ms.slice(D.mpage * 3, D.mpage * 3 + 3);
    const wrap = $('#dLive');
    const key = vis.map(m => m.id + m.state + m.players.map(p => p.board + p.alive + p.score + p.first).join()).join('|') + Math.floor(Date.now() / 1000);
    if (wrap.dataset.k === key) return; wrap.dataset.k = key;
    wrap.innerHTML = '';
    if (!vis.length) { el(wrap, 'div', 'empty', [376, 740, 1606, 854], '선생님이 모두 시작을 누르면 경기가 여기에 보여요'); return; }
    vis.forEach((m, i) => {
      const s = el(wrap, 'div', 'mSlot' + (m.state === 'ended' ? ' ended' : ''), slots[i]);
      const cell = m.players.length === 3 ? 7 : 8;
      const ps = m.players;
      const time = (m.ranked ? '⚔ ' : '') + (m.state === 'ended' ? '경기 끝' : m.state === 'countdown' ? '준비' : (m.paused ? '⏸ ' : m.sprint ? '⚡ ' : m.fever ? '🔥 ' : '') + (m.death ? '∞ ' + mmss(m.elapsed || 0) : mmss(m.left)));
      if (ps.length === 2) {
        const a = el(s, 'canvas'); miniBoard(a, ps[0].board, cell, ps[0].alive, ps[0].rank);
        el(s, 'div', 'mid', null, `<div class="nm">${esc(ps[0].name)}</div><b>${time}</b><div>${ps[0].first}/${ps[0].seen} · ${ps[1].first}/${ps[1].seen}</div><div class="nm">${esc(ps[1].name)}</div>`);
        const b = el(s, 'canvas'); miniBoard(b, ps[1].board, cell, ps[1].alive, ps[1].rank);
      } else {
        ps.forEach(p => { const c = el(s, 'canvas'); miniBoard(c, p.board, cell, p.alive, p.rank); });
        el(s, 'div', 'mid', null, `<b>${time}</b>${ps.map(p => `<div class="nm">${esc(p.name)}</div>`).join('')}`);
      }
      if (m.state !== 'ended') { const x = el(s, 'button', 'x', null, '끝내기'); x.onclick = async () => { if (await confirmBox('이 경기를 지금 점수로 끝내요')) emit('t:endMatch', { id: m.id }); }; }
    });
  }
  setInterval(() => { if (cur$() === 'tDash' && view) renderDashLive(); }, 1000);
  function lessonModal() {
    if (!view) return;
    let sel = view.settings.units.filter(u => u !== 99);
    const L = Object.entries(UNITS).filter(([k]) => k !== '99');
    modal(`<h2>복습할 차시 고르기</h2>
      <div class="mnote" style="margin-top:0">여러 차시를 같이 고를 수 있어요. 아무것도 고르지 않으면 3단원 전체 문제가 나와요.</div>
      <div class="lessons" id="lsGrid">${L.map(([k, u]) => `<button data-u="${k}"><b>${k}차시</b><span>${u.icon} ${u.title}</span></button>`).join('')}</div>
      <div class="mbtns"><button class="pill c" id="lsAll">3단원 전체</button><button class="pill m" id="lsOk">적용</button></div>`, m => {
      const paint = () => m.querySelectorAll('#lsGrid button').forEach(b => b.classList.toggle('on', sel.includes(Number(b.dataset.u))));
      paint();
      m.querySelectorAll('#lsGrid button').forEach(b => b.onclick = () => { const u = Number(b.dataset.u); sel = sel.includes(u) ? sel.filter(x => x !== u) : sel.concat(u); paint(); });
      const send = async units => { const r = await emit('t:settings', { code: cur, settings: { units } }); if (r.err) return toast(r.err); view.settings = r.settings; closeModal(); renderDash(); toast(`복습 범위: ${units.includes(99) ? '3단원 전체' : units.sort((a, b) => a - b).map(u => u + '차시').join(' · ')} — 다음 경기부터 적용돼요.`, 2200); };
      m.querySelector('#lsAll').onclick = () => send([99]);
      m.querySelector('#lsOk').onclick = () => send(sel.length ? sel : [99]);
    });
  }
  function detailModal() {
    if (!view) return;
    const s = view.settings;
    const typeBtns = Object.entries(TYPES).map(([k, l]) => `<button data-t="${k}" class="${s.types.includes(k) ? 'on' : ''}">${l}</button>`).join('');
    modal(`<h2>세부 설정</h2>
      <div class="mrow"><span>3학년 쉬운 모드</span><div class="opts"><button id="mdEz" class="${s.easy ? 'on' : ''}">큰 버튼 4개 · 안개·뒤죽박죽 없음 · AI 천천히</button></div></div>
      <div class="mrow"><span>경기 시간</span><div class="opts" id="mdMin">${[3, 5, 7, 10, 0].map(n => `<button data-v="${n}" class="${s.matchMin === n ? 'on' : ''}">${n ? n + '분' : '데스매치 (한 명이 남을 때까지)'}</button>`).join('')}</div></div>
      <div class="mrow"><span>방해 뿌요 상한</span><div class="opts" id="mdCap">${[[12, '12개(2줄)'], [18, '18개(3줄)'], [30, '30개(5줄)']].map(([n, l]) => `<button data-v="${n}" class="${s.garbageCap === n ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="mrow"><span>남는 학생</span><div class="opts"><button id="mdAi" class="${s.aiFill ? 'on' : ''}">2인전·3인전에서 짝이 없으면 8초 안에 AI와 대결 (점수 반영)</button></div></div>
      <div class="mrow"><span>오답 다시 내기</span><div class="opts"><button id="mdRv" class="${s.review ? 'on' : ''}">첫 시도에 틀린 문제를 3문제 뒤에 한 번 더</button></div></div>
      <div class="mnote">데스매치는 시간 제한 없이 한 명이 남을 때까지 해요 (1분 30초에 피버 타임, 5분이 지나면 공격 2배로 끝을 앞당겨요). 설정은 다음 경기부터 적용돼요. 1인(AI)은 학생이 쉬움·보통·어려움을 직접 고르면 바로 AI 친구와 1:1로 대결해요. 이기면 쉬움 14점·보통 20점·어려움 26점(순위 점수)이 들어가요.</div>
      <div class="mbtns"><button class="pill m" id="mdOk">확인</button></div>`, m => {
      const send = async patch => { const r = await emit('t:settings', { code: cur, settings: patch }); if (r.err) return toast(r.err); view.settings = r.settings; renderDash(); };
      m.querySelectorAll('#mdTypes button').forEach(b => b.onclick = () => { b.classList.toggle('on'); const t = [...m.querySelectorAll('#mdTypes button.on')].map(x => x.dataset.t); if (!t.length) { b.classList.add('on'); return toast('하나 이상 골라 주세요.'); } send({ types: t }); });
      const single = (id, key) => m.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { m.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); send({ [key]: Number(b.dataset.v) }); });
      single('mdMin', 'matchMin'); single('mdCap', 'garbageCap');
      m.querySelector('#mdAi').onclick = e => { e.target.classList.toggle('on'); send({ aiFill: e.target.classList.contains('on') }); };
      m.querySelector('#mdEz').onclick = e => { e.target.classList.toggle('on'); send({ easy: e.target.classList.contains('on') }); };
      m.querySelector('#mdRv').onclick = e => { e.target.classList.toggle('on'); send({ review: e.target.classList.contains('on') }); };
      m.querySelector('#mdOk').onclick = closeModal;
    });
  }

  /* ================= 랭킹 ================= */
  const RS = $('#tRank'); const R = { tab: 'cls', by: 'points', page: 0, data: null, built: false };
  function buildRank() {
    if (R.built) return; R.built = true;
    el(RS, 'div', '', null, '').id = 'trTabs';
    el(RS, 'div', '', null, '').id = 'trHead';
    el(RS, 'div', '', null, '').id = 'trRows';
    el(RS, 'div', 'cover', [110, 733, 356, 800], '', 'background:#020b29;border-radius:16px');
    el(RS, 'div', 'bar', [114, 736, 1556, 798], '').id = 'trBar';
    hot(RS, [90, 830, 305, 905], () => goTab('dash'), '뒤로');
    hot(RS, [1368, 830, 1582, 905], () => goTab('dash'), '닫기');
  }
  async function loadRanking() { buildRank(); const r = await emit('t:ranking', { code: cur, by: R.by }); if (r.err) return toast(r.err); R.data = r; renderRanking(); }
  function renderRanking() {
    const r = R.data; if (!r) return;
    const tabs = [['cls', (view ? view.name : '우리 반'), [312, 137, 643, 207]], ['grade', `${r.gradeNo}학년 전체`, [668, 137, 1003, 207]], ['battle', '반 대항전', [1030, 137, 1360, 207]]];
    $('#trTabs').innerHTML = tabs.map(([k, l, b]) => `<button class="pill ${k === R.tab ? 'm' : 'c'}" data-t="${k}" style="${box([b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4])};font-size:30px">${esc(l)}</button>`).join('');
    $$('#trTabs button').forEach(b => b.onclick = () => { R.tab = b.dataset.t; R.page = 0; renderRanking(); });
    const battle = R.tab === 'battle';
    const rows = R.tab === 'cls' ? r.cls : R.tab === 'grade' ? r.grade : r.battle;
    const head = battle ? ['반', '평균 점수', '정답률'] : ['별명', R.by === 'acc' ? '정답률' : R.by === 'chain' ? '최고 연쇄' : '랭킹 점수', R.by === 'points' ? '정답률' : '랭킹 점수'];
    $('#trHead').innerHTML = [[312, 1000, head[0]], [1012, 1284, head[1]], [1296, 1540, head[2]]].map(([a, b, t]) => `<div class="cover" style="${box([a, 252, b, 302])};background:#00121c;border-radius:0"></div><div class="cell" style="${box([a, 252, b, 302])};font-size:30px">${t}</div>`).join('');
    const per = 6, pages = Math.max(1, Math.ceil(rows.length / per)); R.page = Math.min(R.page, pages - 1);
    const ys = [[318, 370], [386, 438], [454, 506], [521, 571], [583, 631], [641, 689]];
    const vis = rows.slice(R.page * per, R.page * per + per);
    const v1 = x => battle ? x.avgPoints : R.by === 'acc' ? x.acc + '%' : R.by === 'chain' ? x.bestChain : x.points;
    const v2 = x => battle ? x.acc + '%' : R.by === 'points' ? x.acc + '%' : x.points;
    $('#trRows').innerHTML = vis.map((x, i) => {
      const [y0, y1] = ys[i];
      const medal = x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank;
      const name = battle ? `${esc(x.name)} <span class="sm" style="font-size:18px;margin-left:10px">${x.players}/${x.total}명 참여 · ${x.games}경기</span>`
        : `${esc(x.name)}${R.tab === 'grade' ? ` <span style="font-size:18px;color:#9ad8ff;margin-left:8px">${esc(x.cls)}</span>` : ''} <span style="font-size:18px;margin-left:8px;-webkit-text-stroke:0">${(x.titles || []).map(t => t.icon + t.label).join(' ')}</span>`;
      return `<div class="cell" style="${box([132, y0, 302, y1])};font-size:30px">${medal}</div><div class="cell l" style="${box([316, y0, 1000, y1])};font-size:28px">${name}</div>
        <div class="cell y" style="${box([1010, y0, 1284, y1])};font-size:30px">${v1(x)}</div><div class="cell" style="${box([1294, y0, 1540, y1])};font-size:28px">${v2(x)}</div>`;
    }).join('') || `<div class="cell" style="${box([132, 318, 1540, 370])}">${battle ? '같은 학년 반이 두 개 이상이면 반 대항전이 열려요' : '아직 기록이 없어요'}</div>`;
    $('#trBar').innerHTML = `${battle ? '<span class="lab" style="position:static">반 대항전 = 경기에 참여한 학생의 평균 랭킹 점수</span>' : `<span class="lab" style="position:static">정렬</span>${[['points', '랭킹 점수'], ['acc', '정답률'], ['chain', '최고 연쇄']].map(([k, l]) => `<button class="sbtn ${R.by === k ? 'm' : ''}" data-by="${k}">${l}</button>`).join('')}`}
      <span style="flex:1"></span><button class="sbtn" id="trXls">엑셀로 받기</button>
      ${pages > 1 ? `<button class="sbtn" id="trP" ${R.page ? '' : 'disabled'}>◀</button><span>${R.page + 1}/${pages}</span><button class="sbtn" id="trN" ${R.page < pages - 1 ? '' : 'disabled'}>▶</button>` : ''}`;
    $$('#trBar [data-by]').forEach(b => b.onclick = () => { R.by = b.dataset.by; loadRanking(); });
    $('#trXls').onclick = rankXls;
    if (pages > 1) { $('#trP').onclick = () => { R.page--; renderRanking(); }; $('#trN').onclick = () => { R.page++; renderRanking(); }; }
  }
  function xls(sheets, name) {
    if (!window.XLSX) return toast('엑셀 기능을 불러오지 못했어요. 인터넷 연결을 확인하세요.');
    const wb = XLSX.utils.book_new(); sheets.forEach(([n, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n)); XLSX.writeFile(wb, name);
  }
  function rankXls() {
    const r = R.data; if (!r) return;
    const head = ['순위', '별명', '반', '랭킹 점수', '정답률(%)', '첫 시도 정답', '받은 문제', '재도전 정답', '익힌 문제', '연습한 문제', '경기', '승', 'AI전', '최고 연쇄', '최고 연속 정답', '보낸 방해', '게임 점수', '도전 성공', '방어 성공', '칭호'];
    const row = x => [x.rank, x.name, x.cls, x.points, x.acc, x.first, x.seen, x.retry, x.mastered, x.practiced, x.games, x.wins, x.aiGames, x.bestChain, x.bestStreak, x.sent, x.score, x.challengeWins, x.defenses, (x.titles || []).map(t => t.label).join(' ')];
    xls([['반 랭킹', [head].concat(r.cls.map(row))], ['학년 랭킹', [head].concat(r.grade.map(row))],
      ['반 대항전', [['순위', '반', '평균 랭킹 점수', '정답률(%)', '참여 학생', '전체 학생', '경기 수', '2연쇄 이상', '최고 연쇄']].concat(r.battle.map(x => [x.rank, x.name, x.avgPoints, x.acc, x.players, x.total, x.games, x.chains2, x.bestChain]))]], `사이언스뿌요팡_랭킹_${today()}.xlsx`);
  }

  /* ================= 문제 관리 ================= */
  const QS = $('#tQuest'); const Q = { list: [], unit: '', type: '', search: '', page: 0, sel: null, built: false };
  const QHEAD = ['차시(1~9)', '유형(비워 두면 사진 퀴즈)', '문제', '정답', '오답1', '오답2', '오답3', '설명'];
  const SUBTABS = [[128, 437], [452, 728], [742, 1025], [1040, 1305], [1318, 1597]];
  function buildQuest() {
    if (Q.built) return; Q.built = true;
    tabHots(QS, [115, 175], SUBTABS);
    el(QS, 'div', '', null, '').id = 'qUnits';
    hot(QS, [1138, 203, 1375, 258], () => xls([['문제', [QHEAD,
      [2, '', '작은북을 세게 치면 어떤 소리가 나나요?', '큰 소리', '작은 소리', '높은 소리', '소리가 안 나요', '북을 세게 칠수록 큰 소리가 나요.'],
      [3, '', '실로폰에서 짧은 음판을 치면 어떤 소리가 나나요?', '높은 소리', '낮은 소리', '작은 소리', '소리가 안 나요', '음판이 짧을수록 높은 소리가 나요.'],
      [8, '', '도로 옆에 방음벽을 세우는 까닭은?', '소음을 줄이려고', '소리를 크게 하려고', '빛을 막으려고', '바람을 막으려고', '방음벽은 소리가 전달되는 것을 막아 소음을 줄여요.']]]], '사이언스뿌요팡_문제_양식.xlsx'), '양식 받기');
    hot(QS, [1392, 203, 1640, 258], () => $('#fileQ').click(), '문제 올리기');
    el(QS, 'div', '', null, '').id = 'qRows';
    el(QS, 'div', 'pv', [1078, 326, 1642, 576], '<div class="ask">왼쪽 표에서 문제를 누르면 학생 화면처럼 보여요</div>').id = 'qPv';
    el(QS, 'div', 'ans', [1072, 660, 1648, 782], '').id = 'qAns';
    el(QS, 'div', 'bar', [28, 812, 1394, 872], '').id = 'qBar';
    hot(QS, [1420, 808, 1652, 875], () => goTab('dash'), '닫기');
  }
  async function loadQuestions() { buildQuest(); const r = await emit('t:questions'); if (r.err) return toast(r.err); Q.list = r.list; renderQ(); }
  function filteredQ() {
    const s = Q.search.trim().toLowerCase();
    return Q.list.filter(q => (!Q.unit || String(q.unit) === Q.unit) && (!Q.type || q.type === Q.type) && (!s || JSON.stringify([q.q, q.choices, q.answer, q.exp]).toLowerCase().includes(s)));
  }
  const qText = q => q.type === 'picture' ? `${q.pic || ''} ${q.q || ''}` : q.q;
  const qAns = q => q.type === 'order' ? q.answer : (q.choices || [])[0];
  function renderQ() {
    const U = [['', '전체']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), n + '차시']));
    $('#qUnits').innerHTML = `<div class="cover" style="${box([30, 196, 958, 264])};background:#020b29;border-radius:14px"></div>` + U.map(([v, l], i) => { const x0 = 34 + i * 92; return `<button class="pill ${v === Q.unit ? 'm' : 'c'}" data-u="${v}" style="${box([x0, 198, x0 + 90, 262])};font-size:21px">${l}</button>`; }).join('');
    $$('#qUnits [data-u]').forEach(b => b.onclick = () => { Q.unit = b.dataset.u; Q.page = 0; renderQ(); });
    const list = filteredQ(), per = 5, pages = Math.max(1, Math.ceil(list.length / per)); Q.page = Math.min(Q.page, pages - 1);
    const ys = [[392, 463], [467, 538], [542, 613], [617, 688], [692, 763]];
    const vis = list.slice(Q.page * per, Q.page * per + per);
    $('#qRows').innerHTML = vis.map((q, i) => { const [y0, y1] = ys[i]; return `
      <button class="rowHit ${Q.sel === q.id ? 'sel' : ''}" data-id="${q.id}" style="${box([168, y0, 1026, y1])}"></button>
      <button class="tog ${q.off ? '' : 'on'}" data-tog="${q.id}" style="left:72px;top:${(y0 + y1) / 2 - 17}px"></button>
      <div class="cell sm" style="${box([168, y0, 368, y1])};pointer-events:none">${unitName(q.unit)}</div>
      <div class="cell sm" style="${box([372, y0, 564, y1])};pointer-events:none">${TYPES[q.type] || q.type}${q.custom ? ' ✎' : ''}</div>
      <div class="cell sm l" style="${box([570, y0, 1026, y1])};pointer-events:none;${q.off ? 'opacity:.4;text-decoration:line-through' : ''}">${esc(qText(q)).replace(/\n/g, ' ')}</div>`; }).join('') || `<div class="cell sm" style="${box([44, 392, 1026, 463])}">조건에 맞는 문제가 없어요</div>`;
    $$('#qRows [data-id]').forEach(b => b.onclick = () => { Q.sel = b.dataset.id; renderQ(); });
    $$('#qRows [data-tog]').forEach(b => b.onclick = async () => { const q = Q.list.find(x => x.id === b.dataset.tog); q.off = !q.off; await emit('t:toggleQ', { id: q.id, off: q.off }); renderQ(); });
    const sel = Q.list.find(x => x.id === Q.sel);
    if (sel) {
      const chs = sel.type === 'order' ? '' : `<div class="chs">${(sel.choices || []).map((c, i) => `<span class="${i === 0 ? 'ok' : ''}">${esc(c)}</span>`).join('')}</div>`;
      $('#qPv').innerHTML = `${sel.img ? `<img class="pvImg" src="${esc(sel.img)}" alt="">` : ''}<div class="ask">${esc(TYPES[sel.type] || '')} · ${unitName(sel.unit)}</div><div class="q ${sel.type === 'picture' ? 'pic' : ''}" style="${(sel.q || '').length > 40 ? 'font-size:22px' : ''}">${esc(sel.type === 'picture' ? sel.pic : sel.q)}</div>${chs}`;
      $('#qAns').innerHTML = `<b>${esc(qAns(sel))}</b><span>${esc(sel.exp || '')}</span>${sel.custom ? '<span><button class="sbtn m" id="qDel" style="height:36px;margin-top:4px">이 문제 지우기</button></span>' : ''}`;
      const d = $('#qDel'); if (d) d.onclick = async () => { if (!await confirmBox('올린 문제를 지워요')) return; await emit('t:deleteQ', { id: sel.id }); Q.sel = null; loadQuestions(); };
    } else { $('#qPv').innerHTML = '<div class="ask">왼쪽 표에서 문제를 누르면 학생 화면처럼 보여요</div>'; $('#qAns').innerHTML = ''; }
    const offN = list.filter(q => q.off).length;
    $('#qBar').innerHTML = `<select id="qType"><option value="">모든 유형</option>${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${Q.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input type="search" id="qSearch" placeholder="문제·정답 검색" value="${esc(Q.search)}">
      <button class="sbtn" id="qP" ${Q.page ? '' : 'disabled'}>◀</button><span>${Q.page + 1}/${pages}</span><button class="sbtn" id="qN" ${Q.page < pages - 1 ? '' : 'disabled'}>▶</button>
      <span class="lab" style="position:static;font-size:17px">${list.length}문제 · 끈 문제 ${offN}</span><span style="flex:1"></span>
      <button class="sbtn" id="qOn">모두 켜기</button><button class="sbtn" id="qOff">모두 끄기</button><button class="sbtn" id="qExp">내보내기</button>`;
    $('#qType').onchange = e => { Q.type = e.target.value; Q.page = 0; renderQ(); };
    $('#qSearch').oninput = e => { Q.search = e.target.value; Q.page = 0; clearTimeout(Q.st); Q.st = setTimeout(() => { renderQ(); const s = $('#qSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); };
    $('#qP').onclick = () => { Q.page--; renderQ(); }; $('#qN').onclick = () => { Q.page++; renderQ(); };
    $('#qOn').onclick = async () => { await emit('t:toggleQ', { ids: filteredQ().map(q => q.id), off: false }); loadQuestions(); };
    $('#qOff').onclick = async () => { const ids = filteredQ().map(q => q.id); if (!await confirmBox(`보이는 ${ids.length}문제를 모두 꺼요`)) return; await emit('t:toggleQ', { ids, off: true }); loadQuestions(); };
    $('#qExp').onclick = () => xls([['문제', [QHEAD].concat(Q.list.map(q => [q.unit, TYPES[q.type], q.type === 'picture' ? q.pic : q.q, qAns(q), ...(q.type === 'order' ? ['', '', ''] : (q.choices || []).slice(1)), q.exp || '']))]], '사이언스뿌요팡_전체문제.xlsx');
  }
  $('#fileQ').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!window.XLSX) return note('uperr', '엑셀 기능을 불러오지 못했어요.');
    let rows; try { const wb = XLSX.read(await f.arrayBuffer()); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); } catch (er) { return note('uperr', '파일을 읽지 못했어요.'); }
    const body = rows.slice(1).filter(r => r.some(c => String(c).trim())).map(r => ({ unit: r[0], type: r[1], q: r[2], answer: r[3], w1: r[4], w2: r[5], w3: r[6], exp: r[7] }));
    const replace = Q.list.some(q => q.custom) && await confirmBox('전에 올린 문제를 지우고 새로 올릴까요? (취소하면 더해요)');
    const res = await emit('t:addQuestions', { rows: body, replace });
    if (res.err) return note('uperr', res.err);
    if (res.errors && res.errors.length && !res.added) note('uperr', res.errors.slice(0, 2).join(' / '));
    else note('upload', `${res.added}문제를 추가했어요${res.errors && res.errors.length ? ` · 못 넣은 줄 ${res.errors.length}개` : ''}`);
    loadQuestions();
  };

  /* ================= 기록 ================= */
  const RC = $('#tRec'); const RCs = { data: null, page: 0, wpage: 0, built: false };
  function buildRec() {
    if (RCs.built) return; RCs.built = true;
    tabHots(RC, [115, 175], SUBTABS);
    ['rcN', 'rcG', 'rcA', 'rcL'].forEach((id, i) => { el(RC, 'div', 'dataTx c', [[240, 205, 404, 260], [636, 205, 796, 260], [1052, 205, 1206, 260], [1456, 205, 1628, 260]][i], '', 'font-family:var(--fe);font-weight:700;font-size:32px;color:var(--ye)').id = id; });
    el(RC, 'div', '', null, '').id = 'rcRows';
    el(RC, 'div', '', null, '').id = 'rcWrong';
    el(RC, 'div', 'bar', [28, 812, 804, 872], '').id = 'rcBar';
    hot(RC, [826, 808, 1113, 875], () => recXls('stu'), '학생 기록 받기');
    hot(RC, [1130, 808, 1405, 875], () => recXls('match'), '경기 기록 받기');
    hot(RC, [1422, 808, 1652, 875], () => goTab('dash'), '닫기');
  }
  async function loadRecords() { buildRec(); const r = await emit('t:records', { code: cur }); if (r.err) return toast(r.err); RCs.data = r; renderRec(); }
  function renderRec() {
    const r = RCs.data; if (!r) return;
    const st = r.students, played = st.filter(x => x.seen > 0);
    const matches = new Set(r.results.map(x => x.match)).size;
    $('#rcN').textContent = `${played.length}/${st.length}`;
    $('#rcG').textContent = matches;
    $('#rcA').textContent = played.length ? Math.round(played.reduce((a, x) => a + x.acc, 0) / played.length) + '%' : '-';
    $('#rcL').textContent = st.reduce((a, x) => a + (x.mastered || 0), 0);
    const per = 5, pages = Math.max(1, Math.ceil(st.length / per)); RCs.page = Math.min(RCs.page, pages - 1);
    const ys = [[440, 503], [507, 566], [570, 631], [635, 695], [699, 758]];
    const cols = [[44, 238], [242, 432], [437, 618], [622, 816], [820, 1028]];
    $('#rcRows').innerHTML = st.slice(RCs.page * per, RCs.page * per + per).map((x, i) => {
      const [y0, y1] = ys[i]; const v = [esc(x.name), x.acc + '%', `${x.games}<span style="font-size:16px">(${x.wins}승)</span>`, x.bestChain, `${x.mastered}<span style="font-size:16px">/${x.practiced}</span>`];
      return cols.map(([a, b], k) => `<div class="cell ${k === 0 ? '' : 'y'}" style="${box([a, y0, b, y1])};font-size:${k === 0 ? 24 : 26}px">${v[k]}</div>`).join('');
    }).join('') || `<div class="cell sm" style="${box([44, 440, 1028, 503])}">아직 학생이 없어요</div>`;
    const wp = 4, wpages = Math.max(1, Math.ceil(r.wrongTop.length / wp)); RCs.wpage = Math.min(RCs.wpage, wpages - 1);
    const wy = [[384, 458], [482, 556], [580, 654], [678, 752]];
    $('#rcWrong').innerHTML = r.wrongTop.slice(RCs.wpage * wp, RCs.wpage * wp + wp).map((w, i) => `<div class="wrongRow" style="${box([1090, wy[i][0], 1630, wy[i][1]])}"><span class="n">${w.n}</span><span class="t">${esc(w.text).replace(/\n/g, ' ')}<br><small style="color:#9ac">${unitName(w.unit)} · ${esc(w.type)}</small></span><span class="a">${esc(w.answer)}</span></div>`).join('')
      || `<div class="wrongRow" style="${box([1090, 384, 1630, 458])}">아직 틀린 문제가 없어요</div>`;
    $('#rcBar').innerHTML = `<span class="lab" style="position:static">학생</span><button class="sbtn" id="rcP" ${RCs.page ? '' : 'disabled'}>◀</button><span>${RCs.page + 1}/${pages}</span><button class="sbtn" id="rcNx" ${RCs.page < pages - 1 ? '' : 'disabled'}>▶</button>
      <span style="flex:1"></span><span class="lab" style="position:static">많이 틀린 문제</span><button class="sbtn" id="rwP" ${RCs.wpage ? '' : 'disabled'}>◀</button><span>${RCs.wpage + 1}/${wpages}</span><button class="sbtn" id="rwN" ${RCs.wpage < wpages - 1 ? '' : 'disabled'}>▶</button>`;
    $('#rcP').onclick = () => { RCs.page--; renderRec(); }; $('#rcNx').onclick = () => { RCs.page++; renderRec(); };
    $('#rwP').onclick = () => { RCs.wpage--; renderRec(); }; $('#rwN').onclick = () => { RCs.wpage++; renderRec(); };
  }
  function recXls(kind) {
    const r = RCs.data; if (!r) return; const name = (view && view.name) || cur;
    if (kind === 'stu') xls([
      ['학생별 요약', [['순위', '별명', '랭킹 점수', '정답률(%)', '첫 시도 정답', '재도전 정답', '받은 문제', '익힌 문제', '연습한 문제', '경기', '승', 'AI전', '최고 연쇄', '최고 연속 정답', '보낸 방해', '게임 점수']].concat(r.students.map(x => [x.rank, x.name, x.points, x.acc, x.first, x.retry, x.seen, x.mastered, x.practiced, x.games, x.wins, x.aiGames, x.bestChain, x.bestStreak, x.sent, x.score]))],
      ['많이 틀린 문제', [['틀린 횟수', '차시', '유형', '문제', '정답']].concat(r.wrongTop.map(w => [w.n, unitName(w.unit), w.type, w.text, w.answer]))]], `사이언스뿌요팡_${name}_학생기록_${today()}.xlsx`);
    else xls([['경기 기록', [['시각', '별명', '방식', 'AI 난이도', 'AI 경기', '순위', '상대', '차시', '첫 시도 정답', '재도전 정답', '틀린 시도', '받은 문제', '익힌 문제', '최고 연쇄', '최고 연속 정답', '이벤트', '보낸 방해', '게임 점수', '랭킹 점수', '랭킹전', '랭킹전 보너스']].concat(r.results.map(x => [new Date(x.at).toLocaleString('ko-KR'), x.name, x.mode === 3 ? '3인전' : x.mode === 1 ? '1인(AI)' : '2인전', x.level || '', x.vsAI ? 'O' : '', x.rank, x.opp, x.units, x.first, x.retry, x.wrongTries, x.seen, x.learned || 0, x.maxChain, x.bestStreak || 0, x.events || 0, x.sent, x.score, x.points, x.ranked || '', x.bonus || 0]))]], `사이언스뿌요팡_${name}_경기기록_${today()}.xlsx`);
  }

  /* ================= 반 설정 ================= */
  const CS = $('#tCls'); const C = { sel: null, built: false };
  function buildCls() {
    if (C.built) return; C.built = true;
    tabHots(CS, [115, 175], SUBTABS);
    el(CS, 'input', 'fld', [352, 296, 950, 364]).id = 'csName';
    $('#csName').maxLength = 16; $('#csName').style.fontSize = '32px';
    const g = el(CS, 'select', 'fld', [352, 396, 900, 456], '<option value="6">6학년</option><option value="5">5학년</option><option value="4">4학년</option><option value="3">3학년</option>');
    g.id = 'csGrade'; g.style.fontSize = '30px';
    el(CS, 'div', 'dataTx dark', [352, 488, 950, 552], '', 'font-family:var(--fe);font-weight:700;font-size:38px;letter-spacing:6px;padding-left:26px').id = 'csCode';
    hot(CS, [342, 585, 705, 652], async () => { const r = await emit('t:renameClass', { code: cur, name: $('#csName').value, grade: $('#csGrade').value }); if (r.err) return toast(r.err); classes = r.classes; const v = await emit('t:open', { code: cur }); view = v.view; note('saved', '', 1800); }, '이름 저장');
    hot(CS, [127, 790, 508, 852], async () => { if (!await confirmBox(`${view.name}의 경기 기록과 랭킹 점수를 모두 지워요`)) return; await emit('t:resetRecords', { code: cur }); note('saved', '기록을 지웠어요', 1800); }, '기록 초기화');
    hot(CS, [575, 790, 930, 852], async () => {
      if (!await confirmBox(`${view.name}을(를) 삭제해요. 학생 명단과 기록이 모두 지워져요`)) return;
      const r = await emit('t:deleteClass', { code: cur }); classes = r.classes || []; cur = null; view = null;
      if (classes[0]) await openClass(classes[0].code); goTab('dash');
    }, '반 삭제');
    el(CS, 'div', 'stuList', [1060, 282, 1618, 640]).id = 'csList';
    hot(CS, [1148, 668, 1530, 738], async () => {
      const s = view && view.students.find(x => x.id === C.sel); if (!s) return toast('목록에서 학생을 먼저 골라 주세요.');
      if (!await confirmBox(`${s.name} 학생을 명단과 기록에서 지워요 (이름을 잘못 적었을 때)`)) return;
      const r = await emit('t:kick', { code: cur, id: s.id, remove: true }); if (r.err) return toast(r.err); C.sel = null; toast('내보냈어요.');
    }, '학생 내보내기');
    hot(CS, [1420, 808, 1652, 875], () => goTab('dash'), '닫기');
  }
  function renderCls(full) {
    buildCls(); if (!view) return;
    if (full) { $('#csName').value = view.name; $('#csGrade').value = view.grade; }
    $('#csCode').textContent = view.code;
    $('#csList').innerHTML = view.students.map(s => `<button data-id="${s.id}" class="${C.sel === s.id ? 'sel' : ''}"><i class="dot ${s.online ? s.status : 'off'}"></i>${esc(s.name)}<small>${s.points}점 · ${s.games}경기 · ${s.acc}%</small></button>`).join('') || '<span class="lab" style="position:static">아직 학생이 없어요</span>';
    $$('#csList button').forEach(b => b.onclick = () => { C.sel = b.dataset.id; renderCls(); });
  }

  /* ================= TV 모니터 ================= */
  const TV = $('#tTV'); const V = { page: 0, auto: true, built: false, step: 0, rank: null, scope: 'cls', timer: null };
  function buildTV() {
    if (V.built) return; V.built = true;
    el(TV, 'div', 'dataTx c', [186, 32, 470, 92], '', 'font-size:30px').id = 'tvCls';
    el(TV, 'div', 'dataTx c', [1206, 32, 1492, 92], '', 'font-size:28px').id = 'tvCode';
    el(TV, 'div', '', null, '').id = 'tvMatches';
    el(TV, 'div', '', null, '').id = 'tvRanks';
    ['tvJoin', 'tvPlay', 'tvDone'].forEach((id, i) => { el(TV, 'div', 'dataTx c', [[1076, 700, 1214, 764], [1254, 700, 1390, 764], [1430, 700, 1564, 764]][i], '', 'font-family:var(--fe);font-weight:700;font-size:34px;color:var(--ye)').id = id; });
    hot(TV, [92, 830, 342, 904], () => { V.page = Math.max(0, V.page - 1); V.auto = false; renderTV(); }, '이전 경기');
    hot(TV, [398, 830, 652, 904], () => { V.auto = !V.auto; renderTV(); toast(V.auto ? '경기 화면을 자동으로 넘겨요' : '자동 넘김을 껐어요', 1400); }, '자동 넘김');
    el(TV, 'img', 'at', [392, 822, 658, 912], null, 'pointer-events:none').id = 'tvAutoOn'; $('#tvAutoOn').src = 'img/tb_auto_on.webp';
    hot(TV, [710, 830, 962, 904], () => { V.page++; V.auto = false; renderTV(); }, '다음 경기');
    hot(TV, [1020, 830, 1272, 904], () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen(); }, '전체 화면');
    hot(TV, [1330, 830, 1584, 904], () => { clearInterval(V.timer); show('tDash'); renderDash(true); }, '닫기');
  }
  function openTV() { buildTV(); show('tTV'); V.page = 0; V.step = 0; tvRank(); clearInterval(V.timer); V.timer = setInterval(() => { if (cur$() !== 'tTV') return clearInterval(V.timer); tvRank(); if (V.auto) { V.page++; } renderTV(); }, 10000); renderTV(); }
  async function tvRank() {
    const r = await emit('t:ranking', { code: cur, by: 'points' }); if (r.err) return;
    const scopes = ['cls', 'grade', 'battle'].filter(s => s !== 'battle' || r.battle.length >= 2).filter(s => s !== 'grade' || r.grade.length > r.cls.length);
    V.scope = scopes[V.step++ % scopes.length]; V.rank = r; renderTVRank();
  }
  function renderTVRank() {
    const r = V.rank; if (!r) return;
    const ys = [[238, 292], [301, 354], [364, 416], [427, 478], [489, 540], [551, 602]];
    const medal = n => ['🥇', '🥈', '🥉'][n - 1] || n;
    let rows;
    if (V.scope === 'battle') rows = r.battle.slice(0, 6).map(x => [medal(x.rank), `${esc(x.name)} <small>정답률 ${x.acc}%</small>`, `평균 ${x.avgPoints}`]);
    else rows = (V.scope === 'cls' ? r.cls : r.grade).filter(x => x.games || x.seen).slice(0, 6).map(x => [medal(x.rank), `${esc(x.name)}${V.scope === 'grade' ? ` <small>${esc(x.cls)}</small>` : ''} <small>${(x.titles || []).map(t => t.icon).join('')}</small>`, x.points]);
    $('#tvRanks').innerHTML = rows.map((x, i) => `<div class="tvRank" style="${box([1078, ys[i][0], 1558, ys[i][1]])}"><span class="r">${x[0]}</span><span>${x[1]}</span><span class="v">${x[2]}</span></div>`).join('') || `<div class="tvRank" style="${box([1078, 238, 1558, 292])};font-size:22px">첫 경기가 끝나면 순위가 나와요</div>`;
    $('#tvCls').textContent = V.scope === 'cls' ? `${view ? view.name : ''} 랭킹` : V.scope === 'grade' ? `${r.gradeNo}학년 전체 랭킹` : '반 대항전';
  }
  function renderTV() {
    if (cur$() !== 'tTV' || !view) return;
    if (!V.rank) $('#tvCls').textContent = view.name; $('#tvCode').textContent = `입장 코드 ${view.code}`;
    $('#tvAutoOn').style.display = V.auto ? 'block' : 'none';
    const ms = view.matches.filter(m => m.state !== 'ended');
    const pages = Math.max(1, Math.ceil(ms.length / 4)); V.page = ((V.page % pages) + pages) % pages;
    const vis = ms.slice(V.page * 4, V.page * 4 + 4);
    const st = view.students;
    $('#tvJoin').textContent = st.filter(x => x.online).length;
    $('#tvPlay').textContent = st.filter(x => x.online && x.status === 'playing').length;
    $('#tvDone').textContent = Math.round(st.reduce((a, x) => a + (x.games || 0), 0) / (view.settings.mode === 3 ? 3 : view.settings.mode === 1 ? 1 : 2));
    const wrap = $('#tvMatches'); wrap.innerHTML = '';
    vis.forEach((m, i) => {
      const dx = (i % 2) * 459, dy = Math.floor(i / 2) * 320;
      const time = m.state === 'countdown' ? '준비' : (m.paused ? '⏸ ' : m.sprint ? '⚡ ' : m.fever ? '🔥 ' : '') + (m.death ? '∞ ' + mmss(m.elapsed || 0) : mmss(m.left));
      el(wrap, 'div', 'dataTx c', [236 + dx, 164 + dy, 446 + dx, 196 + dy], `${m.ranked ? `⚔ 랭킹전 ${m.ranked.cPos}위→${m.ranked.dPos}위` : m.players.length === 3 ? '3인전' : m.players.some(p => p.bot) ? '2인전 · AI' : '2인전'} · ${time}`, 'font-size:20px');
      if (m.players.length === 2) {
        m.players.forEach((p, k) => {
          const nx = k ? 378 : 168;
          el(wrap, 'div', 'dataTx c', [nx - 8 + dx, 206 + dy, nx + 140 + dx, 234 + dy], `${esc(p.name)} <span style="color:#ffe23a;font-size:14px;margin-left:4px">${p.first}/${p.seen}${p.streak >= 2 ? ' 🔥' + p.streak : ''}</span>`, 'font-size:17px;-webkit-text-stroke:3px #020a1c');
          const bx = k ? 366 : 148;
          const b = el(wrap, 'div', 'tvBoard', [bx + dx, 242 + dy, bx + 164 + dx, 440 + dy]);
          const c = el(b, 'canvas'); miniBoard(c, p.board, 16, p.alive, p.rank);
        });
      } else {
        el(wrap, 'div', 'tvCover', [140 + dx, 200 + dy, 536 + dx, 446 + dy]);
        const t = el(wrap, 'div', 'tv3', [140 + dx, 200 + dy, 536 + dx, 446 + dy]);
        m.players.forEach(p => { const d = el(t, 'div', 'p', null, `<span>${esc(p.name)}</span>`); const c = el(d, 'canvas'); d.insertBefore(c, d.firstChild); miniBoard(c, p.board, 15, p.alive, p.rank); });
      }
    });
    if (!vis.length) el(wrap, 'div', 'empty', [130, 280, 1000, 340], '진행 중인 경기가 없어요', 'font-size:28px');
  }

  J.ready(() => { if (view) renderDash(true); });
})();
