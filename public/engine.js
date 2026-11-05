/* 잉글리시 뿌요 팡! — 게임판 규칙 (학생 화면과 서버 AI가 함께 써요)
   게임판: 가로 6칸 × 세로 12칸. 칸 값 0 빈칸, 1~5 색 뿌요, 6 방해 뿌요
   한 쌍: { a: 가운데 뿌요 색, b: 돌아가는 뿌요 색, col: 가운데 뿌요 칸, rot: 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽 } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuyoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 6, H = 12, GARBAGE = 6, SPAWN_COL = 2;
  const CHAIN_BONUS = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288];
  // 연쇄 수별 공격량 (방해 뿌요 개수). 1연쇄는 공격하지 않아요.
  const ATTACK = [0, 0, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];

  const empty = () => new Array(W * H).fill(0);
  const at = (b, c, r) => (c < 0 || c >= W || r < 0 || r >= H) ? -1 : b[r * W + c];
  const toStr = b => b.join('');
  const fromStr = s => (s && s.length === W * H) ? s.split('').map(Number) : empty();

  function childOffset(rot) { return [[0, -1], [1, 0], [0, 1], [-1, 0]][((rot % 4) + 4) % 4]; }
  // 벽에 막히면 한 칸 밀어 줘요
  function fix(pair) {
    const p = Object.assign({}, pair);
    p.rot = ((p.rot % 4) + 4) % 4;
    const [dx] = childOffset(p.rot);
    p.col = Math.max(0, Math.min(W - 1, p.col));
    if (p.col + dx < 0) p.col = 0 - dx;
    if (p.col + dx >= W) p.col = W - 1 - dx;
    return p;
  }
  function move(pair, d) { return fix(Object.assign({}, pair, { col: pair.col + d })); }
  function rotate(pair, d) { return fix(Object.assign({}, pair, { rot: pair.rot + d })); }
  function colHeight(b, c) { let r = 0; while (r < H && b[r * W + c] === 0) r++; return r; } // 빈칸 수(위에서부터)

  // 한 쌍을 떨어뜨린 결과. cells: 떨어진 자리 [{c,r,color}] (판 밖이면 r<0)
  function drop(board, pair) {
    const p = fix(pair); const b = board.slice();
    const [dx, dy] = childOffset(p.rot);
    const pieces = [{ c: p.col, color: p.a, y: 0 }, { c: p.col + dx, color: p.b, y: dy }];
    pieces.sort((x, y) => y.y - x.y); // 아래쪽에 있는 것부터 놓아요
    const cells = [];
    for (const pc of pieces) {
      const r = colHeight(b, pc.c) - 1;
      if (r >= 0) b[r * W + pc.c] = pc.color;
      cells.push({ c: pc.c, r, color: pc.color });
    }
    return { board: b, cells };
  }

  function gravity(b) {
    const out = b.slice();
    for (let c = 0; c < W; c++) {
      const col = [];
      for (let r = H - 1; r >= 0; r--) if (out[r * W + c]) col.push(out[r * W + c]);
      for (let r = H - 1, i = 0; r >= 0; r--, i++) out[r * W + c] = col[i] || 0;
    }
    return out;
  }

  function findGroups(b) {
    const seen = new Array(W * H).fill(false), groups = [];
    for (let i = 0; i < W * H; i++) {
      const v = b[i]; if (!v || v === GARBAGE || seen[i]) continue;
      const g = [i], st = [i]; seen[i] = true;
      while (st.length) {
        const k = st.pop(), c = k % W, r = (k - c) / W;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr; if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
          const j = nr * W + nc; if (!seen[j] && b[j] === v) { seen[j] = true; g.push(j); st.push(j); }
        }
      }
      groups.push(g);
    }
    return groups;
  }

  // 연쇄 처리. steps: 매 연쇄마다 { before, popped:[칸], after, chain, gain }
  function resolve(board) {
    let b = gravity(board), chain = 0, cleared = 0, score = 0, extra = 0;
    const steps = [];
    for (;;) {
      const big = findGroups(b).filter(g => g.length >= 4);
      if (!big.length) break;
      chain++;
      const pop = new Set();
      let n = 0, groupBonus = 0;
      const colors = new Set();
      for (const g of big) {
        n += g.length; colors.add(b[g[0]]); groupBonus += g.length >= 11 ? 10 : g.length > 4 ? g.length - 3 : 0; extra += g.length - 4;
        for (const k of g) {
          pop.add(k);
          const c = k % W, r = (k - c) / W;
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = at(b, c + dc, r + dr); if (v === GARBAGE) pop.add((r + dr) * W + c + dc); }
        }
      }
      const colorBonus = [0, 0, 3, 6, 12, 24][colors.size] || 0;
      const gain = n * 10 * Math.max(1, Math.min(999, (CHAIN_BONUS[chain - 1] != null ? CHAIN_BONUS[chain - 1] : 300) + groupBonus + colorBonus));
      score += gain; cleared += n;
      const before = b.slice();
      for (const k of pop) b[k] = 0;
      const popped = [...pop];
      b = gravity(b);
      steps.push({ before, popped, after: b.slice(), chain, gain });
    }
    return { board: b, chain, cleared, score, steps, attack: attackFor(chain, extra) };
  }

  function attackFor(chain, extraPopped) {
    if (chain < 2) return 0;
    return (ATTACK[chain] || (66 + (chain - 11) * 12)) + Math.floor((extraPopped || 0) / 2);
  }

  // 방해 뿌요 떨어뜨리기: 6개마다 한 줄, 남은 것은 무작위 칸에
  function addGarbage(board, n, rnd) {
    rnd = rnd || Math.random;
    const b = board.slice(); const count = new Array(W).fill(Math.floor(n / W));
    const cols = [0, 1, 2, 3, 4, 5];
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    for (let i = 0; i < n % W; i++) count[cols[i]]++;
    for (let c = 0; c < W; c++) {
      let top = colHeight(b, c) - 1;
      for (let k = 0; k < count[c] && top >= 0; k++, top--) b[top * W + c] = GARBAGE;
    }
    return b;
  }
  // 아이템: 방해 뿌요를 위에서부터 n개 없애요
  function clearGarbage(board, n) {
    const b = board.slice(); let left = n;
    for (let r = 0; r < H && left > 0; r++) for (let c = 0; c < W && left > 0; c++) if (b[r * W + c] === GARBAGE) { b[r * W + c] = 0; left--; }
    return { board: gravity(b), removed: n - left };
  }
  const isDead = b => b[SPAWN_COL] !== 0; // 가운데 맨 윗칸(셋째 칸)이 막히면 끝
  const countCells = b => b.filter(v => v).length;
  const countGarbage = b => b.filter(v => v === GARBAGE).length;
  const stackHeight = b => { let m = 0; for (let c = 0; c < W; c++) m = Math.max(m, H - colHeight(b, c)); return m; };

  // AI가 둘 자리 고르기 (교사 화면의 AI 상대와 연습용)
  function allMoves() { const m = []; for (let rot = 0; rot < 4; rot++) for (let col = 0; col < W; col++) { const p = fix({ a: 1, b: 1, col, rot }); if (p.col === col) m.push({ col, rot }); } return m; }
  const MOVES = allMoves();
  function evalBoard(b) {
    let s = 0;
    for (const g of findGroups(b)) s += g.length === 3 ? 9 : g.length === 2 ? 3 : 0;
    for (let c = 0; c < W; c++) { const h = H - colHeight(b, c); s -= h * h * 0.25; if (c === SPAWN_COL) s -= Math.max(0, h - 8) * 30; }
    return s;
  }
  function bestMove(board, pair, skill) {
    skill = skill == null ? 0.7 : skill;
    let best = null, bestScore = -Infinity;
    for (const m of MOVES) {
      const p = Object.assign({}, pair, m);
      const d = drop(board, p);
      if (d.cells.some(x => x.r < 0)) continue;
      const res = resolve(d.board);
      if (isDead(res.board)) continue;
      let s = res.chain * res.chain * 60 + res.cleared * 2 + evalBoard(res.board);
      if (res.chain === 1 && res.cleared < 6 && countCells(board) < 40) s -= 25; // 판이 비었을 땐 연쇄를 모아요
      s += (Math.random() - 0.5) * (1 - skill) * 80;
      if (s > bestScore) { bestScore = s; best = p; }
    }
    return best || fix(Object.assign({}, pair, { col: 0, rot: 0 }));
  }

  // 같은 경기에서는 모두 같은 순서로 뿌요가 나와요
  function pairSeq(seed, colors, n) {
    let s = seed >>> 0 || 1; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const out = []; for (let i = 0; i < n; i++) out.push([1 + Math.floor(r() * colors), 1 + Math.floor(r() * colors)]);
    return out;
  }

  return { W, H, GARBAGE, SPAWN_COL, empty, toStr, fromStr, fix, move, rotate, drop, gravity, findGroups, resolve, attackFor, addGarbage, clearGarbage, isDead, countCells, countGarbage, stackHeight, bestMove, pairSeq };
});
