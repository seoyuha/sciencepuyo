/* 네온 뿌요 그리기 — 첨부 그래픽(03 뿌요 6종 동작 시트)에서 자른 그림을 써요.
   색 번호: 1 빨강 · 2 초록 · 3 파랑 · 4 노랑 · 5 보라 · 6 방해(회색)
   동작: idle 기본 · fall 떨어짐 · land 착지 · happy 웃음 · glow 반짝 · pop 터짐 */
(function () {
  const FRAMES = ['idle', 'fall', 'land', 'happy', 'glow', 'pop'];
  const IMG = {};
  let loaded = 0, total = 0;
  const onReady = [];
  function load(name) {
    total++;
    const im = new Image();
    im.onload = im.onerror = () => { loaded++; if (loaded === total) onReady.splice(0).forEach(f => f()); };
    im.src = 'img/' + name + '.webp';
    IMG[name] = im;
  }
  for (let k = 1; k <= 6; k++) FRAMES.forEach(f => load(`p${k}_${f}`));
  load('t_x');
  const ok = im => im && im.complete && im.naturalWidth > 0;
  const img = (k, f) => IMG[`p${k}_${f || 'idle'}`];

  // 한 칸에 뿌요 그리기: 그림 비율을 살려 칸 아래쪽에 붙여요
  function puyo(ctx, k, x, y, cs, frame, alpha) {
    const im = img(k, frame);
    if (!ok(im)) { ctx.fillStyle = ['#000', '#ff4060', '#3ad04a', '#3a8cff', '#ffcc20', '#a650ff', '#9a9aa8'][k]; ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * .45, 0, 7); ctx.fill(); return; }
    const big = frame === 'pop' ? 1.5 : frame === 'glow' ? 1.25 : 1.08;
    let w = cs * big, h = w * im.naturalHeight / im.naturalWidth;
    if (frame === 'fall') { h = cs * 1.12; w = h * im.naturalWidth / im.naturalHeight; }
    if (h > cs * big * 1.2) { h = cs * big * 1.2; w = h * im.naturalWidth / im.naturalHeight; }
    const dx = x + (cs - w) / 2, dy = frame === 'pop' || frame === 'glow' ? y + (cs - h) / 2 : y + cs - h + cs * .02;
    if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(im, dx, dy, w, h); ctx.restore(); }
    else ctx.drawImage(im, dx, dy, w, h);
  }

  // 게임판 그리기 — board: 길이 72 배열/문자열
  // opts: { cell, top(위쪽 들고 있는 칸 수), ghost:[{c,r,color}], pair, popping:Set, blink, dead, deadText, showX, t, landed:Set }
  function drawBoard(ctx, board, opts) {
    const W = 6, H = 12, cs = opts.cell, top = (opts.top || 0) * cs;
    const b = typeof board === 'string' ? board.split('').map(Number) : board;
    ctx.clearRect(0, 0, W * cs, H * cs + top);
    if (top) { ctx.fillStyle = 'rgba(0,229,255,.06)'; ctx.fillRect(0, 0, W * cs, top); }
    // 바탕: 아주 옅은 칸 무늬
    ctx.fillStyle = 'rgba(0,10,32,.55)'; ctx.fillRect(0, top, W * cs, H * cs);
    ctx.strokeStyle = 'rgba(0,229,255,.09)'; ctx.lineWidth = 1;
    for (let c = 1; c < W; c++) { ctx.beginPath(); ctx.moveTo(c * cs + .5, top); ctx.lineTo(c * cs + .5, top + H * cs); ctx.stroke(); }
    for (let r = 1; r < H; r++) { ctx.beginPath(); ctx.moveTo(0, top + r * cs + .5); ctx.lineTo(W * cs, top + r * cs + .5); ctx.stroke(); }
    // 위험 표시 (셋째 칸 맨 위)
    if (opts.showX !== false && ok(IMG.t_x)) { ctx.save(); ctx.globalAlpha = .5; ctx.drawImage(IMG.t_x, 2 * cs + cs * .12, top + cs * .12, cs * .76, cs * .76); ctx.restore(); }
    // 떨어질 자리 미리보기
    if (opts.ghost) for (const g of opts.ghost) if (g.r >= 0) {
      puyo(ctx, g.color, g.c * cs, top + g.r * cs, cs, 'idle', .35);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeRect(g.c * cs + 3, top + g.r * cs + 3, cs - 6, cs - 6); ctx.restore();
    }
    for (let i = 0; i < W * H; i++) {
      const v = b[i]; if (!v) continue;
      const c = i % W, r = (i - c) / W;
      const popping = opts.popping && opts.popping.has(i);
      if (popping) { puyo(ctx, v, c * cs, top + r * cs, cs, opts.blink ? 'glow' : 'happy'); continue; }
      puyo(ctx, v, c * cs, top + r * cs, cs, opts.landed && opts.landed.has(i) ? 'land' : 'idle');
    }
    if (opts.bursts) for (const p of opts.bursts) puyo(ctx, p.color, p.c * cs, top + p.r * cs, cs, 'pop');
    if (opts.pair && opts.top) { // 위쪽에 들고 있는 한 쌍
      const p = opts.pair; const off = [[0, -1], [1, 0], [0, 1], [-1, 0]][p.rot];
      const baseR = p.rot === 2 ? 0 : 1;
      const bob = Math.sin((opts.t || 0) / 250) * cs * .05;
      puyo(ctx, p.a, p.col * cs, baseR * cs + bob, cs, 'idle');
      puyo(ctx, p.b, (p.col + off[0]) * cs, (baseR + off[1]) * cs + bob, cs, 'idle');
    }
    if (opts.dead) {
      ctx.fillStyle = 'rgba(2,4,20,.62)'; ctx.fillRect(0, top, W * cs, H * cs);
      ctx.font = `${Math.round(cs * 1.1)}px "Black Han Sans", Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, cs * .14); ctx.strokeStyle = '#2a0636'; ctx.strokeText(opts.deadText || 'OUT', W * cs / 2, top + H * cs / 2);
      ctx.fillStyle = '#ff5cf0'; ctx.fillText(opts.deadText || 'OUT', W * cs / 2, top + H * cs / 2);
    }
  }
  const src = (k, f) => `img/p${k}_${f || 'idle'}.webp`;
  const avatarColor = name => 1 + ([...String(name || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 5);
  window.Jelly = { drawBoard, puyo, src, avatarColor, ready: f => (loaded === total ? f() : onReady.push(f)) };
})();
