// 두 ETF 비교(10/5) — data/etf.json(보수 · 운용 자산 · 상위 25종목)으로 브라우저가 겹침을 잰다. 서버로 보내는 것 없음
(function () {
  var box = document.querySelector("[data-etfcmp]");
  if (!box) return;
  var out = box.querySelector("[data-out]"), sa = box.querySelector("[data-a]"), sb = box.querySelector("[data-b]");
  var root = box.getAttribute("data-root") || "";
  var D = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function f(x, n, u) { return x == null ? "—" : Number(x).toFixed(n) + (u || ""); }
  function draw() {
    if (!D) return;
    var a = sa.value, b = sb.value, A = D[a], B = D[b];
    if (!A || !B) { out.innerHTML = '<div class="muted">자료가 없는 ETF 예요.</div>'; return; }
    var wa = {}, wb = {}, names = {};
    (A.h || []).forEach(function (h) { wa[h[0]] = h[2]; names[h[0]] = h[1]; });
    (B.h || []).forEach(function (h) { wb[h[0]] = h[2]; names[h[0]] = names[h[0]] || h[1]; });
    var common = Object.keys(wa).filter(function (s) { return s in wb; });
    common.sort(function (x, y) { return Math.min(wb[y], wa[y]) - Math.min(wb[x], wa[x]); });
    var ov = common.reduce(function (t, s) { return t + Math.min(wa[s], wb[s]); }, 0);
    var row = function (lb, x, y) { return "<tr><td>" + lb + '</td><td class="r num">' + x + '</td><td class="r num">' + y + "</td></tr>"; };
    var h = '<div class="kpis"><div><div class="v">' + ov.toFixed(1) + '%</div><div class="l">겹치는 비중 · ' + common.length + "종목</div></div></div>";
    h += '<div class="tablewrap" style="margin-top:10px"><table class="tbl"><thead><tr><th></th><th class="r"><a href="' + root + "us/etf/" + a.toLowerCase() + '/">' + esc(a) + '</a></th><th class="r"><a href="' + root + "us/etf/" + b.toLowerCase() + '/">' + esc(b) + "</a></th></tr></thead>";
    h += row("무엇", esc(A.d), esc(B.d)) + row("총보수", f(A.er, 2, "%"), f(B.er, 2, "%")) +
      row("운용 자산", A.aum ? (A.aum / 1e9).toFixed(0) + "B" : "—", B.aum ? (B.aum / 1e9).toFixed(0) + "B" : "—") +
      row("종목 수", A.n || "—", B.n || "—") + row("상위 10 비중", f(A.top10, 0, "%"), f(B.top10, 0, "%")) +
      row("PER", f(A.pe, 1), f(B.pe, 1)) + row("3달 · 1년", f(A.m3, 1, "%") + " · " + f(A.y1, 1, "%"), f(B.m3, 1, "%") + " · " + f(B.y1, 1, "%"));
    h += "</table></div>";
    if (common.length) {
      h += '<h3 style="margin-top:12px">함께 담은 종목</h3><div class="hold2">';
      common.slice(0, 12).forEach(function (s) {
        h += '<div class="hrow"><b>' + esc(s) + '</b> <span class="faint">' + esc(names[s]) + '</span><span class="num">' + wa[s].toFixed(1) + " / " + wb[s].toFixed(1) + "%</span></div>";
      });
      h += "</div>";
    } else { h += '<div class="muted" style="margin-top:10px">상위 25종목 중 겹치는 종목이 없어요.</div>'; }
    out.innerHTML = h;
  }
  sa.addEventListener("change", draw);
  sb.addEventListener("change", draw);
  fetch(box.getAttribute("data-src")).then(function (r) { return r.json(); }).then(function (j) { D = j; draw(); })
    .catch(function () { out.innerHTML = '<div class="muted">비교 자료를 불러오지 못했어요.</div>'; });
})();
