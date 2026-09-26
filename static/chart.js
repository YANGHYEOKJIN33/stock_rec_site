// 종목 차트 — TradingView Lightweight Charts v5 래퍼.
// 데이터: ../../data/s/{코드}.json (열 단위, 시각 = 1970-01-01 부터 일 수).
// 이동평균은 봇과 같은 단순평균(종가)이다. 출처 로고(attributionLogo)는 끄지 않는다(라이선스).
(function () {
  var el = document.getElementById("chart");
  if (!el || !window.LightweightCharts) return;
  var LC = window.LightweightCharts;
  var legend = document.getElementById("chart-legend");
  var chart, candle, vol, lines = {}, data, nd = 2;

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function fmt(v) {
    if (v == null || isNaN(v)) return "—";
    return Number(v).toLocaleString("ko-KR", { minimumFractionDigits: nd ? 2 : 0, maximumFractionDigits: nd ? 2 : 0 });
  }
  function sma(c, n) {
    var out = [], s = 0, k = 0;
    for (var i = 0; i < c.length; i++) {
      s += c[i]; k++;
      if (k > n) { s -= c[i - n]; k--; }
      out.push(k === n ? s / n : null);
    }
    return out;
  }
  function median(v, n) {
    var out = [];
    for (var i = 0; i < v.length; i++) {
      if (i < n - 1) { out.push(null); continue; }
      var w = v.slice(i - n + 1, i + 1).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
      out.push(w.length ? (w.length % 2 ? w[(w.length - 1) / 2] : (w[w.length / 2 - 1] + w[w.length / 2]) / 2) : null);
    }
    return out;
  }
  var volMed = [];
  function theme() {
    return {
      layout: { background: { type: "solid", color: css("--surface") }, textColor: css("--muted"),
        fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: true,
        panes: { separatorColor: css("--line"), separatorHoverColor: css("--line-strong") } },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--line") } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.06 } },
      timeScale: { borderVisible: false }
    };
  }
  var MA = [[20, "--accent", 0], [60, "--muted", 0], [200, "--faint", 2]];

  function draw(d) {
    data = d; nd = d.nd;
    var t = d.t.map(function (x) { return x * 86400; });
    chart = LC.createChart(el, Object.assign({ autoSize: true,
      crosshair: { mode: LC.CrosshairMode.Normal },
      localization: { locale: "ko-KR", priceFormatter: fmt } }, theme()));
    candle = chart.addSeries(LC.CandlestickSeries, {
      upColor: css("--up"), downColor: css("--down"), borderVisible: false,
      wickUpColor: css("--up"), wickDownColor: css("--down"), priceLineVisible: false,
      priceFormat: { type: "price", precision: nd ? 2 : 0, minMove: nd ? 0.01 : 1 } });
    var bars = [];
    for (var i = 0; i < t.length; i++) {
      if (d.o[i] == null || d.c[i] == null) continue;
      bars.push({ time: t[i], open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i] });
    }
    candle.setData(bars);
    MA.forEach(function (m) {
      var s = sma(d.c, m[0]), pts = [];
      for (var i = 0; i < t.length; i++) if (s[i] != null) pts.push({ time: t[i], value: s[i] });
      lines[m[0]] = { series: chart.addSeries(LC.LineSeries, { color: css(m[1]), lineWidth: 1,
        lineStyle: m[2], priceLineVisible: false, lastValueVisible: false,
        crosshairMarkerVisible: false }), values: s };
      lines[m[0]].series.setData(pts);
    });
    if (d.v && d.v.length) {
      vol = chart.addSeries(LC.HistogramSeries, { priceFormat: { type: "volume" },
        priceLineVisible: false, lastValueVisible: false }, 1);
      vol.setData(t.map(function (x, i) {
        return { time: x, value: d.v[i] || 0,
          color: (d.c[i] >= d.o[i] ? css("--up") : css("--down")) + "66" };
      }));
      // 20일 중앙값 — 오늘 거래량이 평소의 몇 배인지(②관문 돌파 거래량과 같은 눈금)
      volMed = median(d.v, 20);
      var vm = chart.addSeries(LC.LineSeries, { color: css("--muted"), lineWidth: 1, priceLineVisible: false,
        lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: { type: "volume" } }, 1);
      vm.setData(t.map(function (x, i) { return volMed[i] == null ? null : { time: x, value: volMed[i] }; })
        .filter(Boolean));
      try { chart.panes()[1].setStretchFactor(0.25); } catch (e) {}
    }
    var an = d.a || {};
    var hasAD = !!d.ad;                               // 자동 작도가 지지·저항·손절·목표를 그린다 — 가격선은 겹치지 않게 뺀다
    (hasAD ? [] : (an.res || []).concat(an.sup || [])).forEach(function (lv) {
      candle.createPriceLine({ price: lv[0], color: css("--line-strong"), lineWidth: 1, lineStyle: 0,
        axisLabelVisible: false, title: lv[1] + "회" });
    });
    // 두 피벗이 사실상 같으면(0.2% 안) 한 줄로 — 겹친 글자는 못 읽는다
    var same = an.bp && d.pivot && Math.abs(an.bp / d.pivot - 1) < 0.002;
    if (an.bp && !same) {
      candle.createPriceLine({ price: an.bp, color: css("--accent"), lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: "베이스 피벗" });
    }
    // 기관 순매수 창(KRX · 억원) — 이력이 있을 때만
    if (d.f && d.f.t && d.f.t.length) {
      var fl = chart.addSeries(LC.HistogramSeries, { priceLineVisible: false, lastValueVisible: false,
        priceFormat: { type: "price", precision: 1, minMove: 0.1 } }, 2);
      var fp = [];
      for (var q = 0; q < d.f.t.length; q++) {
        if (d.f.inst[q] == null) continue;
        fp.push({ time: d.f.t[q] * 86400, value: d.f.inst[q],
          color: (d.f.inst[q] >= 0 ? css("--up") : css("--down")) + "99" });
      }
      fl.setData(fp);
      try { chart.panes()[2].setStretchFactor(0.2); } catch (e) {}
    }
    // 손절·목표 — 20일 고가에서 샀다고 칠 때 규칙 값(값이 피벗 근처일 때만 빌드가 싣는다)
    if (an.stop && !hasAD) candle.createPriceLine({ price: an.stop, color: css("--down"), lineWidth: 1, lineStyle: 1,
      axisLabelVisible: true, title: "손절 −" + an.stop_pct + "%" });
    if (an.tgt && !hasAD) candle.createPriceLine({ price: an.tgt, color: css("--up"), lineWidth: 1, lineStyle: 1,
      axisLabelVisible: true, title: "목표 +" + an.tgt_pct + "%" });
    // RS 선(종가 ÷ 지수, 첫 값 100) — 맨 아래 칸. 오르면 지수보다 강하다
    if (d.rs && d.rs.length) {
      var rp = chart.panes().length;
      var rsS = chart.addSeries(LC.LineSeries, { color: css("--accent"), lineWidth: 1, priceLineVisible: false,
        lastValueVisible: true, crosshairMarkerVisible: false, priceFormat: { type: "price", precision: 1, minMove: 0.1 } }, rp);
      rsS.setData(t.map(function (x, i) { return d.rs[i] == null ? null : { time: x, value: d.rs[i] }; }).filter(Boolean));
      try { chart.panes()[rp].setStretchFactor(0.2); } catch (e) {}
    }
    if (d.pivot && !(hasAD && d.ad.plan)) {             // 매수가(= 20일 고가)는 자동 작도가 그린다
      candle.createPriceLine({ price: d.pivot, color: same ? css("--accent") : css("--muted"), lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: same ? "20일 고가 = 베이스 피벗" : "20일 고가" });
    }
    var mks = (d.m || []).slice();
    if (an.bs) mks.push({ t: an.bs, k: "base", x: "베이스 시작" });
    mks.sort(function (a, b) { return a.t - b.t; });
    if (mks.length && LC.createSeriesMarkers) {
      LC.createSeriesMarkers(candle, mks.map(function (m) {
        if (m.k === "base") return { time: m.t * 86400, position: "aboveBar", shape: "arrowDown",
          color: css("--accent"), text: m.x, size: 1 };
        if (m.k === "earn") return { time: m.t * 86400, position: "belowBar", shape: "square",
          color: css("--text"), text: "실적", size: 0.6 };
        if (m.k === "disc") return { time: m.t * 86400, position: "aboveBar", shape: "square",
          color: css("--muted"), size: 0.4 };
        // 기관(수급) 진입 — 연속된 날의 첫날에 보라 화살표 + 글자, 이어진 날은 작은 점
        if (m.k === "flow") return { time: m.t * 86400, position: "belowBar", shape: "arrowUp",
          color: css("--flow"), text: "🏦" + m.x, size: 1.2 };
        if (m.k === "flowd") return { time: m.t * 86400, position: "belowBar", shape: "circle",
          color: css("--flow"), size: 0.35 };
        var sig = m.k === "signal";
        // 언급은 글자 없이 작은 점만 — 글자를 달면 한 달 치가 캔들을 덮는다(범례에서 읽는다)
        return sig ? { time: m.t * 86400, position: "belowBar", shape: "arrowUp",
                       color: css("--accent"), text: m.x, size: 1 }
                   : { time: m.t * 86400, position: "aboveBar", shape: "circle",
                       color: css("--line-strong"), size: 0.3 };
      }));
    }
    chart.subscribeCrosshairMove(function (p) { show(p && p.logical != null ? Math.round(p.logical) : null); });
    range(Number(el.getAttribute("data-range") || 126));
    show(null);
    // 작도(draw.js)가 같은 차트를 쓴다
    window.__stockChart = { chart: chart, candle: candle, data: d, el: el };
    window.dispatchEvent(new CustomEvent("stockchart", { detail: window.__stockChart }));
  }

  function show(i) {
    if (!legend || !data) return;
    var k = data.c.length - 1;
    var j = i == null || i < 0 || i > k ? k : i;
    var date = new Date(data.t[j] * 86400000).toISOString().slice(0, 10);
    var ch = j > 0 && data.c[j - 1] ? (data.c[j] / data.c[j - 1] - 1) * 100 : null;
    var cls = ch == null ? "" : (ch > 0 ? "up" : (ch < 0 ? "down" : ""));
    var ma = MA.map(function (m) { return "MA" + m[0] + " " + fmt(lines[m[0]] && lines[m[0]].values[j]); }).join(" · ");
    var ev = (data.m || []).filter(function (m) { return m.t === data.t[j]; })
      .map(function (m) { return ({ signal: "▲", earn: "■", disc: "◆", flow: "🏦", flowd: "🏦" }[m.k] || "●") + m.x; }).join(" ");
    if (ev) ma += " · " + ev;
    if (data.v && data.v[j] != null && volMed[j]) ma += " · 거래량 20일 중앙값의 " + (data.v[j] / volMed[j]).toFixed(1) + "배";
    if (data.rs && data.rs[j] != null) ma += " · RS선 " + data.rs[j].toFixed(1);
    if (data.f && data.f.t) {
      var fi = data.f.t.indexOf(data.t[j]);
      if (fi >= 0 && data.f.inst[fi] != null) ma += " · 기관 " + (data.f.inst[fi] > 0 ? "+" : "") + data.f.inst[fi] + "억" +
        (data.f.pension[fi] != null ? " (연기금 " + (data.f.pension[fi] > 0 ? "+" : "") + data.f.pension[fi] + ")" : "");
    }
    legend.innerHTML = '<span class="num">' + date + "</span> 종가 <b class=\"num " + cls + "\">" + fmt(data.c[j]) +
      "</b>" + (ch == null ? "" : ' <span class="num ' + cls + '">' + (ch > 0 ? "+" : "") + ch.toFixed(2) + "%</span>") +
      '<br><span class="label">' + ma + "</span>";
  }

  function range(n) {
    if (!chart || !data) return;
    var k = data.c.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, k - n), to: k + 2 });
    document.querySelectorAll("[data-range-btn]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-range-btn")) === n));
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-range-btn]");
    if (b) range(Number(b.getAttribute("data-range-btn")));
    if (e.target.closest("[data-set]") && chart) setTimeout(function () { chart.applyOptions(theme()); }, 0);
  });

  fetch(el.getAttribute("data-src")).then(function (r) { return r.json(); }).then(draw)
    .catch(function () { el.innerHTML = '<div class="muted" style="padding:16px">차트를 불러오지 못했어요.</div>'; });
})();
