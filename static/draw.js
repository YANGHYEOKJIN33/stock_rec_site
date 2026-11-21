// 차트 작도 + 분석 표시 — 트레이딩뷰처럼 선을 긋되, 버튼 몇 개로 쉽게.
// 도구: 이동 · 추세선 · 수평선 · 박스 · 구간 재기 · 피보나치 · 메모 · 지우기 / 자석 · 분석 표시 · 되돌리기 · 모두 지우기
// 그린 것은 이 기기 브라우저(localStorage)에만 저장한다 — 종목마다 따로. 서버로 보내지 않는다.
// 좌표는 (날짜, 가격)으로 저장한다 → 확대·이동·다음 날 새 봉이 붙어도 제자리에 있다.
(function () {
  var bar = document.querySelector("[data-drawbar]");
  if (!bar) return;
  var S = null, cv, ctx, dpr = 1, tool = "none", pending = null, hover = null, items = [], undo = [];
  var magnet = true, auto = true, key = "";
  var HINT = {
    none: "차트를 끌어서 옮기고, 휠이나 두 손가락으로 확대해요. ✨ 자동 작도를 켜면 선을 대신 그어 줘요.",
    trend: "추세선 — 차트에서 두 점을 차례로 누르세요.",
    hline: "수평선 — 긋고 싶은 가격을 한 번 누르세요.",
    box: "박스 — 두 모서리를 차례로 누르면 그 구간의 등락폭이 나와요.",
    measure: "구간 재기 — 시작과 끝을 누르면 그 기간의 수익률·최대 낙폭·거래량을 분석해요.",
    fib: "피보나치 — 저점과 고점(또는 고점과 저점)을 차례로 누르세요.",
    note: "메모 — 메모를 남길 곳을 누르세요.",
    erase: "지우기 — 지울 선을 누르세요."
  };
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function $(s) { return bar.parentNode.querySelector(s); }
  function load() { try { items = JSON.parse(localStorage.getItem(key) || "[]") || []; } catch (e) { items = []; } }
  function save() { try { localStorage.setItem(key, JSON.stringify(items)); } catch (e) {} }

  // ---------- 좌표: 날짜(1970 기준 일 수) ↔ 논리 인덱스 ↔ 화면 ----------
  function dayToL(d) {
    var t = S.data.t, n = t.length - 1;
    if (d >= t[n]) return n + (d - t[n]) * 5 / 7;
    if (d <= t[0]) return (d - t[0]) * 5 / 7;
    var lo = 0, hi = n;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (t[m] <= d) lo = m; else hi = m; }
    return lo + (d - t[lo]) / (t[hi] - t[lo]);
  }
  function lToDay(l) {
    var t = S.data.t, n = t.length - 1;
    if (l >= n) return t[n] + (l - n) * 7 / 5;
    if (l <= 0) return t[0] + l * 7 / 5;
    var i = Math.floor(l); return t[i] + (l - i) * (t[i + 1] - t[i]);
  }
  function X(d) { return S.chart.timeScale().logicalToCoordinate(dayToL(d)); }
  function Y(p) { return S.candle.priceToCoordinate(p); }
  function toPt(x, y) {
    var l = S.chart.timeScale().coordinateToLogical(x), p = S.candle.coordinateToPrice(y);
    if (l == null || p == null) return null;
    if (magnet) {                                     // 자석: 가까운 봉의 시가·고가·저가·종가에 붙인다
      var i = Math.round(l), d = S.data;
      if (i >= 0 && i < d.c.length && d.c[i] != null) {
        var best = null;
        [d.o[i], d.h[i], d.l[i], d.c[i]].forEach(function (v) {
          var dy = Math.abs(Y(v) - y); if (dy < 24 && (best == null || dy < best[0])) best = [dy, v];
        });
        if (best) { l = i; p = best[1]; }
      }
    }
    return { d: lToDay(l), p: p };
  }
  function fmt(v) { var nd = S.data.nd ? 2 : 0; return v == null ? "—" : Number(v).toLocaleString("ko-KR", { minimumFractionDigits: nd, maximumFractionDigits: nd }); }
  function pct(a, b) { var v = (b / a - 1) * 100; return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; }

  // ---------- 캔버스 ----------
  function size() {
    var el = S.el, w = el.clientWidth, h;
    try { h = S.chart.panes()[0].getHeight(); } catch (e) { h = el.clientHeight; }
    dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  var queued = false;
  function redraw() { if (!queued) { queued = true; requestAnimationFrame(paint); } }
  function line(x1, y1, x2, y2, color, w, dash) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = w || 1.5; ctx.setLineDash(dash || []);
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  var placed = [];                                   // 이번 그리기에서 이미 쓴 글자 칸 — 겹치면 위아래로 비킨다
  function label(x, y, txt, color, bg) {
    ctx.font = "600 11px " + getComputedStyle(document.body).fontFamily;
    var w = ctx.measureText(txt).width + 8;
    x = Math.max(0, Math.min(x, W() - w - 2));             // 오른쪽 끝에서 잘리지 않게 안쪽으로
    for (var k = 0, dy = 0; k < 8; k++) {
      var yy = y + dy, hit = placed.some(function (r) { return x < r[0] + r[2] && x + w > r[0] && yy - 13 < r[1] + 17 && yy + 4 > r[1]; });
      if (!hit) { y = yy; break; }
      dy = dy > 0 ? -dy : -dy + 17;                        // 0 → +17 → −17 → +34 …
    }
    placed.push([x, y - 13, w]);
    ctx.fillStyle = bg || css("--surface"); ctx.globalAlpha = 0.92; ctx.fillRect(x, y - 13, w, 17); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.fillText(txt, x + 4, y);
  }
  function drawItem(it, preview) {
    var acc = css("--accent"), tx = css("--text");
    var ax = it.a ? X(it.a.d) : null, ay = it.a ? Y(it.a.p) : null, bx = it.b ? X(it.b.d) : null, by = it.b ? Y(it.b.p) : null;
    if (it.type === "hline") {
      var y = Y(it.p); if (y == null) return;
      line(0, y, W(), y, acc, 1.5); label(4, y - 3, fmt(it.p), acc); return;
    }
    if (it.type === "note") { if (ax == null || ay == null) return; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, 7); ctx.fill(); label(ax + 6, ay - 4, "✎ " + it.text, tx); return; }
    if (ax == null || ay == null || bx == null || by == null) return;
    if (it.type === "trend") {
      line(ax, ay, bx, by, acc, 2);
      label(bx + 6, by, pct(it.a.p, it.b.p), acc);
    } else if (it.type === "box" || it.type === "measure") {
      var up = it.b.p >= it.a.p;
      if (it.type === "measure") {                  // 구간 재기는 종가 수익률의 방향으로 색을 칠한다
        var cc = S.data.c, nn = cc.length - 1, j0 = Math.max(0, Math.min(nn, Math.round(dayToL(Math.min(it.a.d, it.b.d))))),
            j1 = Math.max(0, Math.min(nn, Math.round(dayToL(Math.max(it.a.d, it.b.d)))));
        up = cc[j1] >= cc[j0];
      }
      ctx.fillStyle = it.type === "box" ? acc : (up ? css("--up") : css("--down"));
      ctx.globalAlpha = 0.1; ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); ctx.globalAlpha = 1;
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      var i0 = Math.round(dayToL(Math.min(it.a.d, it.b.d))), i1 = Math.round(dayToL(Math.max(it.a.d, it.b.d)));
      var nb = Math.max(0, i1 - i0), c = S.data.c, n = c.length - 1;
      i0 = Math.max(0, Math.min(n, i0)); i1 = Math.max(0, Math.min(n, i1));
      // 박스 = 두 가격의 차이 · 구간 재기 = 그 기간 종가 수익률(아래 '구간 분석'과 같은 값)
      var txt = it.type === "measure" ? "종가 " + pct(c[i0], c[i1]) + " · " + nb + "거래일" : "폭 " + pct(Math.min(it.a.p, it.b.p), Math.max(it.a.p, it.b.p)) + " · " + nb + "거래일";
      label(Math.min(ax, bx) + 2, Math.min(ay, by) - 4, txt, up ? css("--up") : css("--down"));
    } else if (it.type === "fib") {
      [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(function (r) {
        var p = it.b.p + (it.a.p - it.b.p) * r, y = Y(p);
        line(Math.min(ax, bx), y, W(), y, r === 0.5 || r === 0.618 ? acc : css("--muted"), 1, r === 0 || r === 1 ? [] : [4, 3]);
        label(Math.max(ax, bx) + 4, y - 2, (r * 100).toFixed(1) + "% · " + fmt(p), tx);
      });
    }
    if (preview) { ctx.fillStyle = acc; [[ax, ay], [bx, by]].forEach(function (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, 7); ctx.fill(); }); }
  }
  function W() { try { return S.chart.timeScale().width(); } catch (e) { return S.el.clientWidth; } }
  function hl(p, color, dash, w) { var y = Y(p); if (y == null) return null; line(0, y, W(), y, color, w || 1.2, dash); return y; }
  function drawAD() {                                // 자동 작도(autodraw.py) — 추세선 · 지지·저항 · 매수 계획
    var ad = S.data.ad; if (!ad) return;
    var up = css("--up"), dn = css("--down"), acc = css("--accent"), go = css("--pass"), st = css("--stop");
    (ad.lv || []).forEach(function (v) {
      var sup = v.k === "sup", y = hl(v.p, sup ? dn : up, [6, 4], 1.2);
      if (y != null) label(6, y - 3, (sup ? "지지 " : "저항 ") + fmt(v.p) + " · " + v.n + "번", sup ? dn : up);
    });
    if (ad.hi52) { var yh = hl(ad.hi52, css("--muted"), [2, 3], 1); if (yh != null) label(6, yh - 3, "1년 최고가 " + fmt(ad.hi52), css("--muted")); }
    (ad.tl || []).forEach(function (tl) {
      var la = dayToL(tl.a[0]), lb = dayToL(tl.b[0]), ts = S.chart.timeScale();
      var ext = lb + 8, pe = tl.a[1] + (tl.b[1] - tl.a[1]) * (ext - la) / (lb - la);
      var x1 = ts.logicalToCoordinate(la), y1 = Y(tl.a[1]), x2 = ts.logicalToCoordinate(ext), y2 = Y(pe);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      var c = tl.k === "up" ? go : st;
      line(x1, y1, x2, y2, c, 2.2);
      var ex = ts.logicalToCoordinate(lb), ey = Y(tl.b[1]);
      var txt = (tl.k === "up" ? "상승 추세선" : "하락 추세선") + (tl.st === "유지" ? " · " + tl.n + "번 닿음" : tl.st === "이탈" ? " · 깨짐!" : " · 뚫음!");
      if (ex != null && ey != null) label(Math.max(4, ex - 150), ey + (tl.k === "up" ? 16 : -8), txt, c);
    });
    var pl = ad.plan; if (!pl) return;
    var ys = hl(pl.stop, dn, [3, 3], 1.6), ye = hl(pl.entry, acc, [], 2), yt = hl(pl.target, up, [3, 3], 1.6), R = W() - 150;
    if (yt != null) label(R, yt - 4, "1차 목표 " + fmt(pl.target) + " (+20%)", up);
    if (ye != null) label(R, ye - 4, "매수가 " + fmt(pl.entry), acc);
    if (ys != null) label(R, ys + 14, "손절가 " + fmt(pl.stop) + " (−10%)", dn);
  }
  function drawAuto() {
    drawAD();
    var a = S.data.a || {}, t = S.data.t, lastD = t[t.length - 1];
    var mut = css("--muted"), acc = css("--accent");
    if (a.box) {                                   // 베이스 상자 — 시작일부터 오늘까지, 베이스 고점~최저가
      var x1 = X(a.box[0]), x2 = X(lastD), y1 = Y(a.box[1]), y2 = Y(a.box[2]);
      if (x1 != null && x2 != null && y1 != null && y2 != null) {
        ctx.fillStyle = acc; ctx.globalAlpha = 0.06; ctx.fillRect(x1, y1, x2 - x1, y2 - y1); ctx.globalAlpha = 1;
        ctx.strokeStyle = acc; ctx.globalAlpha = 0.5; ctx.setLineDash([2, 3]); ctx.strokeRect(x1, y1, x2 - x1, y2 - y1); ctx.setLineDash([]); ctx.globalAlpha = 1;
        label(x1 + 2, y1 - 4, "쉬는 구간(베이스)" + (a.state && a.state !== "베이스" ? " · " + a.state : "") + (a.shape ? " · " + a.shape + "(추정)" : ""), acc);
      }
    }
    (a.cons || []).forEach(function (c, i) {        // 수축 — 고점에서 저점까지, 깊이 %
      var hx = X(c[0]), hy = Y(c[1]), lx = X(c[2]), ly = Y(c[3]);
      if (hx == null || hy == null || lx == null || ly == null) return;
      line(hx, hy, lx, ly, mut, 1.5, [5, 3]);
      label(lx + 4, ly + 14, (i + 1) + "차 수축 " + c[4] + "%", mut);
    });
    if (a.zone) {                                   // 매수 구간 — 피벗 ~ +5%
      var zy1 = Y(a.zone[1]), zy0 = Y(a.zone[0]);
      if (zy1 != null && zy0 != null) {
        ctx.fillStyle = css("--pass"); ctx.globalAlpha = 0.08; ctx.fillRect(0, zy1, W(), zy0 - zy1); ctx.globalAlpha = 1;
        label(W() - 150, zy1 - 3, "살 수 있는 구간(매수가~+5%)", css("--pass"));
      }
    }
  }
  function paint() {
    queued = false; if (!S) return;
    placed = [];
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W(), cv.height / dpr); ctx.clip();
    if (auto) drawAuto();
    items.forEach(function (it) { drawItem(it); });
    if (pending && hover) drawItem({ type: pending.type, a: pending.a, b: hover }, true);
    ctx.restore();
  }

  // ---------- 구간 분석(재기) ----------
  function analyze(it) {
    var d = S.data, i0 = Math.max(0, Math.round(dayToL(Math.min(it.a.d, it.b.d)))), i1 = Math.min(d.c.length - 1, Math.round(dayToL(Math.max(it.a.d, it.b.d))));
    if (i1 - i0 < 1) return;
    var hi = -Infinity, lo = Infinity, peak = -Infinity, mdd = 0, ups = 0, vs = 0, vn = 0;
    for (var i = i0; i <= i1; i++) {
      if (d.h[i] > hi) hi = d.h[i]; if (d.l[i] < lo) lo = d.l[i];
      if (d.c[i] > peak) peak = d.c[i]; mdd = Math.min(mdd, d.c[i] / peak - 1);
      if (i > i0 && d.c[i] > d.c[i - 1]) ups++;
      if (d.v && d.v[i] != null) { vs += d.v[i]; vn++; }
    }
    var pv = 0, pn = 0;
    for (var j = Math.max(0, i0 - 20); j < i0; j++) if (d.v && d.v[j] != null) { pv += d.v[j]; pn++; }
    var ret = (d.c[i1] / d.c[i0] - 1) * 100, day = function (k) { return new Date(d.t[k] * 86400000).toISOString().slice(0, 10); };
    var vr = pn && vn ? (vs / vn) / (pv / pn) : null;
    var out = $("[data-measure]");
    out.hidden = false;
    out.innerHTML = "<b>구간 분석</b> <span class='faint'>" + day(i0) + " → " + day(i1) + " · " + (i1 - i0) + "거래일</span>" +
      "<div class='mgrid'>" +
      "<div><span>수익률(종가)</span><b class='" + (ret > 0 ? "up" : ret < 0 ? "down" : "") + "'>" + (ret > 0 ? "+" : "") + ret.toFixed(1) + "%</b></div>" +
      "<div><span>최고 / 최저</span><b>" + fmt(hi) + " / " + fmt(lo) + "</b></div>" +
      "<div><span>폭(최고÷최저)</span><b>" + ((hi / lo - 1) * 100).toFixed(1) + "%</b></div>" +
      "<div><span>최대 낙폭</span><b class='down'>" + (mdd * 100).toFixed(1) + "%</b></div>" +
      "<div><span>오른 날</span><b>" + Math.round(ups / (i1 - i0) * 100) + "%</b></div>" +
      "<div><span>거래량(직전 20일 대비)</span><b>" + (vr ? vr.toFixed(2) + "배" : "—") + "</b></div></div>" +
      "<div class='label'>종가 기준이에요. 최대 낙폭은 그 기간 안에서 가장 크게 빠졌던 폭이에요.</div>";
  }

  // ---------- 입력 ----------
  function hit(x, y) {
    var best = -1, bd = 10;
    items.forEach(function (it, k) {
      var dd;
      if (it.type === "hline") dd = Math.abs(Y(it.p) - y);
      else if (it.type === "note") dd = Math.hypot(X(it.a.d) - x, Y(it.a.p) - y);
      else {
        var ax = X(it.a.d), ay = Y(it.a.p), bx = X(it.b.d), by = Y(it.b.p);
        if (it.type === "trend") {
          var L2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay), u = L2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2)) : 0;
          dd = Math.hypot(ax + u * (bx - ax) - x, ay + u * (by - ay) - y);
        } else {
          var inx = x >= Math.min(ax, bx) - 6 && x <= Math.max(ax, bx) + 6, iny = y >= Math.min(ay, by) - 6 && y <= Math.max(ay, by) + 6;
          dd = inx && iny ? 0 : 99;
        }
      }
      if (dd < bd) { bd = dd; best = k; }
    });
    return best;
  }
  function pos(ev) { var r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
  function push(it) { undo.push(items.slice()); items.push(it); save(); if (it.type === "measure") analyze(it); redraw(); }
  function onDown(ev) {
    if (tool === "none") return;
    ev.preventDefault();
    var q = pos(ev), pt = toPt(q[0], q[1]);
    if (tool === "erase") { var k = hit(q[0], q[1]); if (k >= 0) { undo.push(items.slice()); items.splice(k, 1); save(); redraw(); } return; }
    if (!pt) return;
    if (tool === "hline") { push({ type: "hline", p: pt.p }); return; }
    if (tool === "note") { var tx = window.prompt("메모 내용을 적어 주세요", ""); if (tx) push({ type: "note", a: pt, text: tx.slice(0, 60) }); return; }
    if (!pending) { pending = { type: tool, a: pt }; hover = pt; redraw(); return; }
    push({ type: pending.type, a: pending.a, b: pt }); pending = null; hover = null;
  }
  function onMove(ev) { if (!pending) return; var q = pos(ev), pt = toPt(q[0], q[1]); if (pt) { hover = pt; redraw(); } }
  function setTool(t) {
    tool = t; pending = null; hover = null;
    cv.style.pointerEvents = t === "none" ? "none" : "auto";
    cv.style.cursor = t === "erase" ? "not-allowed" : (t === "none" ? "" : "crosshair");
    bar.querySelectorAll("[data-tool]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tool") === t)); });
    var h = $("[data-hint]"); if (h) h.textContent = HINT[t];
    redraw();
  }
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || !S) return;
    if (b.hasAttribute("data-tool")) setTool(b.getAttribute("data-tool"));
    var act = b.getAttribute("data-act");
    if (act === "magnet") { magnet = !magnet; b.setAttribute("aria-pressed", String(magnet)); }
    if (act === "auto") { auto = !auto; b.setAttribute("aria-pressed", String(auto)); try { localStorage.setItem("draw:auto", auto ? "1" : "0"); } catch (x) {} redraw(); }
    if (act === "undo" && undo.length) { items = undo.pop(); save(); redraw(); }
    if (act === "clear" && items.length && window.confirm("이 종목에 그린 선을 모두 지울까요?")) { undo.push(items.slice()); items = []; save(); $("[data-measure]").hidden = true; redraw(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { pending = null; setTool("none"); } });

  function start(s) {
    if (S) return; S = s;
    key = "draw:" + (S.el.getAttribute("data-src") || location.pathname).replace(/^(\.\.\/)+/, "");
    try { auto = localStorage.getItem("draw:auto") !== "0"; } catch (e) {}
    bar.querySelector("[data-act=auto]").setAttribute("aria-pressed", String(auto));
    load();
    cv = document.createElement("canvas"); cv.className = "draw-layer"; cv.style.pointerEvents = "none";
    S.el.appendChild(cv); ctx = cv.getContext("2d");
    size();
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove);
    S.chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    S.chart.subscribeCrosshairMove(redraw);
    ["pointermove", "wheel", "touchmove"].forEach(function (k) { S.el.addEventListener(k, redraw, { passive: true }); });
    if (window.ResizeObserver) new ResizeObserver(function () { size(); redraw(); }).observe(S.el);
    var m = items.filter(function (it) { return it.type === "measure"; }).pop(); if (m) analyze(m);
    setTool("none");
    setTimeout(function () { size(); redraw(); }, 50);
  }
  if (window.__stockChart) start(window.__stockChart);
  window.addEventListener("stockchart", function (e) { start(e.detail); });
})();
