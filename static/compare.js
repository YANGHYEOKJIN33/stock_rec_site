// 종목 비교 — 두 종목을 같은 출발점(100)으로 겹친다. 자료는 종목 차트 JSON 을 그대로 쓴다.
(function () {
  var el = document.getElementById("cmp");
  if (!el || !window.LightweightCharts) return;
  var LC = window.LightweightCharts, root = el.getAttribute("data-root");
  var selA = document.getElementById("cmp-a"), selB = document.getElementById("cmp-b");
  var out = document.getElementById("cmp-out");
  var chart, sA, sB, n = 126, cache = {};
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function load(slug) {
    if (cache[slug]) return Promise.resolve(cache[slug]);
    return fetch(root + "data/s/" + slug + ".json").then(function (r) { return r.json(); })
      .then(function (d) { cache[slug] = d; return d; });
  }
  function init() {
    chart = LC.createChart(el, { autoSize: true, localization: { locale: "ko-KR" },
      layout: { background: { type: "solid", color: css("--surface") }, textColor: css("--muted"), attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--line") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false } });
    sA = chart.addSeries(LC.LineSeries, { color: css("--accent"), lineWidth: 2, priceLineVisible: false });
    sB = chart.addSeries(LC.LineSeries, { color: css("--text"), lineWidth: 1, priceLineVisible: false });
  }
  function corr(x, y) {
    var k = x.length; if (k < 20) return null;
    var mx = 0, my = 0, i; for (i = 0; i < k; i++) { mx += x[i]; my += y[i]; } mx /= k; my /= k;
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < k; i++) { var a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }
  function draw() {
    var a = selA.value, b = selB.value;
    try { history.replaceState(null, "", "#" + a + "," + b); } catch (e) {}
    Promise.all([load(a), load(b)]).then(function (ds) {
      var A = ds[0], B = ds[1], mb = {};
      B.t.forEach(function (t, i) { mb[t] = B.c[i]; });
      var common = [];
      A.t.forEach(function (t, i) { if (mb[t] != null && A.c[i] != null) common.push([t, A.c[i], mb[t]]); });
      common = common.slice(-n);
      if (common.length < 2) { out.textContent = "겹치는 거래일이 없어요(한국과 미국은 휴장일이 달라서 겹치는 날이 줄어요)."; return; }
      var a0 = common[0][1], b0 = common[0][2];
      sA.setData(common.map(function (r) { return { time: r[0] * 86400, value: r[1] / a0 * 100 }; }));
      sB.setData(common.map(function (r) { return { time: r[0] * 86400, value: r[2] / b0 * 100 }; }));
      chart.timeScale().fitContent();
      var ra = [], rb = [];
      var tail = common.slice(-61);
      for (var i = 1; i < tail.length; i++) { ra.push(tail[i][1] / tail[i - 1][1] - 1); rb.push(tail[i][2] / tail[i - 1][2] - 1); }
      var c = corr(ra, rb), last = common[common.length - 1];
      var fa = (last[1] / a0 - 1) * 100, fb = (last[2] / b0 - 1) * 100;
      out.innerHTML = '<span style="color:var(--accent)">━</span> ' + selA.options[selA.selectedIndex].text + " " +
        (fa > 0 ? "+" : "") + fa.toFixed(1) + '% · <span>━</span> ' + selB.options[selB.selectedIndex].text + " " +
        (fb > 0 ? "+" : "") + fb.toFixed(1) + "% · 겹친 " + common.length + "거래일" +
        (c == null ? "" : " · 최근 60일 일간 수익률 상관 " + c.toFixed(2));
    }).catch(function () { out.textContent = "시세 파일을 불러오지 못했어요."; });
  }
  var h = (location.hash || "").slice(1).split(",");
  if (h.length === 2) { selA.value = h[0] || selA.value; selB.value = h[1] || selB.value; }
  init();
  selA.addEventListener("change", draw); selB.addEventListener("change", draw);
  document.addEventListener("click", function (e) {
    var bt = e.target.closest("[data-cmp-range]"); if (!bt) return;
    n = Number(bt.getAttribute("data-cmp-range"));
    document.querySelectorAll("[data-cmp-range]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === bt)); });
    draw();
  });
  draw();
})();
