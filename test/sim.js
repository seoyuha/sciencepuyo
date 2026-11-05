// 자동 대결 시험: 두 반(1대1 반, 3인전 반)에서 가상 학생들이 실제처럼 문제를 풀고 젤리를 놓아요.
// 실행: npm test   (socket.io-client 필요: npm i --no-save socket.io-client)
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { io } = require('socket.io-client');
const E = require('../public/engine.js');

const PORT = 3311, URL = 'http://localhost:' + PORT;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'puyo-'));
const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, FAST: '1', SIM_ANSWERS: '1', TEACHER_PASSWORD: 'test', DATA_DIR }), stdio: ['ignore', 'pipe', 'inherit'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const emit = (s, ev, d) => new Promise(r => s.emit(ev, d || {}, x => r(x || {})));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };

function student(code, name, opts = {}) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  const st = { s, name, board: E.empty(), view: null, ends: [], answered: 0, placed: 0, chains: 0, maxChain: 0, garbageGot: 0, targetSwitch: 0, events: [], types: new Set(), gaps: [], fogGot: 0 };
  s.on('m:fx', fx => { if (fx.type === 'event') st.events.push(fx.kind); });
  s.on('state', v => { st.view = v; });
  s.on('m:state', v => { if (st.mid !== v.id) { if (st.endAt) { st.gaps.push(Date.now() - st.endAt); st.endAt = 0; } st.mid = v.id; st.board = E.empty(); } st.m = v;
    if (opts.switchTarget && v.mode === 3 && v.state === 'playing' && !st.targetSwitch) {
      const me = v.players.find(p => p.pid === st.view.id); const other = v.players.find(p => p.pid !== st.view.id && p.alive && p.pid !== me.target);
      if (other) { st.targetSwitch = 1; emit(s, 'm:target', { pid: other.pid }).then(r => { st.targetOk = r.ok; }); }
    } });
  s.on('m:end', r => { st.ends.push(r); st.endAt = Date.now(); });
  s.on('m:q', async q => {
    st.types.add(q.type); (st.units = st.units || new Set()).add(q.unit); if (q.img) st.imgs = (st.imgs || 0) + 1;
    await wait(30 + Math.random() * 60);
    let r, tries = 0;
    if (q.type === 'order') {
      r = await emit(s, 'm:answer', { ans: Math.random() < 0.85 ? q._a : q.tokens.join(' ') });
      while (!r.ok && tries++ < 3) { const t = r.hint && r.hint.text || ''; const ans = t.startsWith('정답: ') ? t.slice(4) : q.tokens.join(' '); r = await emit(s, 'm:answer', { ans }); }
    } else {
      const order = Math.random() < 0.85 ? null : Math.random() < 0.75 ? [0, 1, 2, 3] : [3, 2, 1, 0];
      if (!order) { r = await emit(s, 'm:answer', { ans: q._a }); }
      if (order) for (const i of order) { r = await emit(s, 'm:answer', { ans: i }); if (r.ok || r.err) break; }
    }
    if (!r.ok) return;
    st.answered++; if (r.fog) st.fogGot++;
    await wait(20);
    const mv = E.bestMove(st.board, { a: r.pair[0], b: r.pair[1], col: 2, rot: 0 }, 0.9);
    const d = E.drop(st.board, mv); const res = E.resolve(d.board);
    st.board = res.board; st.placed++; if (res.chain >= 2) st.chains++; st.maxChain = Math.max(st.maxChain, res.chain);
    const pr = await emit(s, 'm:place', { board: E.toStr(st.board), chain: res.chain, cleared: res.cleared, score: res.score });
    if (pr.garbage) { st.board = E.addGarbage(st.board, pr.garbage); st.garbageGot += pr.garbage; }
    await emit(s, 'm:settled', { board: E.toStr(st.board), dead: E.isDead(st.board) || d.cells.some(c => c.r < 0) });
  });
  st.join = async () => { const r = await emit(s, 'join', { code, name }); if (r.view) st.view = r.view; return r; };
  return st;
}

