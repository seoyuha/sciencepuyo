/* 화면 틀 공통 — 시안 그림(1672×941) 크기 그대로 무대를 만들고, 화면에 맞게 늘리고 줄여요.
   .hot 버튼은 배경 그림의 같은 자리를 잘라 보여 주기 때문에 눌렀을 때 그 버튼만 쏙 들어가요. */
(function () {
  const SW = 1672, SH = 941;
  let scale = 1;
  const listeners = [];
  function fit() {
    const st = document.getElementById('stage'); if (!st) return;
    scale = Math.min(innerWidth / SW, innerHeight / SH);
    st.style.transform = `translate(-50%,-50%) scale(${scale})`;
    listeners.forEach(f => f(scale));
  }
  // .hot: 같은 화면(section)의 배경 그림을 잘라 버튼 모양으로
  function initHot(root) {
    (root || document).querySelectorAll('.hot').forEach(el => {
      const scr = el.closest('[data-bg]'); const bg = el.dataset.bg || (scr && scr.dataset.bg); if (!bg) return;
      const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      el.style.backgroundImage = `url(img/${bg}.webp)`;
      el.style.backgroundPosition = `${-x}px ${-y}px`;
    });
    (root || document).querySelectorAll('[data-bg]').forEach(s => { if (s.classList.contains('scr')) s.style.backgroundImage = `url(img/${s.dataset.bg}.webp)`; });
  }
  function setBg(scr, bg) {
    scr.dataset.bg = bg; scr.style.backgroundImage = `url(img/${bg}.webp)`;
    scr.querySelectorAll('.hot').forEach(el => { if (!el.dataset.bg) el.style.backgroundImage = `url(img/${bg}.webp)`; });
  }
  addEventListener('resize', () => setTimeout(fit, 50));
  addEventListener('orientationchange', () => setTimeout(fit, 250));
  document.addEventListener('DOMContentLoaded', () => { fit(); initHot(); });
  // 캔버스를 무대 크기에 맞게 선명하게
  function sizeCanvas(cv, w, h) {
    const k = Math.min(3, scale * (devicePixelRatio || 1));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const ctx = cv.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0); return ctx;
  }
  window.Stage = { fit, initHot, setBg, sizeCanvas, onScale: f => listeners.push(f), get scale() { return scale; }, W: SW, H: SH };
})();
