// 10년 주봉(2026-09-26 JIN 2차 #8) — 버튼을 누를 때만 자료를 받아 따로 그린다. 메인 일봉 차트는 건드리지 않는다
(function () {
  var btn = document.querySelector("[data-wk]");
  if (!btn || !window.LightweightCharts) return;
  var box = document.querySelector(".wkbox"), el = document.querySelector("[data-wk-chart]"), made = false;
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function ma(c, n) {
    var out = [], s = 0;
    for (var i = 0; i < c.length; i++) {
      s += c[i] || 0;
      if (i >= n) s -= c[i - n] || 0;
      out.push(i >= n - 1 ? s / n : null);
    }
    return out;
  }
  function draw(d) {
    var LC = window.LightweightCharts;
    var chart = LC.createChart(el, { autoSize: true, layout: { background: { color: "transparent" }, textColor: css("--muted") },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--line") } }, rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false } });
    var up = css("--up"), dn = css("--down");
    var cs = chart.addSeries(LC.CandlestickSeries, { upColor: up, downColor: dn, borderVisible: false, wickUpColor: up, wickDownColor: dn,
      priceFormat: { type: "price", precision: d.nd, minMove: d.nd ? Math.pow(10, -d.nd) : 1 } });
    var t = d.t.map(function (x) { return x * 86400; });
    cs.setData(t.map(function (x, i) { return d.c[i] == null ? null : { time: x, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i] }; }).filter(Boolean));
    [[10, css("--accent")], [40, css("--warn")]].forEach(function (m) {
      var v = ma(d.c, m[0]);
      var ls = chart.addSeries(LC.LineSeries, { color: m[1], lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ls.setData(t.map(function (x, i) { return v[i] == null ? null : { time: x, value: v[i] }; }).filter(Boolean));
    });
    chart.timeScale().fitContent();
  }
  btn.addEventListener("click", function () {
    var open = box.hidden;
    box.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "📅 10년 주봉 닫기" : "📅 10년 주봉 보기";
    if (open && !made) {
      made = true;
      fetch(btn.getAttribute("data-wk")).then(function (r) { return r.json(); }).then(draw)
        .catch(function () { el.innerHTML = '<div class="muted" style="padding:16px">주봉 자료를 불러오지 못했어요.</div>'; });
    }
  });
})();