(async () => {
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('사이언스')) r(); }));
  await wait(300);
  console.log('▶ 교사 로그인과 반 만들기');
  const t = io(URL, { transports: ['websocket'] });
  ok((await emit(t, 't:login', { pw: 'wrong' })).err, '틀린 비밀번호는 막아요');
  const L = await emit(t, 't:login', { pw: 'test' }); ok(L.ok, '교사 로그인');
  const A = await emit(t, 't:newClass', { name: '시험 1반', grade: 3 }); const B = await emit(t, 't:newClass', { name: '시험 2반', grade: 3 }); const C = await emit(t, 't:newClass', { name: '시험 3반', grade: 3 });
  ok(A.code && B.code, `반 두 개 (코드 ${A.code}, ${B.code})`);
  await emit(t, 't:settings', { code: A.code, settings: { mode: 2, units: [1, 2, 3], matchMin: 3 } });
  await emit(t, 't:settings', { code: B.code, settings: { mode: 3, units: [99], matchMin: 3, colors: 3 } });
  const cs = await emit(t, 't:settings', { code: C.code, settings: { mode: 1, units: [5], matchMin: 3 } }); ok(cs.settings.mode === 1 && cs.settings.units[0] === 5, '3반: 1인용(AI) · 5차시');

  console.log('▶ 학생 입장 (1반 5명 → 2명씩 짝 + 남는 1명은 AI, 2반 3명 → 3인전)');
  const As = ['도레미', '하늘', '바다', '솔이', '나래'].map(n => student(A.code, n));
  const Bs = ['가온', '누리', '다온'].map((n, i) => student(B.code, n, { switchTarget: i === 0 }));
  const Cs = ['마루', '보람'].map(n => student(C.code, n));
  for (const s of [...As, ...Bs, ...Cs]) ok((await s.join()).ok, `${s.name} 입장`);
  const dup = student(A.code, '도레미'); const dj = await dup.join(); ok(dj.ok && dj.view.id === As[0].view.id, '같은 이름으로 다시 들어오면 같은 학생으로 이어져요'); dup.s.close(); await wait(200);
  await As[0].join();

  console.log('▶ 선생님이 시작');
  await emit(t, 't:start', { code: A.code }); await emit(t, 't:start', { code: B.code }); await emit(t, 't:start', { code: C.code });
  await wait(1500);
  const ta = await emit(t, 't:open', { code: A.code });
  const live = ta.view.matches.filter(m => m.state !== 'ended');
  ok(live.length === 3, `1반 경기 ${live.length}개 (사람끼리 2 + AI 1 기대)`);
  ok(live.some(m => m.players.some(p => p.bot)), 'AI가 남는 학생의 빈자리를 채웠어요');
  const tb = await emit(t, 't:open', { code: B.code });
  ok(tb.view.matches.some(m => m.players.length === 3 && m.players.every(p => !p.bot)), '2반은 3명이 한 경기 (3인전)');
  const tc = await emit(t, 't:open', { code: C.code });
  ok(tc.view.matches.length === 2 && tc.view.matches.every(m => m.solo && m.players.length === 2 && m.players.filter(p => p.bot).length === 1), '3반은 학생마다 AI와 1:1 (1인용)');

  // 일시정지 시험
  await emit(t, 't:pause', { code: A.code, on: true }); await wait(300);
  const pv = As[0].m; ok(pv && pv.paused, '일시정지가 학생 화면에 전달돼요');
  const left1 = pv.left; await wait(700); ok(Math.abs(As[0].m.left - left1) < 50, '일시정지 동안 시간이 멈춰요');
  await emit(t, 't:pause', { code: A.code, on: false });

  console.log('▶ 경기 진행 (시험 모드: 3분 경기 = 18초)');
  await wait(25000);
  ok(Bs[0].targetOk, '3인전에서 공격 대상 바꾸기');
  const all = [...As, ...Bs, ...Cs];
  ok(all.every(s => s.ends.length >= 1), `모두 경기를 마쳤어요 (${all.map(s => s.ends.length).join(',')})`);
  ok(all.reduce((a, s) => a + s.answered, 0) > 50, `과학 문제 ${all.reduce((a, s) => a + s.answered, 0)}개 해결`);
  ok(all.some(s => s.chains > 0), `2연쇄 이상 ${all.reduce((a, s) => a + s.chains, 0)}번, 최고 ${Math.max(...all.map(s => s.maxChain))}연쇄`);
  ok(all.some(s => s.garbageGot > 0), `방해 젤리 받음 총 ${all.reduce((a, s) => a + s.garbageGot, 0)}개`);
  const e0 = As[0].ends[0]; ok(e0 && e0.table && e0.myRank && e0.myRank.cls, `결과 화면: ${e0.rank}등, 반 ${e0.myRank.cls}등, 학년 ${e0.myRank.grade}등`);

  console.log('▶ 자동 재매칭 (경기 끝 → 10초 안)');
  await wait(1500);
  const gaps = all.flatMap(s => s.gaps);
  ok(gaps.length >= 5 && Math.max(...gaps) <= 10000, `끝난 뒤 다음 경기까지 최대 ${(Math.max(...gaps) / 1000).toFixed(1)}초 (${gaps.length}번)`);
  const evs = all.flatMap(s => s.events); const kinds = [...new Set(evs)];
  ok(kinds.includes('fog') && kinds.includes('reverse'), '연속 정답 이벤트: ' + kinds.join(', '));
  ok(kinds.includes('feverOn') && kinds.includes('sprint'), '피버 타임과 막판 스퍼트 알림');
  ok(all.some(s => s.fogGot > 0), '안개를 받은 학생의 다음 젤리에 안개가 걸렸어요');
  const types = new Set(all.flatMap(s => [...s.types])); ok(types.size === 1 && types.has('quiz'), '나온 유형: ' + [...types].join(','));
  ok(Cs.every(s => s.units.size && [...s.units].every(u => u === 5)), '3반(5차시)에는 5차시 문제만 나왔어요');
  ok(As.every(s => [...s.units].every(u => u >= 1 && u <= 3)), '1반(1~3차시)에는 1~3차시 문제만');
  ok(all.some(s => s.imgs > 0), `사진 붙은 문제 ${all.reduce((a, s) => a + s.imgs, 0)}개`);
  const aiRes = all.flatMap(s => s.ends).find(e => e.table.some(x => x.bot) && !e.practice);
  ok(aiRes && aiRes.points >= (aiRes.st.first * 3 + aiRes.st.retry + (aiRes.rank === 1 ? 20 : 3)), `AI전 점수도 그대로 반영 (+${aiRes && aiRes.points})`);
  const ta2 = await emit(t, 't:open', { code: A.code });
  ok(ta2.view.matches.filter(m => m.state !== 'ended').length >= 2, '끝난 학생끼리 다시 경기가 열렸어요');
  ok(ta2.view.students.every(x => x.status === 'playing'), '1반 학생 모두 경기 중 (기다리는 학생 없음)');

  console.log('▶ 랭킹');
  const R = await emit(t, 't:ranking', { code: A.code, by: 'points' });
  ok(R.cls.length === 5 && R.cls[0].points > 0, `반 랭킹 1등 ${R.cls[0].name} ${R.cls[0].points}점`);
  ok(R.grade.length === 10, `학년 랭킹 ${R.grade.length}명 (세 반 합계)`);
  ok(R.battle.filter(b => b.players > 0).length === 3 && R.battle[0].avgPoints > 0 && R.battle.some(b => b.name === "3학년 1반"), `반 대항전: ${R.battle.map(b => b.name + ' ' + b.avgPoints).join(' / ')}`);
  ok(R.cls.some(x => x.mastered > 0), '익힌 문제 기록: ' + R.cls.map(x => x.name + ' ' + x.mastered + '/' + x.practiced).join(', '));
  ok(R.cls.some(x => x.titles.length), '칭호: ' + R.cls.filter(x => x.titles.length).map(x => x.name + x.titles.map(t => t.label).join('')).join(', '));
  const Ra = await emit(t, 't:ranking', { code: A.code, by: 'acc' }); ok(Ra.cls[0].acc >= Ra.cls[Ra.cls.length - 1].acc, '정답률 순 정렬');
  const rec = await emit(t, 't:records', { code: A.code }); ok(rec.results.length >= 5, `경기 기록 ${rec.results.length}줄`); ok(rec.wrongTop.length > 0, `많이 틀린 문제 ${rec.wrongTop.length}개`);

  console.log('▶ 문제 관리와 백업');
  const add = await emit(t, 't:addQuestions', { rows: [{ unit: '2차시', q: '큰 북을 세게 치면?', answer: '큰 소리', w1: '작은 소리', w2: '높은 소리', w3: '소리가 안 나요' }, { unit: 8, type: '사진 퀴즈', q: '소음을 줄이는 방법은?', answer: '방음벽', w1: '확성기', w2: '북', w3: '종' }, { unit: 13, q: 'x', answer: 'y' }] });
  ok(add.added === 2 && add.errors.length === 1, '엑셀 문제 2개 추가, 잘못된 줄 1개 알려 줌');
  const bk = await emit(t, 't:backup'); ok(bk.data && Object.keys(bk.data.classes).length === 10, '백업 만들기');
  await emit(t, 't:stop', { code: A.code }); await emit(t, 't:stop', { code: B.code });
  const rs = await emit(t, 't:restore', { data: bk.data }); ok(rs.needForce, '기록이 있으면 덮어쓰기 전에 물어봐요');

  console.log(fails ? `\n✘ ${fails}개 실패` : '\n✔ 모든 시험 통과');
  for (const s of [...As, ...Bs, ...Cs]) s.s.close(); t.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
