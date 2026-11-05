/* 사이언스 뿌요 팡! — 학생 화면 (네온 시안) · 3학년 과학 3단원 〈소리의 성질〉 */
(() => {
  const E = window.PuyoEngine, J = window.Jelly;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const socket = io({ transports: ['websocket', 'polling'] });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasKo = s => /[가-힣]/.test(String(s || ''));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const emit = (ev, data) => new Promise(res => { let done = false; socket.emit(ev, data || {}, r => { done = true; res(r || {}); }); setTimeout(() => { if (!done) res({ err: '연결이 느려요.' }); }, 8000); });
  const STORE = 'puyoPang.v1';
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { }
  const store = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) { } };
  const box = (x0, y0, x1, y1) => `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
  const UNIT_SHORT = { 1: '소리가 나는 물체', 2: '소리의 세기', 3: '소리의 높낮이', 4: '세기·높낮이 비교', 5: '공기로 전달', 6: '물·고체로 전달', 7: '실 전화기·소리 체험', 8: '소음 줄이기', 9: '소리 예술가·자율 주행', 99: '3단원 전체' };
  const unitName = u => Number(u) === 99 ? '3단원 전체' : u + '차시';
  const unitsLabel = us => { us = (us || []).map(Number); return us.includes(99) || us.length >= 9 ? '3단원 전체' : us.length === 1 ? `${us[0]}차시 ${UNIT_SHORT[us[0]] || ''}` : us.sort((a, b) => a - b).map(u => u + '차시').join(' · '); };

  /* ---------- 소리 ---------- */
  let AC = null, soundOn = saved.sound !== false;
  function tone(f, d = .12, type = 'sine', vol = .16, delay = 0) {
    if (!soundOn) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) { }
  }
  const SFX = {
    good: () => { tone(660, .1, 'triangle'); tone(880, .1, 'triangle', .16, .09); tone(1320, .18, 'triangle', .14, .18); },
    bad: () => { tone(220, .18, 'square', .08); tone(180, .22, 'square', .07, .12); },
    move: () => tone(420, .04, 'triangle', .06),
    rot: () => tone(560, .05, 'triangle', .07),
    drop: () => tone(150, .1, 'sine', .25),
    pop: ch => { const f = 480 * Math.pow(1.13, ch); tone(f, .12, 'triangle', .2); tone(f * 1.5, .14, 'sine', .12, .05); },
    garbage: () => { tone(110, .2, 'sawtooth', .07); tone(90, .25, 'sawtooth', .06, .08); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'triangle', .16, i * .12)),
    star: () => tone(1500, .12, 'sine', .1),
    count: hi => tone(hi ? 1046 : 660, .18, 'square', .09),
  };
  function syncSound() { $$('.sndBtn').forEach(b => b.textContent = soundOn ? '🔊' : '🔇'); }
  $$('.sndBtn').forEach(b => b.onclick = () => { soundOn = !soundOn; saved.sound = soundOn; store(); syncSound(); });
  syncSound();

  /* ---------- 화면 전환 ---------- */
  let backTo = 'sTitle';
  function show(id) { $$('.scr').forEach(s => s.classList.toggle('on', s.id === id)); if (id === 'sGame') setTimeout(layoutGame, 20); }
  const cur = () => ($('.scr.on') || {}).id;
  let toastT = null;
  function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
  function fullScreen() { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen && matchMedia('(pointer:coarse)').matches) d.requestFullscreen().catch(() => { }); }

  /* ---------- 첫 화면 · 게임 방법 ---------- */
  $('#tStart').onclick = () => { fullScreen(); show('sEntry'); setTimeout(() => ($('#inCode').value ? $('#inName') : $('#inCode')).focus(), 50); };
  $('#tHow').onclick = () => openHow('sTitle');
  $('#tTeacher').onclick = () => { location.href = 'teacher.html'; };
  function openHow(from) { backTo = from; $('#sHow').classList.remove('p2'); renderEvents(); show('sHow'); }
  $('#hBack').onclick = () => show(backTo);
  $('#hNext').onclick = () => $('#sHow').classList.add('p2');
  $('#h2Back').onclick = () => $('#sHow').classList.remove('p2');
  $('#h2Ok').onclick = () => show(backTo);
  const EVENTS = [
    ['fog', '', '3연속 정답 <em>안개</em>', '상대의 다음 뿌요 미리보기와 판 윗부분이 가려져요'],
    ['reverse', 'm', '5연속 <em>뒤죽박죽</em>', '상대가 다음 뿌요를 옮길 때 ◀ ▶가 반대로!'],
    ['bomb', 'm', '7연속 <em>방해 폭탄</em>', '상대에게 방해 뿌요 6개'],
    ['king', 'y', '10연속 <em>과학왕</em>', '방해 뿌요 12개 + 내게 오던 방해 뿌요 모두 사라짐'],
    ['shield', '', '<em>방어막</em>', '3연속 이상 맞히는 중이면 안개·뒤죽박죽을 막아요'],
    ['golden', 'y', '<em>황금 문제</em>', '첫 시도에 맞히면 별 +2, 상대에게 방해 뿌요 3개'],
    ['fever', 'y', '<em>피버 타임</em>', '경기 중간 30초 · 정답 별 2개 · 공격 1.5배'],
    ['sprint', '', '<em>막판 스퍼트</em>', '마지막 1분 · 연쇄 공격 2배'],
    ['comeback', '', '<em>역전 찬스</em>', '판이 9줄 넘게 차면 정답마다 방해 뿌요 6개 제거'],
  ];
  function renderEvents() {
    let ez = false; try { ez = !!(ME && ME.easy); } catch (e) { /* 아직 입장 전 */ }
    $('#evGrid').innerHTML = EVENTS.filter(e => !ez || !['fog', 'reverse', 'shield'].includes(e[0])).map(([i, c, t, d]) => `<div class="evc ${c}"><img src="img/i_${i}.webp" alt=""><div><b>${t}</b><span>${d}</span></div></div>`).join('');
  }
  renderEvents();

  /* ---------- 입장 ---------- */
  let ME = null;
  if (saved.code) $('#inCode').value = saved.code;
  if (saved.name) $('#inName').value = saved.name;
  const qs = new URLSearchParams(location.search); if (qs.get('code')) $('#inCode').value = qs.get('code');
  async function join(auto) {
    const code = $('#inCode').value.trim(), name = $('#inName').value.trim();
    if (!auto && (!code || !name)) { $('#entryErr').textContent = '입장 코드와 별명을 적어 주세요.'; return; }
    const r = await emit('join', auto ? { code: saved.code, token: saved.token } : { code, name, token: saved.code === code && saved.name === name ? saved.token : null });
    if (r.err) { if (!auto) $('#entryErr').textContent = r.err; return; }
    $('#entryErr').textContent = '';
    saved.code = r.view.code; saved.token = r.token; saved.name = r.view.name; store();
    onState(r.view);
  }
  $('#eJoin').onclick = () => join(false);
  $('#eBack').onclick = () => show('sTitle');
  $('#inCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#inName').focus(); });
  $('#inName').addEventListener('keydown', e => { if (e.key === 'Enter') join(false); });
  let wasConnected = false;
  socket.on('connect', () => { wasConnected = true; hideStatus('conn'); if (saved.token && saved.code) join(true); });
  socket.on('disconnect', () => { if (ME) showStatus('conn'); });
  socket.on('kicked', msg => { saved.token = null; store(); ME = null; show('sEntry'); $('#entryErr').textContent = msg || '다시 들어와 주세요.'; });

  /* ---------- 상태 알림(일시정지·연결·탈락·종료) ---------- */
  const STATUS = {
    pause: { img: 'm_pause' }, conn: { img: 'm_conn' },
    ko: { img: 'm_ko', btn: [177, 182, 449, 248], act: () => openReview(localWrongs(), 'sGame') },
    end: { img: 'm_end', btn: [172, 180, 448, 248], act: () => goResult() },
  };
  let statusNow = null;
  function showStatus(k) {
    const s = STATUS[k]; statusNow = k;
    $('#stImg').src = `img/${s.img}.webp`; $('#stCard').style.width = '620px';
    const b = $('#stBtn');
    if (s.btn) { b.style.cssText = box(...s.btn); b.style.display = ''; b.onclick = () => { hideStatus(); s.act(); }; } else b.style.display = 'none';
    $('#ovStatus').classList.add('on');
  }
  function hideStatus(k) { if (k && statusNow !== k) return; statusNow = null; $('#ovStatus').classList.remove('on'); }

  /* ---------- 대기실 ---------- */
  let resultShown = false, lastRankMode = false;
  socket.on('state', onState);
  function onState(v) {
    ME = v;
    const c = cur();
    if ((v.status === 'playing' || v.status === 'practice') && v.matchId) {
      if (G.matchId !== v.matchId) startGameView(v.matchId);
      if (c !== 'sGame' && !(c === 'sResult' && G.endPending)) { show('sGame'); }
    } else if (c === 'sTitle' || c === 'sEntry' || (c === 'sGame' && !G.endPending)) {
      G.matchId = null; renderLobby(); show('sLobby');
    }
    ME.autoAt = v.autoIn != null ? Date.now() + v.autoIn : null;
    const rankOn = v.rankMode && !lastRankMode; lastRankMode = !!v.rankMode;
    if (rankOn && (cur() === 'sLobby') && v.status !== 'playing') { CHL.start = null; CHL.from = 'sLobby'; show('sChal'); }
    if (!v.rankMode && cur() === 'sChal') { renderLobby(); show('sLobby'); }
    if (cur() === 'sLobby') renderLobby();
    if (cur() === 'sChal') renderChal();
    if (cur() === 'sResult') renderResultBar();
  }
  function rankLine(r) { return r ? `우리 반 ${r.cls}등 · ${r.points}점${r.grade && r.gradeOf > r.clsOf ? ` · 학년 ${r.grade}등` : ''}` : '첫 경기를 하면 순위가 생겨요'; }
  function renderLobby() {
    if (!ME) return;
    const three = ME.mode === 3, solo = ME.mode === 1;
    Stage.setBg($('#sLobby'), three ? 's_lobby_3p' : 's_lobby_1v1');
    const tg = $('#lbTag'); tg.style.cssText = three ? 'left:650px;top:208px;width:370px;height:60px' : 'left:700px;top:208px;width:272px;height:60px';
    tg.textContent = (three ? '3인전' : solo ? 'AI 대결' : '2인전') + (ME.rankMode ? ' · 랭킹전' : ME.matchMin === 0 ? ' · 데스매치' : '');
    tg.style.fontSize = tg.textContent.length > 4 ? (three ? '32px' : '26px') : '36px';
    const slots = three ? [[110, 312, 505, 410], [642, 312, 1030, 410], [1170, 312, 1565, 410]] : [[140, 296, 650, 418], [1020, 296, 1532, 418]];
    const me = `<div class="slot" style="${box(...slots[0])}"><b><img src="${J.src(J.avatarColor(ME.name))}" alt="">${esc(ME.name)}</b><small>${esc(rankLine(ME.myRank))}</small></div>`;
    const waits = solo ? `<div class="slot wait" style="${box(...slots[1])}"><b><img src="${J.src(6, 'happy')}" alt="">🤖 AI 친구</b><small>${ME.running ? '곧 AI와 대결해요' : '선생님이 시작하면 대결해요'}</small></div>`
      : slots.slice(1).map((s, i) => `<div class="slot wait" style="${box(...s)}"><b><img src="${J.src([3, 4][i], 'happy')}" alt="">${ME.running ? '찾는 중…' : '자동 배정'}</b><small>${ME.running ? '곧 상대가 정해져요' : '선생님이 정해 줘요'}</small></div>`).join('');
    $('#lbSlots').innerHTML = me + waits;
    $('#lbUnits').textContent = unitsLabel(ME.units); $('#lbUnits').style.fontSize = $('#lbUnits').textContent.length > 12 ? '22px' : '28px';
    $('#lbTime').textContent = ME.matchMin ? `${ME.matchMin}분 경기` : '데스매치 (끝까지)';
    const run = !!ME.running, rk = !!ME.rankMode;
    $('#lbMsgCover').style.display = run || rk ? '' : 'none'; $('#lbMsg').style.display = run || rk ? '' : 'none';
    if (rk) $('#lbMsg').textContent = '⚔️ 랭킹전! 「우리 반 랭킹」을 눌러 도전하세요';
    else if (run) $('#lbMsg').textContent = ME.mode === 1 ? 'AI 친구와 대결을 준비하고 있어요!' : '상대를 찾고 있어요… 곧 대결이 시작돼요!';
  }
  $('#lbHow').onclick = () => openHow('sLobby');
  $('#lbRank').onclick = () => ME && ME.rankMode ? openChal() : openRanking('sLobby');

  /* ---------- 랭킹 ---------- */
  const RK = { tab: 'cls', page: 0, data: null, from: 'sLobby' };
  async function openRanking(from) {
    RK.from = from; RK.page = 0;
    const r = await emit('myRanking', { by: 'points' }); if (r.err) return toast(r.err);
    RK.data = r; RK.tab = 'cls'; renderRanking(); show('sRank');
  }
  function renderRanking() {
    const r = RK.data; if (!r) return;
    const tabs = [['cls', '우리 반', [312, 137, 643, 207]], ['grade', '학년 전체', [668, 137, 1003, 207]], ['battle', '반 대항전', [1030, 137, 1360, 207]]];
    $('#rkTabs').innerHTML = tabs.map(([k, l, b]) => `<button class="pill ${k === RK.tab ? 'm' : 'c'}" data-t="${k}" style="${box(b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4)};font-size:34px">${l}</button>`).join('');
    $$('#rkTabs button').forEach(b => b.onclick = () => { RK.tab = b.dataset.t; RK.page = 0; renderRanking(); });
    let rows = RK.tab === 'cls' ? r.cls : RK.tab === 'grade' ? (r.grade || []) : (r.battle || []);
    const battle = RK.tab === 'battle';
    $('#rkHead').innerHTML = battle ? `<div class="rkHeadCover" style="${box(312, 252, 1000, 302)}"></div><div class="rkc" style="${box(312, 252, 1000, 302)}">반</div>
      <div class="rkHeadCover" style="${box(1012, 252, 1284, 302)}"></div><div class="rkc" style="${box(1012, 252, 1284, 302)}">평균 점수</div>` : '';
    const per = 6, pages = Math.max(1, Math.ceil(rows.length / per));
    RK.page = Math.min(RK.page, pages - 1);
    const ys = [[318, 370], [386, 438], [454, 506], [521, 571], [583, 631], [641, 689]];
    const vis = rows.slice(RK.page * per, RK.page * per + per);
    $('#rkRows').innerHTML = vis.map((x, i) => {
      const [y0, y1] = ys[i]; const me = !battle && ME && x.id === ME.id || battle && ME && x.code === ME.code;
      const medal = x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank;
      const name = battle ? `${esc(x.name)} <span class="tt">(${x.players}명 참여)</span>` : `${esc(x.name)}${RK.tab === 'grade' ? ` <span class="tt">${esc(x.cls)}</span>` : ''}${(x.titles || []).map(t => `<span class="tt">${t.icon}</span>`).join('')}`;
      return `<div class="rkc ${me ? 'me' : ''}" style="${box(132, y0, 302, y1)}">${medal}</div><div class="rkc l ${me ? 'me' : ''}" style="${box(310, y0, 1000, y1)}">${name}</div>
        <div class="rkc y" style="${box(1010, y0, 1284, y1)}">${battle ? x.avgPoints : x.points}</div><div class="rkc" style="${box(1294, y0, 1540, y1)}">${x.acc}%</div>`;
    }).join('') || `<div class="rkc" style="${box(132, 318, 1540, 370)}">${battle ? '같은 학년 반이 두 개 이상이면 반 대항전이 열려요' : '아직 기록이 없어요'}</div>`;
    const m = r.me;
    $('#rkMine').textContent = m ? `우리 반 ${m.cls}등 / ${m.clsOf}명 · ${m.points}점 · 정답률 ${m.acc}%${m.grade ? ` · 학년 ${m.grade}등` : ''}${m.titles && m.titles.length ? ' · ' + m.titles.map(t => t.icon + t.label).join(' ') : ''}` : '첫 경기를 하면 기록이 생겨요';
    $('#rkPager').innerHTML = pages > 1 ? `<button id="rkP" ${RK.page ? '' : 'disabled'}>◀</button><span>${RK.page + 1}/${pages}</span><button id="rkN" ${RK.page < pages - 1 ? '' : 'disabled'}>▶</button>` : '';
    if (pages > 1) { $('#rkP').onclick = () => { RK.page--; renderRanking(); }; $('#rkN').onclick = () => { RK.page++; renderRanking(); }; }
  }
  $('#rkBack').onclick = $('#rkClose').onclick = () => { show(RK.from === 'sGame' ? 'sLobby' : RK.from); if (cur() === 'sLobby') renderLobby(); };

  /* ================= 대결 ================= */
  const G = { matchId: null, view: null, board: E.empty(), pair: null, next: [], phase: 'idle', q: null, score: 0, stars: 0, popping: null, blink: false, cell: 36, busy: false, wrongs: [], endPending: null };
  const myCv = $('#myBoard'); let myCtx = null;
  const nextCv = $('#nextCv'); let nextCtx = null;
  const MY = { x: 102, y: 250 };
  function layoutGame() {
    myCtx = Stage.sizeCanvas(myCv, 216, 504);
    nextCtx = Stage.sizeCanvas(nextCv, 88, 80);
    buildOpps(true); renderSide();
  }
  Stage.onScale(() => { if (cur() === 'sGame') layoutGame(); });

  function startGameView(id) {
    Object.assign(G, { matchId: id, view: null, board: E.empty(), pair: null, next: [], phase: 'idle', q: null, score: 0, stars: 0, popping: null, busy: false, wrongs: [], endPending: null, fog: false, reverse: false, pendingQ: null });
    resultShown = false;
    $('#myAva').src = J.src(J.avatarColor(ME ? ME.name : ''));
    $('#myName').textContent = ME ? ME.name : '';
    setMission('<div class="placeT dark" style="font-size:40px">곧 시작해요!</div><div class="ask">문제를 맞히면 뿌요 한 쌍이 나와요</div>');
    $('#choices').innerHTML = ''; showPane(''); $('#controls').classList.add('off'); $('#chainPop').innerHTML = '';
    $('#sGame').classList.remove('gold'); $('#goldIcon').style.display = 'none';
    hideStatus();
    layoutGame();
  }
  const meP = () => G.view && ME && G.view.players.find(p => p.pid === ME.id);
  let lastCd = null;
  socket.on('m:state', v => {
    if (!ME) return;
    if (v.id !== G.matchId) { if (v.state === 'ended' || !v.players.some(p => p.pid === ME.id)) return; startGameView(v.id); show('sGame'); }
    const first = !G.view, modeChanged = !G.view || G.view.mode !== v.mode;
    G.view = v; G.leftMs = v.left; G.leftAt = performance.now();
    const p = meP();
    if (p) { G.stars = p.stars; G.score = Math.max(G.score, p.score); if (first && p.board && p.board !== E.toStr(E.empty())) G.board = E.fromStr(p.board); }
    if (modeChanged) { Stage.setBg($('#sGame'), v.mode === 3 ? 's_match_3p' : 's_match_1v1'); buildOpps(true); }
    G.death = !!v.death; G.elapsed = v.elapsed || 0;
    const lb = v.ranked ? ['lb_rank', '랭킹전'] : v.death ? ['lb_death', '데스매치'] : v.mode === 3 ? ['lb_3p', '3인전'] : v.solo ? ['lb_ai', 'AI 대결'] : ['lb_2p', '2인전'];
    if (!$('#gLbl').src.endsWith(lb[0] + '.webp')) { $('#gLbl').src = `img/${lb[0]}.webp`; $('#gLbl').alt = lb[1]; }
    $('#gDIcon').classList.toggle('on', G.death); $('#gTimer').classList.toggle('death', G.death);
    if (v.ranked && v.state === 'countdown' && v.countdown > 1200) {
      const R = v.ranked;
      $('#vsCPos').textContent = R.cPos + '위'; $('#vsDPos').textContent = R.dPos + '위';
      $('#vsCName').innerHTML = `<img src="${J.src(J.avatarColor(R.cName), 'happy')}" alt="">${esc(R.cName)}`;
      $('#vsDName').innerHTML = `<img src="${J.src(J.avatarColor(R.dName), 'idle')}" alt="">${esc(R.dName)}`;
      $('#vsTime').textContent = ME.matchMin ? ME.matchMin + '분' : '데스매치';
      $('#ovCount').classList.remove('on');
      if (cur() !== 'sRankVS') { show('sRankVS'); SFX.win(); }
      return;
    }
    if (cur() === 'sRankVS') show('sGame');
    // 카운트다운
    if (v.state === 'countdown') {
      const n = Math.max(1, Math.ceil(v.countdown / 1000));
      if (n !== lastCd) { lastCd = n; $('#cdImg').src = `img/cd${Math.min(3, n)}.webp`; $('#cdImg').style.animation = 'none'; void $('#cdImg').offsetWidth; $('#cdImg').style.animation = ''; SFX.count(false); }
      $('#ovCount').classList.add('on');
    } else if ($('#ovCount').classList.contains('on')) {
      lastCd = null; $('#cdImg').src = 'img/cdgo.webp'; SFX.count(true);
      setTimeout(() => $('#ovCount').classList.remove('on'), 650);
    }
    if (v.paused) showStatus('pause'); else hideStatus('pause');
    const ev = $('#gEv');
    ev.className = 'evChip' + (v.fever || v.sprint ? ' on ' + (v.sprint ? 'sprint' : 'fever') : '');
    ev.innerHTML = v.sprint ? '<img src="img/i_sprint.webp" alt="">공격 2배!' : v.fever ? `<img src="img/i_fever.webp" alt="">피버 ${Math.ceil((v.feverLeft || 0) / 1000)}초` : '';
    if (p && !p.alive && G.phase !== 'out' && v.state === 'playing') { G.phase = 'out'; showStatus('ko'); }
    renderSide(); renderOpps();
  });
  socket.on('m:q', q => { if (G.busy) { G.pendingQ = q; return; } showQuestion(q); });
  socket.on('m:resume', r => { G.pair = { a: r.pair[0], b: r.pair[1], col: 2, rot: 0 }; G.next = r.next || []; G.phase = 'place'; G.stars = r.stars; renderPlace(); });
  socket.on('m:fx', fx => {
    if (fx.type === 'incoming') { flyShot(fx.from, true); SFX.garbage(); $('#myGarb').parentElement.classList.add('shake'); setTimeout(() => $('#myGarb').parentElement.classList.remove('shake'), 400); }
    if (fx.type === 'ko' && ME && fx.pid !== ME.id) toast(`${fx.name} 탈락!`);
    if (fx.type === 'chain' && ME && fx.pid !== ME.id) chainOnOpp(fx);
    if (fx.type === 'event') onEvent(fx);
  });
  socket.on('m:end', r => {
    G.phase = 'idle'; G.fog = G.reverse = false; $('#banner').classList.remove('on'); $('#controls').classList.add('off');
    G.endPending = r; hideStatus(); showStatus('end');
    setTimeout(() => { if (G.endPending === r) goResult(); }, 1800);
  });

  /* ---------- 이벤트 배너 ---------- */
  let bannerT = null;
  function banner(html, ms = 2400) {
    const b = $('#banner'); b.innerHTML = html; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), ms);
  }
  const imgBanner = (k, pre) => `<img class="full" src="img/${pre || 'b_'}${k}.webp" alt="">`;
  const ownBanner = (icon, title, sub, tone) => `<div class="own ${tone || ''}"><div class="in"><img src="img/i_${icon}.webp" alt=""><div class="bar"></div><div><b>${title}</b><span>${sub}</span></div></div></div>`;
  const EVN = { fog: ['fog', '안개', '다음 뿌요 미리보기가 가려져요'], reverse: ['reverse', '뒤죽박죽', '다음 뿌요 ◀ ▶가 반대로'], bomb: ['bomb', '방해 폭탄', '방해 뿌요 6개'], king: ['king', '과학왕', '방해 뿌요 12개'] };
  function onEvent(e) {
    const me = ME && ME.id, mine = e.fromPid === me, hit = e.toPid === me, nm = x => esc(x || '');
    if (EVN[e.kind]) {
      const [ic, name, desc] = EVN[e.kind];
      if (mine) { banner(imgBanner(ic)); toast(`🔥 ${e.streak}연속 정답! ${e.to}에게 ${name}!`, 2000); SFX.win(); if (e.kind === 'bomb' || e.kind === 'king') flyShot(e.to, false); }
      else if (hit) { banner(imgBanner(ic)); toast(`${e.from}의 ${name}!${e.kind === 'fog' || e.kind === 'reverse' ? ' (3연속 정답이면 방어막으로 막아요)' : ''}`, 2200); SFX.garbage(); shakeBoard(); }
      else toast(`${e.from} → ${e.to} ${name}!`, 1600);
      if (mine && e.kind === 'king' && e.cleared) setTimeout(() => toast(`내게 오던 방해 뿌요 ${e.cleared}개도 사라졌어요!`), 1200);
    } else if (e.kind === 'shield') {
      if (hit) banner(imgBanner('shield'));
      else if (mine) banner(ownBanner('shield', `${nm(e.to)}의 <em>방어막!</em>`, '3연속 정답 중인 친구는 막아 내요', ''));
    } else if (e.kind === 'golden') {
      if (mine) { banner(imgBanner('golden')); flyShot(e.to, false); }
      else if (hit) banner(ownBanner('golden', `${nm(e.from)}의 <em>황금 정답!</em>`, '방해 뿌요 3개가 와요', 'bad'));
    } else if (e.kind === 'comeback') {
      if (mine) banner(imgBanner('comeback')); else toast(`${e.from} 역전 찬스! 방해 뿌요 ${e.n}개 제거`, 1500);
    } else if (e.kind === 'feverOn') { banner(imgBanner('fever'), 2600); SFX.win(); }
    else if (e.kind === 'feverOff') toast('피버 타임이 끝났어요');
    else if (e.kind === 'sprint') banner(imgBanner('sprint'), 2600);
  }
  function shakeBoard() { const bb = $('#myBoardBox'); bb.classList.add('shake'); setTimeout(() => bb.classList.remove('shake'), 400); }

  /* ---------- 상대 판 ---------- */
  let OPP = {};
  function oppLayout(n) {
    if (n === 1) return [{ head: [1198, 183, 1580, 236], board: [1206, 252], cell: 42, info: [1462, 252, 1584, 754], big: true }];
    return [0, 1].map(i => { const dx = i * 214; return { head: [1196 + dx, 200, 1372 + dx, 236], board: [1200 + dx, 250], cell: 28, info: [1192 + dx, 594, 1380 + dx, 676], btn: [1190 + dx, 696, 1384 + dx, 764] }; });
  }
  function buildOpps(force) {
    const v = G.view; if (!v || !ME) { $('#opps').innerHTML = ''; OPP = {}; return; }
    const others = v.players.filter(p => p.pid !== ME.id);
    if (!force && others.every(o => OPP[o.pid])) return;
    const L = oppLayout(others.length);
    OPP = {}; const wrap = $('#opps'); wrap.innerHTML = '';
    others.forEach((o, i) => {
      const l = L[i]; if (!l) return;
      const el = document.createElement('div');
      const bw = 6 * l.cell, bh = 12 * l.cell;
      el.innerHTML = `<div class="tx oppName" style="${box(...l.head)};font-size:${l.big ? 28 : 22}px">${esc(o.name)}</div>
        <div class="oppBoard" style="left:${l.board[0]}px;top:${l.board[1]}px;width:${bw}px;height:${bh}px"><canvas></canvas><div class="chainPop"></div></div>
        <img class="aim" src="img/t_aim.webp" style="left:${l.board[0] + bw / 2 - 55}px;top:${l.board[1] + bh / 2 - 55}px" alt="">
        <div class="oppInfo" style="${box(...l.info)}"></div>
        ${l.btn ? `<button class="tgtBtn" style="${box(...l.btn)}" aria-label="공격 선택"></button>` : ''}`;
      wrap.appendChild(el);
      const ctx = Stage.sizeCanvas(el.querySelector('canvas'), bw, bh);
      OPP[o.pid] = { el, ctx, l, last: '' };
      const tb = el.querySelector('.tgtBtn');
      if (tb) tb.onclick = async () => { const r = await emit('m:target', { pid: o.pid }); if (r.err) toast(r.err); else toast(`${o.name}에게 공격해요!`, 1200); };
    });
    renderOpps();
  }
  function renderOpps() {
    const v = G.view; if (!v || !ME) return;
    const me = meP();
    for (const o of v.players) {
      const op = OPP[o.pid]; if (!op) continue;
      const big = op.l.big;
      const status = !o.alive ? '탈락' : o.golden ? '황금 문제 푸는 중' : o.phase === 'question' ? '문제 푸는 중' : o.phase === 'place' ? '뿌요 놓는 중' : o.phase === 'settle' ? '팡팡!' : '';
      const icons = [o.fog && 'fog', o.reverse && 'reverse', o.alive && o.streak >= 3 && 'shield'].filter(Boolean).map(k => `<img src="img/i_${k}.webp" alt="">`).join('');
      op.el.querySelector('.oppInfo').innerHTML = big
        ? `<div class="hud" style="position:relative;background-image:url(img/h_score.webp);width:118px;height:70px"><div class="hv" style="top:24px;height:42px;font-size:22px;color:var(--ye)">${o.score.toLocaleString()}</div></div><div class="st" style="color:#2dff9a">정답 ${o.first}개</div>
           <div class="hud" style="position:relative;background-image:url(img/h_garb.webp);width:112px;height:120px"><div class="hv">${o.pending}</div></div>
           <div class="hud" style="position:relative;background-image:url(img/h_streak.webp);width:112px;height:120px"><div class="hv">${o.streak}</div></div>
           <div class="st">${status}</div><div class="ic">${icons}</div>${o.maxChain >= 2 ? `<div>최고 ${o.maxChain}연쇄</div>` : ''}`
        : `<b>정답 ${o.first} · ${o.score.toLocaleString()}점</b><div class="st sm">${status}${o.streak >= 2 ? ` · 🔥${o.streak}` : ''}${o.pending ? ` · 방해 ${o.pending}` : ''}<span class="ic">${icons}</span></div>`;
      const isT = v.mode === 3 && me && me.target === o.pid && o.alive;
      op.el.querySelector('.aim').style.display = isT ? 'block' : 'none';
      const tb = op.el.querySelector('.tgtBtn'); if (tb) { tb.classList.toggle('on', !!isT); tb.classList.toggle('off', !o.alive); }
      const key = o.board + o.alive + o.rank;
      if (key !== op.last) { op.last = key; J.drawBoard(op.ctx, o.board, { cell: op.l.cell, dead: !o.alive, deadText: o.rank ? o.rank + '등' : 'OUT', showX: false }); }
    }
  }
  function chainOnOpp(fx) {
    const op = OPP[fx.pid]; if (!op) return;
    const c = op.el.querySelector('.chainPop');
    c.innerHTML = fx.chain <= 5 ? `<img src="img/ch${fx.chain}.webp" alt="">` : `<div class="ctext" style="font-size:30px">${fx.chain} CHAIN!</div>`;
    setTimeout(() => { c.innerHTML = ''; }, 1000);
  }
  // 공격 효과: 내 판 ↔ 상대 판 사이로 빛 구슬이 날아가요
  function flyShot(name, toMe) {
    const v = G.view; if (!v) return;
    const o = v.players.find(p => p.name === name); const op = o && OPP[o.pid]; if (!op) return;
    const oc = [op.l.board[0] + 3 * op.l.cell - 75, op.l.board[1] + 4 * op.l.cell], mc = [MY.x + 108 - 75, MY.y + 160];
    const [a, b] = toMe ? [oc, mc] : [mc, oc];
    const s = $('#shot'); s.classList.remove('fly'); s.style.left = a[0] + 'px'; s.style.top = a[1] + 'px';
    s.style.transform = b[0] < a[0] ? 'scaleX(-1)' : 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => { s.classList.add('fly'); s.style.left = b[0] + 'px'; s.style.top = b[1] + 'px'; }));
    setTimeout(() => s.classList.remove('fly'), 650);
  }

  /* ---------- 내 판 그리기 ---------- */
  function ghostCells() { if (!G.pair || G.phase !== 'place' || G.fog) return null; return E.drop(G.board, G.pair).cells; }
  function drawMine(t) {
    if (!myCtx) return;
    const p = meP(), cs = G.cell;
    J.drawBoard(myCtx, G.board, { cell: cs, top: 2, ghost: ghostCells(), pair: G.phase === 'place' ? G.pair : null, popping: G.popping, blink: G.blink, bursts: G.bursts, landed: G.landed, t, dead: p && !p.alive, deadText: p && p.rank ? p.rank + '등' : 'OUT' });
    if (G.anim) for (const a of G.anim) J.puyo(myCtx, a.color, a.c * cs, a.y, cs, 'fall');
    if (G.fog && G.phase === 'place') { // 안개: 판 윗부분을 구름으로
      const W6 = 6 * cs, fh = 8.5 * cs;
      const gr = myCtx.createLinearGradient(0, 2 * cs, 0, fh); gr.addColorStop(0, 'rgba(150,170,215,.97)'); gr.addColorStop(.8, 'rgba(120,140,195,.9)'); gr.addColorStop(1, 'rgba(120,140,195,0)');
      myCtx.fillStyle = gr; myCtx.fillRect(0, 2 * cs, W6, fh - 2 * cs);
      myCtx.fillStyle = 'rgba(225,235,255,.85)';
      for (let i = 0; i < 7; i++) { const x = ((i * 53 + t / 30) % (W6 + 60)) - 30, y = 3 * cs + (i % 3) * cs * 1.3; myCtx.beginPath(); myCtx.ellipse(x, y, cs * 1.1, cs * .55, 0, 0, 7); myCtx.fill(); }
    }
  }
  function loop(t) { if (cur() === 'sGame') { drawMine(t); tickTimer(); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  function tickTimer() {
    if (!G.view) return;
    const run = G.view.state === 'playing' && !G.view.paused;
    let ms = G.death ? G.elapsed + (run ? performance.now() - G.leftAt : 0) : run ? G.leftMs - (performance.now() - G.leftAt) : G.leftMs;
    ms = Math.max(0, ms); const s = G.death ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
    const el = $('#gTimer'); const txt = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (el.textContent !== txt) { el.textContent = txt; el.classList.toggle('low', !G.death && s <= 30 && G.view.state === 'playing'); }
  }
  function renderSide() {
    const p = meP();
    $('#myScore').textContent = (p ? p.score : G.score).toLocaleString();
    $('#myStars').textContent = G.stars;
    const st = p ? p.streak : 0;
    $('#myStreak').textContent = st;
    const nxt = easyOn() && st < 7 ? [7, 'bomb'] : st < 3 ? [3, 'fog'] : st < 5 ? [5, 'reverse'] : st < 7 ? [7, 'bomb'] : st < 10 ? [10, 'king'] : [10 + Math.ceil((st - 9) / 3) * 3, 'king'];
    $('#myStreakNext').innerHTML = `${nxt[0] - st}개 더 <img src="img/i_${nxt[1]}.webp" alt="">`;
    const pend = p ? p.pending : 0;
    $('#myGarb').textContent = pend;
    $('#myGarbIcons').className = 'hs icons';
    $('#myGarbIcons').innerHTML = pend ? Array.from({ length: Math.min(5, Math.ceil(pend / 6)) }, () => `<img src="${J.src(6)}" alt="">`).join('') : '<span>없음</span>';
    if (!nextCtx) return;
    nextCtx.clearRect(0, 0, 88, 80);
    if (G.fog && G.phase === 'place') { const im = new Image(); im.src = 'img/i_fog.webp'; nextCtx.drawImage(im, 14, 6, 60, 60); return; }
    (G.next || []).slice(0, 2).forEach((pr, i) => {
      const cs = i === 0 ? 38 : 28, x = i === 0 ? 4 : 52, y = i === 0 ? 2 : 22;
      J.puyo(nextCtx, pr[1], x, y, cs, 'idle'); J.puyo(nextCtx, pr[0], x, y + cs, cs, 'idle');
    });
  }

  /* ---------- 과학 미션 ---------- */
  // 문제를 푸는 동안: 가운데를 「사진 + 문제 + 큰 보기 4개」로 바꿔요 (3학년이 누르기 쉽게)
  const NUM = ['①', '②', '③', '④'];
  function qMode(on) { $('#sGame').classList.toggle('qmode', !!on); }
  function openZoom(src) { if (!src) return; $('#zoomImg').src = src; $('#ovZoom').classList.add('on'); }
  $('#ovZoom').onclick = () => $('#ovZoom').classList.remove('on');
  const CH = [[517, 455, 826, 530], [846, 455, 1155, 530], [517, 550, 826, 627], [846, 550, 1155, 627]];
  function setMission(html) { $('#mission').innerHTML = html; }
  function showPane(html) { const p = $('#pane'); p.style.display = html ? 'flex' : 'none'; p.innerHTML = html || ''; }
  function promptHtml(q) {
    if (q.type === 'picture') return `<div class="prompt pic">${esc(q.pic)}</div>`;
    if (q.type === 'response') return `<div class="prompt dlg">${esc(q.q).replace(/____/g, '<u></u>')}</div>`;
    const ko = hasKo(q.q) && !/[a-z]{3}/i.test(q.q.replace(/\(.*?\)/g, ''));
    const long = q.q.length > 34;
    return `<div class="prompt ${ko ? 'ko' : ''}" style="${long ? 'font-size:32px' : ''}">${esc(q.q).replace(/____/g, '<u></u>')}</div>`;
  }
  function showQuestion(q) {
    G.q = q; G.phase = 'question'; G.pair = null; G.orderPick = []; G.orderLead = 0; G.firstPick = null;
    $('#controls').classList.add('off'); $('#controls').classList.remove('rev');
    $('#sGame').classList.toggle('gold', !!q.golden); $('#goldIcon').style.display = q.golden ? '' : 'none';
    const tags = (q.golden ? '<span class="tag gd">황금 문제 · 첫 시도에 별 +2</span>' : '') + (q.review ? '<span class="tag rv">아까 틀린 문제 다시!</span>' : '');
    setMission(`${tags ? `<div class="tags">${tags}</div>` : ''}<div class="ask">${esc(q.ask)}</div>${q.type === 'order' ? `<div class="prompt ko" style="font-size:36px">${esc(q.q)}</div>` : promptHtml(q)}<div class="hintline" id="hint"></div>`);
    if (q.type === 'order') { $('#choices').innerHTML = ''; showPane(''); bindOrder(q); return; }
    showPane('');
    if (q.type === 'quiz') {
      $('#choices').innerHTML = ''; qMode(true);
      const len = (q.q || '').length;
      $('#qPanel').innerHTML = `<div class="qcard ${q.img ? '' : 'noimg'}">${q.img ? `<button class="qimg" id="qImg"><img src="${esc(q.img)}" alt="문제 사진"><span>🔍 크게</span></button>` : ''}
        <div class="qtext">${tags ? `<div class="tags">${tags}</div>` : ''}<div class="ask">${esc(q.ask)}</div><div class="qq" style="font-size:${len > 46 ? 27 : len > 32 ? 31 : 36}px">${esc(q.q)}</div><div class="hintline" id="hint"></div></div></div>
        <div class="qchoices" id="qChoices">${q.choices.map((c, i) => `<button class="qch ${c.length > 16 ? 'long' : ''}" data-i="${i}"><span class="no">${NUM[i]}</span><span class="ct">${esc(c)}</span></button>`).join('')}</div>`;
      if (q.img) $('#qImg').onclick = () => openZoom(q.img);
      $$('#qChoices .qch').forEach(b => b.onclick = () => submit(Number(b.dataset.i), b));
      return;
    }
    qMode(false);
    $('#choices').innerHTML = q.choices.map((c, i) => `<button class="choice ${hasKo(c) ? 'ko' : ''} ${c.length > 22 ? 'long' : ''}" data-i="${i}" style="${box(...CH[i])}"><span class="no">${'ABCD'[i]}</span>${esc(c)}</button>`).join('');
    $$('#choices .choice').forEach(b => b.onclick = () => submit(Number(b.dataset.i), b));
  }
  function bindOrder(q) {
    showPane(`<div class="slotBar" id="slots"></div><div class="toks" id="toks">${q.tokens.map((t, i) => `<button class="tok" data-i="${i}">${esc(t)}</button>`).join('')}</div>
      <div class="ordBtns"><button class="pill c" id="ordClear">다시 놓기</button><button class="pill m" id="ordOk">정답 확인</button></div>`);
    const toks = $$('#toks .tok');
    const render = () => {
      $('#slots').innerHTML = G.orderPick.length ? G.orderPick.map((i, k) => `<button class="tok in ${k < (G.orderLead || 0) ? 'lead' : ''}" data-i="${i}">${esc(q.tokens[i])}</button>`).join('') : '<span class="ph">낱말을 눌러 문장을 완성하세요</span>';
      toks.forEach(t => t.classList.toggle('used', G.orderPick.includes(Number(t.dataset.i))));
      $$('#slots .tok').forEach(t => t.onclick = () => { const i = Number(t.dataset.i); const k = G.orderPick.indexOf(i); if (k >= (G.orderLead || 0)) { G.orderPick.splice(k, 1); render(); } });
    };
    toks.forEach(t => t.onclick = () => { const i = Number(t.dataset.i); if (!G.orderPick.includes(i)) { G.orderPick.push(i); SFX.move(); render(); if (G.orderPick.length === q.tokens.length) setTimeout(() => $('#ordOk') && $('#ordOk').click(), 250); } });
    $('#ordClear').onclick = () => { G.orderPick = G.orderPick.slice(0, G.orderLead || 0); render(); };
    $('#ordOk').onclick = () => { if (G.orderPick.length < q.tokens.length) return toast('낱말을 모두 눌러 주세요.'); submit(G.orderPick.map(i => q.tokens[i]).join(' ')); };
    render();
  }
  function flashFb(name) { const f = $('#fbImg'); f.src = `img/${name}.webp`; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  let submitting = false;
  async function submit(ans, btn) {
    if (submitting || G.phase !== 'question') return; submitting = true;
    const r = await emit('m:answer', { ans }); submitting = false;
    if (r.err) { if (!/지금은/.test(r.err)) toast(r.err); return; }
    const q = G.q;
    if (!r.ok) {
      SFX.bad(); flashFb('f_retry');
      if (G.firstPick == null) G.firstPick = typeof ans === 'number' ? ans : -1;
      if (btn) { btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 400); }
      const h = r.hint || {}; $('#hint').textContent = h.text || '다시 도전!';
      if (h.off) h.off.forEach(i => { const b = $(`#choices .choice[data-i="${i}"], #qChoices .qch[data-i="${i}"]`); if (b) b.classList.add('off'); });
      if (h.show != null) { const b = $(`#choices .choice[data-i="${h.show}"], #qChoices .qch[data-i="${h.show}"]`); if (b) b.classList.add('glow'); }
      if (q.type === 'order' && h.lead) {
        if (h.text.startsWith('정답')) { G.orderPick = []; G.orderLead = 0; }
        else {
          const want = (h.text.match(/"([^"]+)"/g) || []).map(x => x.slice(1, -1));
          const lead = [], used = new Set();
          for (const w of want.slice(0, h.lead)) { const i = q.tokens.findIndex((t, k) => t === w && !used.has(k)); if (i >= 0) { used.add(i); lead.push(i); } }
          G.orderPick = lead; G.orderLead = lead.length;
        }
        bindOrder(q);
      }
      return;
    }
    // 정답!
    G.phase = 'feedback';
    if (G.firstPick != null) G.wrongs.push({ id: q.id, unit: q.unit, type: q.type, ask: q.ask, q: q.q, pic: q.pic, img: q.img, choices: q.choices, ans: q.choices ? q.choices.indexOf(r.answer) : -1, pick: G.firstPick, answer: r.answer, exp: r.exp });
    SFX.good(); if (r.first) setTimeout(SFX.star, 250);
    flashFb(!r.first ? 'f_good' : (r.golden || (r.streak && r.streak % 3 === 0)) ? 'f_perfect' : 'f_ok');
    if (btn) btn.classList.add('right');
    G.stars = r.stars; G.next = r.next || [];
    G.pair = { a: r.pair[0], b: r.pair[1], col: 2, rot: 0 };
    G.fog = !!r.fog; G.reverse = !!r.reverse; if (r.board) G.board = E.fromStr(r.board);
    $('#sGame').classList.remove('gold'); $('#goldIcon').style.display = 'none';
    $$('#choices .choice, #qChoices .qch').forEach(b => { if (b !== btn) b.classList.add('hide'); });
    const star = r.first ? (r.golden ? (r.fever ? 4 : 3) : (r.fever ? 2 : 1)) : 0;
    setTimeout(() => {
      if (G.phase !== 'feedback') return;
      if (q.type === 'quiz' && $('#qChoices')) {
        $('#qChoices').innerHTML = `<div class="qfb"><div class="ans">⭕ ${esc(r.answer)}</div><div class="exp">${esc(r.exp || '')}</div>${star ? `<div class="warn">★ +${star}</div>` : ''}${G.fog ? '<div class="warn">안개 때문에 이번 뿌요는 미리보기가 안 보여요!</div>' : ''}${G.reverse ? '<div class="warn">뒤죽박죽! 이번 뿌요는 ◀ ▶가 반대로 움직여요!</div>' : ''}</div>`;
        return;
      }
      $('#choices').innerHTML = '';
      showPane(`<div class="fb"><div class="ans">${esc(r.answer)}</div><div class="exp">${esc(r.exp || '')}</div>${star ? `<div class="warn">★ +${star}</div>` : ''}${G.fog ? '<div class="warn">안개 때문에 이번 뿌요는 미리보기가 안 보여요!</div>' : ''}${G.reverse ? '<div class="warn">뒤죽박죽! 이번 뿌요는 ◀ ▶가 반대로 움직여요!</div>' : ''}</div>`);
    }, 350);
    renderSide();
    await wait(q.type === 'quiz' ? (r.first ? 2000 : 2600) : (r.first ? 1100 : 1500)); // 설명을 읽을 시간
    G.phase = 'place'; renderPlace();
  }

  /* ---------- 뿌요 놓기 ---------- */
  const easyOn = () => !!(ME && ME.easy);
  function renderPlace() {
    qMode(false); $('#choices').innerHTML = '';
    $('#sGame').classList.toggle('easy', easyOn()); $('#sGame').classList.remove('ezWait');
    if (easyOn()) {
      setMission(`<div class="prompt ko ezTitle">뿌요를 놓으세요!</div><div class="ezHow"><span>◀ ▶ 옮기기</span><span>↻ 돌리기</span><span>⬇ 놓기</span></div><div class="ask ezTip">같은 색 4개를 이으면 펑! 터져요</div>`);
      showPane(`<div class="items ezItems"><button class="item" id="itColor" ${G.stars < 2 ? 'disabled' : ''}><img src="img/i_color.webp" alt="">색 바꾸기<em>★2</em></button><button class="item" id="itClear" ${G.stars < 3 ? 'disabled' : ''}><img src="img/i_clear.webp" alt="">방해 지우기<em>★3</em></button></div><div class="ezStar">별(★)을 모으면 쓸 수 있어요</div><div id="palette"></div>`);
      bindItems(); renderSide(); return;
    }
    $('#controls').classList.remove('off'); $('#controls').classList.toggle('rev', !!G.reverse);
    setMission(`<div class="prompt ko" style="font-size:40px">${G.reverse ? '뒤죽박죽! ' : G.fog ? '안개 속에서 ' : ''}뿌요를 놓으세요!</div><div class="ask">${G.fog ? '떨어질 자리가 가려졌어요. 잘 보고 놓아요!' : G.reverse ? '◀ ▶가 반대로 움직여요 · 판을 눌러 옮기는 건 그대로예요' : '흐린 뿌요가 떨어질 자리예요 · 같은 색 4개를 이어 보세요'}</div>`);
    showPane(`<div class="items"><button class="item" id="itColor" ${G.stars < 2 ? 'disabled' : ''}><img src="img/i_color.webp" alt="">색 바꾸기<em>★2</em></button><button class="item" id="itClear" ${G.stars < 3 ? 'disabled' : ''}><img src="img/i_clear.webp" alt="">방해 지우기<em>★3</em></button></div><div id="palette"></div>`);
    bindItems(); renderSide();
  }
  function bindItems() {
    $('#itColor').onclick = () => {
      const n = G.view ? G.view.colors : 4;
      $('#palette').innerHTML = `<div class="palette">${Array.from({ length: n }, (_, i) => `<button data-c="${i + 1}"><img src="${J.src(i + 1)}" alt=""></button>`).join('')}</div>`;
      $$('#palette button').forEach(b => b.onclick = async () => { const c = Number(b.dataset.c); const r = await emit('m:item', { kind: 'color', a: c, b: c }); if (r.err) return toast(r.err); G.stars = r.stars; G.pair.a = r.pair[0]; G.pair.b = r.pair[1]; SFX.star(); renderPlace(); renderSide(); });
    };
    $('#itClear').onclick = async () => { const r = await emit('m:item', { kind: 'clear' }); if (r.err) return toast(r.err); G.stars = r.stars; G.board = E.fromStr(r.board); toast(`방해 뿌요 ${r.removed}개를 지웠어요!`); SFX.star(); renderPlace(); renderSide(); };
  }
  function act(k) {
    if (G.phase !== 'place' || !G.pair) return;
    if (k === 'left') { G.pair = E.move(G.pair, G.reverse ? 1 : -1); SFX.move(); }
    if (k === 'right') { G.pair = E.move(G.pair, G.reverse ? -1 : 1); SFX.move(); }
    if (k === 'rotL') { G.pair = E.rotate(G.pair, -1); SFX.rot(); }
    if (k === 'rotR') { G.pair = E.rotate(G.pair, 1); SFX.rot(); }
    if (k === 'drop') doDrop();
  }
  $$('#controls .ctl').forEach(b => {
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); act(b.dataset.k);
      if (b.classList.contains('ib')) { b.style.backgroundImage = `url(img/c_${b.dataset.k}_on.webp)`; b.classList.add('press'); }
    });
    const up = () => { if (b.classList.contains('ib')) { b.style.backgroundImage = `url(img/c_${b.dataset.k}.webp)`; b.classList.remove('press'); } };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  $$('#easyCtl .ez').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); act(b.dataset.k); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 140); }));
  addEventListener('keydown', e => {
    if (cur() !== 'sGame') return;
    const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotR', z: 'rotL', x: 'rotR', ' ': 'drop', ArrowDown: 'drop', Enter: 'drop' }[e.key];
    if (m && G.phase === 'place') { e.preventDefault(); act(m); }
  });
  myCv.addEventListener('pointerdown', e => {
    if (G.phase !== 'place' || !G.pair) return;
    const r = myCv.getBoundingClientRect(); const c = Math.floor((e.clientX - r.left) / r.width * 6);
    if (c < 0 || c > 5) return;
    if (c === G.pair.col && (e.clientY - r.top) / r.height * 14 < 2) { act('rotR'); return; }
    G.pair = E.fix(Object.assign({}, G.pair, { col: c })); SFX.move();
  });

  async function doDrop() {
    if (G.phase !== 'place' || !G.pair || G.busy) return;
    G.busy = true; G.phase = 'anim'; $('#controls').classList.add('off'); $('#sGame').classList.add('ezWait'); $('#controls').classList.remove('rev'); G.fog = false; G.reverse = false;
    const pair = G.pair; G.pair = null;
    const d = E.drop(G.board, pair);
    const cs = G.cell, off = [[0, -1], [1, 0], [0, 1], [-1, 0]][pair.rot], baseR = pair.rot === 2 ? 0 : 1;
    const starts = [{ c: pair.col, y: baseR * cs, color: pair.a }, { c: pair.col + off[0], y: (baseR + off[1]) * cs, color: pair.b }];
    const ends = starts.map(s => { const cell = d.cells.find(x => x.c === s.c && x.color === s.color && !x.used); if (cell) cell.used = true; return cell ? (cell.r + 2) * cs : s.y; });
    const t0 = performance.now(), dur = 180;
    await new Promise(res => { const step = () => { const k = Math.min(1, (performance.now() - t0) / dur); G.anim = starts.map((s, i) => ({ c: s.c, color: s.color, y: s.y + (ends[i] - s.y) * k * k })); if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
    G.anim = null; G.board = d.board; SFX.drop();
    G.landed = new Set(d.cells.filter(x => x.r >= 0).map(x => x.r * 6 + x.c)); await wait(110); G.landed = null;
    const overflow = d.cells.some(x => x.r < 0);
    const res = E.resolve(G.board);
    for (const st of res.steps) {
      G.board = st.before; G.popping = new Set(st.popped);
      for (let i = 0; i < 4; i++) { G.blink = i % 2 === 0; await wait(90); }
      G.blink = false; SFX.pop(st.chain); showChain(st.chain);
      G.popping = null; G.board = st.before.map((v, i) => st.popped.includes(i) ? 0 : v);
      G.bursts = st.popped.map(i => ({ c: i % 6, r: Math.floor(i / 6), color: st.before[i] })); await wait(170); G.bursts = null;
      G.board = st.after; await wait(200);
    }
    G.board = res.board; G.score += res.score;
    const r = await emit('m:place', { board: E.toStr(G.board), chain: res.chain, cleared: res.cleared, score: res.score });
    if (r.offset > 0) banner(imgBanner('offset'), 1800);
    if (r.attack > 0) { const t = G.view && G.view.players.find(p => p.pid === r.to); if (t) flyShot(t.name, false); toast(`방해 뿌요 ${r.attack}개 공격!`, 1400); }
    if (r.garbage > 0) { await wait(250); G.board = E.addGarbage(G.board, r.garbage); SFX.garbage(); shakeBoard(); }
    const dead = overflow || E.isDead(G.board);
    await emit('m:settled', { board: E.toStr(G.board), dead });
    G.busy = false; G.phase = dead ? 'out' : 'wait';
    if (dead) { showPane(''); setMission('<div class="prompt ko" style="font-size:38px">판이 꽉 찼어요!</div><div class="ask">친구들의 대결을 지켜봐요</div>'); showStatus('ko'); }
    else if (G.pendingQ) { const q = G.pendingQ; G.pendingQ = null; showQuestion(q); }
    else { showPane(''); setMission('<div class="ask">다음 문제를 불러오는 중…</div>'); }
  }
  function showChain(chain) {
    const el = $('#chainPop'); if (chain < 2) return;
    el.innerHTML = chain <= 5 ? `<img src="img/ch${chain}.webp" alt="">` : `<div class="ctext">${chain} CHAIN!</div>`;
    setTimeout(() => { el.innerHTML = ''; }, 1000);
  }

  /* ---------- 결과 ---------- */
  let resTimer = null, resAt = 0, lastResult = null;
  function goResult() {
    const r = G.endPending; if (!r) return;
    G.endPending = null; hideStatus(); showResult(r);
  }
  function showResult(r) {
    resultShown = true; lastResult = r; resAt = Date.now();
    const win = r.rank === 1;
    if (win) SFX.win();
    const lose = !win;
    $('#rLoseCover').style.display = lose ? 'block' : 'none';
    const bd = $('#rBadge'); bd.style.display = lose ? 'block' : 'none';
    if (lose) { bd.src = 'img/r_lose.webp'; bd.style.cssText = 'left:110px;top:192px;width:494px;display:block'; }
    const st = r.st || {};
    $('#rName').textContent = `${ME ? ME.name : ''} · ${r.of}명 중 ${r.rank}등`;
    const rows = [[100, 528, 608, 603], [100, 632, 608, 706], [100, 722, 608, 792]];
    $('#rRows').innerHTML = r.table.slice(0, 3).map((x, i) => `<div class="rrow ${x.me ? 'me' : ''} ${i === 2 ? 'extra' : ''}" style="${box(...rows[i])}">${x.bot ? '' : ''}<img src="${J.src(x.bot ? 6 : J.avatarColor(x.name))}" alt="">${esc(x.name)}${x.me ? ' (나)' : ''}<span class="sc">${x.score.toLocaleString()}</span></div>`).join('');
    $('#rAcc').textContent = (st.seen ? Math.round((st.first || 0) / st.seen * 100) : 0) + '%';
    $('#rChain').textContent = st.maxChain || 0;
    $('#rPoints').textContent = r.practice ? '-' : '+' + r.points;
    const learned = r.learned || [];
    const wrongN = (r.wrongs || []).length;
    $('#rToday').innerHTML = `<div class="lt">${learned.length ? `이번 경기에 익힌 문제 ${learned.length}개` : '이번 경기에 연습한 문제 ' + (r.practiced || 0) + '개'}</div>
      ${learned.length ? `<div class="chips">${learned.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="sum">첫 시도 정답 ${st.first || 0} · 다시 도전 정답 ${st.retry || 0} · 최고 연속 ${st.bestStreak || 0} · ${wrongN ? `틀린 문제 ${wrongN}개 → <b>오답 복습</b>을 눌러 보세요` : '틀린 문제 없음! 👏'}</div>`;
    if (r.ranked) {
      const ch = r.ranked.role === 'challenger', won = r.rank === 1;
      $('#rToday').insertAdjacentHTML('afterbegin', `<div class="lt" style="color:#b0006a">⚔️ 랭킹전 ${ch ? (won ? `도전 성공! ${esc(r.ranked.dName)}을(를) 이겼어요 +10` : '도전 실패 · 다음에 다시 도전!') : (won ? '방어 성공! +5' : `${esc(r.ranked.cName)}의 도전에 졌어요`)}</div>`);
      if (won) setTimeout(() => banner(imgBanner(ch ? 'chal_ok' : 'def_ok', 'rp_'), 3000), 500);
    }
    show('sResult'); renderResultBar();
    clearInterval(resTimer);
    resTimer = setInterval(renderResultBar, 500);
  }
  function renderResultBar() {
    if (cur() !== 'sResult') return;
    const run = ME && ME.running;
    const rk = run && ME.rankMode;
    $('#rBarCover').style.display = run && !rk ? 'none' : ''; $('#rBar').style.display = run && !rk ? 'none' : '';
    $('#rBar').textContent = rk ? (ME.myChallenge ? `${ME.myChallenge.name}에게 도전 신청 중!` : '랭킹전! 랭킹에서 도전할 친구를 고르세요') : '선생님이 시작하면 대결이 열려요';
    $('#rSec').style.display = run ? '' : 'none';
    const left = Math.max(0, 10 - Math.floor((Date.now() - resAt) / 1000)); const auto = ME.rankMode ? (ME.autoAt ? Math.max(0, Math.ceil((ME.autoAt - Date.now()) / 1000)) : null) : null;
    $('#rSec').textContent = ME.rankMode ? (ME.myChallenge ? '상대가 경기를 마치면 바로 시작해요' : auto != null ? `${auto}초 안에 고르지 않으면 자동으로 상대가 정해져요` : '') : left ? `${left}초 안에 다음 상대와 자동으로 붙어요` : '곧 시작해요!';
    $('#rLobby').style.display = run ? 'none' : '';
  }
  $('#rWrong').onclick = () => { const w = lastResult && lastResult.wrongs && lastResult.wrongs.length ? lastResult.wrongs : G.wrongs; if (!w.length) return toast('틀린 문제가 없어요! 👏'); openReview(w, 'sResult'); };
  $('#rRank').onclick = () => ME && ME.rankMode ? openChal() : openRanking('sResult');
  $('#rLobby').onclick = async () => { await emit('ready'); resultShown = false; G.matchId = null; renderLobby(); show('sLobby'); };

  /* ---------- 랭킹전 ---------- */
  const CHL = { start: null, from: 'sLobby' };
  function stCell(x, st, mine, bx) {
    const lb = !x.online ? null : x.status === 'playing' ? ['lb_play', '경기 중'] : mine && mine.target === x.id ? ['lb_wait', '도전 대기 중'] : x.by.length ? ['lb_got', '도전 받음'] : null;
    return lb ? `<div class="chSt" style="${bx}"><img class="chLb" src="img/${lb[0]}.webp" alt="${lb[1]}"></div>` : `<div class="chSt ${st[1]}" style="${bx}">${st[0]}</div>`;
  }
  function openChal() { CHL.start = null; CHL.from = cur(); renderChal(); show('sChal'); }
  const CY = [[316, 373], [384, 440], [450, 507], [517, 571], [579, 631], [640, 690]];
  function renderChal() {
    if (!ME || !ME.ladder) return;
    const L = ME.ladder, me = L.find(x => x.id === ME.id), myPos = me ? me.pos : L.length, per = 6;
    if (CHL.start == null) CHL.start = Math.max(0, Math.min(myPos - per, L.length - per)); // 처음엔 내 위 5명 + 나
    CHL.start = Math.max(0, Math.min(CHL.start, Math.max(0, L.length - per)));
    const vis = L.slice(CHL.start, CHL.start + per), mine = ME.myChallenge;
    const STT = { playing: ['경기 중', 'play'], waiting: ['대기 중', ''], result: ['결과 보는 중', ''], lobby: ['대기실', ''] };
    const rowsHtml = vis.map((x, i) => {
      const [y0, y1] = CY[i]; const isMe = x.id === ME.id;
      const st = !x.online ? ['나감', 'off'] : STT[x.status] || ['', ''];
      let btn;
      const bb = box(1300, y0 + 3, 1528, y1 - 3);
      if (isMe) btn = `<div class="rkc me" style="${box(1290, y0, 1540, y1)}">나</div>`;
      else if (x.pos < myPos && x.online) btn = mine && mine.target === x.id ? `<button class="chBtn sent" data-cancel="1" style="${bb}" aria-label="신청 취소"></button>`
        : x.status === 'playing' ? `<button class="chBtn" data-t="${x.id}" style="${bb};background-image:url(img/rb_busy.webp)" aria-label="도전 (경기 중)"></button>` : `<button class="chBtn go" data-t="${x.id}" style="${bb}" aria-label="도전"></button>`;
      else btn = x.pos > myPos ? `<div class="chImg lock" style="${bb}"></div>` : `<div class="chImg busy" style="${bb};opacity:.6"></div>`;
      const rank = x.pos === 1 ? `<img class="crown" src="img/ri_crown.webp" alt="1위">` : x.pos <= 3 ? ['', '🥈', '🥉'][x.pos - 1] : x.pos;
      return `<div class="rkc ${isMe ? 'me' : ''}" style="${box(130, y0, 280, y1)}">${rank}</div>
        <div class="rkc l ${isMe ? 'me' : ''}" style="${box(286, y0, 850, y1)}">${esc(x.name)}${x.by.length ? `<span class="chBy">⚔ ${esc(x.by.join(', '))}</span>` : ''}</div>
        <div class="rkc y" style="${box(856, y0, 1076, y1)}">${x.points}</div>
        ${stCell(x, st, mine, box(1082, y0 + 2, 1284, y1 - 2))}${btn}`;
    }).join('');
    const changed = $('#chRows').dataset.h !== rowsHtml;
    if (changed) {
      $('#chRows').dataset.h = rowsHtml; $('#chRows').innerHTML = rowsHtml;
      $$('#chRows [data-t]').forEach(b => b.onclick = async () => { const r = await emit('challenge', { target: b.dataset.t }); if (r.err) toast(r.err); else { SFX.star(); toast('도전 신청! 친구가 기다리는 중이면 바로 시작해요'); } });
      $$('#chRows [data-cancel]').forEach(b => b.onclick = async () => { await emit('cancelChallenge'); toast('도전을 취소했어요'); });
    }
    $('#chMine').textContent = `${myPos}위 / ${L.length}명 · ${me ? me.points : 0}점`;
    const more = L.length > per;
    $('#chPager').innerHTML = more ? `<button id="chP" ${CHL.start ? '' : 'disabled'} aria-label="위로"></button><span>${CHL.start + 1}~${Math.min(L.length, CHL.start + per)}위</span><button class="dn" id="chN" ${CHL.start + per < L.length ? '' : 'disabled'} aria-label="아래로"></button>` : '';
    if (more) { $('#chP').onclick = () => { CHL.start = Math.max(0, CHL.start - per); renderChal(); }; $('#chN').onclick = () => { CHL.start += per; renderChal(); }; }
    chalText();
  }
  function chalText() {
    if (!ME || !ME.ladder) return;
    const me = ME.ladder.find(x => x.id === ME.id), myPos = me ? me.pos : 99, mine = ME.myChallenge;
    const auto = ME.autoAt ? Math.max(0, Math.ceil((ME.autoAt - Date.now()) / 1000)) : null;
    $('#chTime').textContent = !ME.running ? '선생님이 모두 시작을 누르면 도전할 수 있어요'
      : auto != null ? `${auto}초 안에 고르지 않으면 자동으로 상대가 정해져요` : '도전 상대를 고르세요';
    const incoming = me && me.by.length ? `⚔ ${me.by.join(', ')}이(가) 나에게 도전!` : '';
    $('#chState').textContent = mine ? `${mine.name}에게 도전 신청 · ${!ME.running ? '시작을 기다려요' : mine.status === 'playing' ? '경기가 끝나면 시작' : '곧 시작!'}`
      : incoming || (myPos === 1 ? '1위! 도전자를 기다려요' : '나보다 높은 순위만 도전할 수 있어요');
  }
  setInterval(() => { if (cur() === 'sChal') chalText(); }, 1000);
  $('#chClose').onclick = () => { if (CHL.from === 'sResult') { show('sResult'); renderResultBar(); } else { renderLobby(); show('sLobby'); } };
  let cpT = null;
  socket.on('challenged', d => { SFX.win(); $('#cpName').textContent = d.from; $('#ovChal').classList.add('on'); clearTimeout(cpT); cpT = setTimeout(() => $('#ovChal').classList.remove('on'), 3500); });
  $('#cpBtn').onclick = () => $('#ovChal').classList.remove('on');
  let feedT = null;
  socket.on('feed', t => { const f = $('#feed'); f.textContent = t; f.classList.add('on'); clearTimeout(feedT); feedT = setTimeout(() => f.classList.remove('on'), 3200); });

  /* ---------- 오답 복습 ---------- */
  const RV = { list: [], i: 0, from: 'sResult' };
  function localWrongs() { return G.wrongs; }
  function openReview(list, from) {
    if (!list || !list.length) return toast('아직 틀린 문제가 없어요!');
    RV.list = list; RV.i = 0; RV.from = from; renderReview(); show('sReview');
  }
  function renderReview() {
    const w = RV.list[RV.i]; if (!w) return;
    $('#rvIdx').textContent = `${RV.i + 1} / ${RV.list.length}`;
    $('#rvUnit').textContent = w.unit ? unitName(w.unit) : '';
    if (w.type === 'quiz') {
      $('#rvQ').innerHTML = `<div class="rvq">${w.img ? `<button class="rvimg" id="rvImg"><img src="${esc(w.img)}" alt=""></button>` : ''}<div class="rvt"><div class="ask">${esc(w.ask || '')}</div><div class="q ko" style="font-size:${(w.q || '').length > 40 ? 30 : 36}px">${esc(w.q)}</div></div></div>`;
      if (w.img) $('#rvImg').onclick = () => openZoom(w.img);
    } else {
    const qtext = w.type === 'picture' ? `<div class="q pic">${esc(w.pic || w.q)}</div>` : w.type === 'response' ? `<div class="q dlg">${esc(w.q).replace(/____/g, '＿＿＿')}</div>` : `<div class="q ${hasKo(w.q) && !/[a-z]{3}/i.test(w.q) ? 'ko' : ''}" style="${(w.q || '').length > 34 ? 'font-size:38px' : ''}">${esc(w.q).replace(/____/g, '＿＿＿')}</div>`;
    $('#rvQ').innerHTML = `<div class="ask">${esc(w.ask)}</div>${qtext}`;
    }
    const RB = [[150, 404, 816, 476], [858, 404, 1524, 476], [150, 502, 816, 574], [858, 502, 1524, 574]];
    if (w.choices && w.choices.length) {
      $('#rvChoices').innerHTML = w.choices.map((c, i) => `<div class="rvc ${hasKo(c) ? 'ko' : ''} ${i === w.ans || c === w.answer ? 'right' : ''} ${i === w.pick && c !== w.answer ? 'pick' : ''}" style="${box(...RB[i])};${c.length > 26 ? 'font-size:24px' : ''}">${esc(c)}</div>`).join('');
    } else {
      $('#rvChoices').innerHTML = `<div class="rvc right" style="${box(150, 404, 1524, 476)}">${esc(w.answer)}</div>${w.tried ? `<div class="rvc pick" style="${box(150, 502, 1524, 574)};font-size:24px">${esc(w.tried)}</div>` : ''}`;
    }
    $('#rvExp').innerHTML = `<b>${esc(w.answer)}</b><span>${esc(w.exp || '')}</span>`;
    $('#rvPrev').classList.toggle('off', RV.i === 0);
    $('#rvNext').classList.toggle('off', RV.i >= RV.list.length - 1);
  }
  $('#rvPrev').onclick = () => { if (RV.i > 0) { RV.i--; renderReview(); } };
  $('#rvNext').onclick = () => { if (RV.i < RV.list.length - 1) { RV.i++; renderReview(); } };
  $('#rvClose').onclick = () => { if (RV.from === 'sGame' && !G.matchId) show('sLobby'); else show(RV.from); if (RV.from === 'sGame' && G.phase === 'out') showStatus('ko'); };

  J.ready(() => { if (cur() === 'sGame') layoutGame(); });
})();
