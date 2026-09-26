// 시각화 공통 — 마우스 값 표시와 시계열(Lightweight Charts).
// 규칙: 값이 먼저 굵게, 이름은 뒤. 이름은 신뢰하지 않는 자료라 textContent 로만 넣는다.
(function () {
  var tip = document.createElement("div");
  tip.className = "vtip";
  document.body.appendChild(tip);

  function show(ev, value, label, sub) {
    tip.textContent = "";
    var b = document.createElement("b"); b.textContent = value; tip.appendChild(b);
    var s = document.createElement("span"); s.textContent = label + (sub ? " · " + sub : ""); tip.appendChild(s);
    tip.style.display = "block";
    var x = ev.clientX + 14, y = ev.clientY + 14;
    var r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hide() { tip.style.display = "none"; }

  // 트리맵 칸 · 히스토그램 막대
  document.addEventListener("pointermove", function (e) {
    var t = e.target;
    if (t.matches && t.matches("rect.tile")) {
      show(e, t.getAttribute("data-c") || "—", t.getAttribute("data-t") + " " + (t.getAttribute("data-n") || ""), t.getAttribute("data-s"));
      return;
    }
    if (t.matches && t.matches("path.bar")) { show(e, t.getAttribute("data-v"), t.getAttribute("data-l")); return; }
    if (t.matches && t.matches("rect.hit")) { scatterHover(e, t); return; }
    hide();
  });
  document.addEventListener("pointerleave", hide);

  // 산점도: 가장 가까운 점(24px 안) — 점을 정확히 겨누지 않아도 된다
  function nearest(e, hit) {
    var svg = hit.ownerSVGElement, pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    var pts = hit._pts || (hit._pts = JSON.parse(hit.getAttribute("data-pts") || "[]"));
    var best = null, bd = 1e9;
    var scale = svg.getScreenCTM().a || 1;
    for (var i = 0; i < pts.length; i++) {
      var dx = pts[i][0] - p.x, dy = pts[i][1] - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = pts[i]; }
    }
    return best && Math.sqrt(bd) * scale <= 24 ? best : null;
  }
  function scatterHover(e, hit) {
    var b = nearest(e, hit);
    if (!b) { hide(); hit.style.cursor = "crosshair"; return; }
    hit.style.cursor = b[5] ? "pointer" : "crosshair";
    if (hit.getAttribute("data-fmt") === "rrg") show(e, "비율 " + b[3] + " · 모멘텀 " + b[4], b[2] + " · " + b[6]);
    else show(e, "RS " + b[4] + " · 고점 " + (b[3] > 0 ? "+" : "") + b[3] + "%", b[2]);
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.matches && t.matches("rect.hit")) {
      var b = nearest(e, t);
      if (b && b[5]) location.href = (t.closest("[data-root]") || document.body).getAttribute("data-root") + b[5];
    }
  });

  // ---------- 시계열(Lightweight Charts) ----------
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function draw(el) {
    var LC = window.LightweightCharts; if (!LC) return;
    var d = JSON.parse(el.getAttribute("data-json"));
    var legend = el.previousElementSibling && el.previousElementSibling.classList.contains("lwc-legend") ? el.previousElementSibling : null;
    var chart = LC.createChart(el, { autoSize: true, localization: { locale: "ko-KR" },
      layout: { background: { type: "solid", color: css("--surface") }, textColor: css("--muted"), attributionLogo: true,
        fontFamily: getComputedStyle(document.body).fontFamily },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--gridc") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false },
      handleScroll: false, handleScale: false });
    var t = d.t.map(function (x) { return x * 86400; });
    var series = [];
    (d.series || []).forEach(function (s) {
      var pf = { type: "price", precision: s.prec || 0, minMove: s.prec ? Math.pow(10, -s.prec) : 1 };
      var opt = { color: css(s.color), lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerRadius: 4, title: s.name, priceFormat: pf };
      var sr = s.kind === "hist" ? chart.addSeries(LC.HistogramSeries, { color: css(s.color), priceLineVisible: false, lastValueVisible: false, priceFormat: pf })
                                 : chart.addSeries(LC.LineSeries, opt);
      sr.setData(t.map(function (x, i) { return s.v[i] == null ? { time: x } : { time: x, value: s.v[i] }; }));
      if (s.guide != null) sr.createPriceLine({ price: s.guide, color: css("--line-strong"), lineWidth: 1, lineStyle: 0, axisLabelVisible: false });
      series.push([s, sr]);
    });
    chart.timeScale().fitContent();
    function readout(i) {
      if (!legend) return;
      legend.textContent = "";
      var j = (i == null || i < 0 || i >= t.length) ? t.length - 1 : i;
      var dt = document.createElement("span"); dt.className = "label";
      dt.textContent = new Date(t[j] * 1000).toISOString().slice(0, 10) + "  ";
      legend.appendChild(dt);
      series.forEach(function (p) {
        var s = p[0];
        var k = document.createElement("i"); k.className = "key " + (s.key || "");
        if (!s.key) k.style.background = css(s.color);
        var v = document.createElement("b"); v.textContent = (s.v[j] == null ? "—" : s.v[j] + (s.unit || "")) + " ";
        var n = document.createElement("span"); n.className = "label"; n.textContent = s.name + "   ";
        legend.appendChild(k); legend.appendChild(v); legend.appendChild(n);
      });
    }
    chart.subscribeCrosshairMove(function (p) {
      if (!p || p.time == null) return readout(null);
      readout(t.indexOf(p.time));
    });
    readout(null);
  }
  function init() { document.querySelectorAll(".lwc[data-json]").forEach(draw); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
