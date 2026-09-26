// 지도 장중 색 — 두 겹.
//   1) 지연 스냅샷(U3): 키 없이 모든 칸을 그 시각 등락으로 다시 칠한다(5분마다 새 사진이 있나 본다)
//   2) Finnhub 키가 있으면(U2): 가장 큰 50칸(무료 구독 한도)을 체결마다 다시 칠한다 — 스냅샷보다 우선
// 스냅샷이 없거나 오래됐으면 종가 색 그대로. 위 숫자 카드·아래 분포는 종가 기준이다.
(function () {
  var box = document.querySelector("[data-livemap]"); if (!box) return;
  var R = box.getAttribute("data-root"), SNAP = box.getAttribute("data-snap") || "";
  var key = null; try { key = localStorage.getItem("fh_key"); } catch (e) {}
  var btn = box.querySelector("[data-livemap-btn]"), note = box.querySelector("[data-livemap-note]");
  var tiles = Array.prototype.slice.call(document.querySelectorAll("rect.tile"));
  var byT = {}, twins = {};                           // 넓은 화면·휴대폰 지도가 같은 종목 칸을 하나씩 가진다 — 둘 다 칠한다
  tiles.forEach(function (t) { var k = t.getAttribute("data-t"); byT[k] = t; (twins[k] = twins[k] || []).push(t); });
  var prev = {}, viaWs = {}, wsVal = {}, last = null, msg = { snap: "지금 색은 종가 기준이에요.", ws: "" };
  // 지도 기간 전환(period.js): 장중 색은 1일에서만. 1일로 돌아오면 마지막 사진·체결을 다시 칠한다
  function daily() { var p = document.body.getAttribute("data-period"); return !p || p === "d1"; }
  function say() { note.textContent = [msg.snap, msg.ws].filter(Boolean).join(" · "); }
  function setCls(el, c) { el.setAttribute("class", el.getAttribute("class").replace(/\b(n3|n2|n1|z|p1|p2|p3|na)\b/, c)); }
  // 글자 꼴은 빌드 때 지도(viz.treemap)와 같게: +1.2% / -0.8%
  function paint(el, v, when) { (twins[el.getAttribute("data-t")] || [el]).forEach(function (e) { paint1(e, v, when); }); }
  function paint1(el, ch, when) {
    var c = Snap.bin(ch), v = (ch >= 0 ? "+" : "") + ch.toFixed(1) + "%";
    setCls(el, c); el.setAttribute("data-c", v + (when ? " · " + when : ""));
    el.parentNode.querySelectorAll("text").forEach(function (tx) {
      setCls(tx, c);
      if (tx.getAttribute("class").indexOf("tv") === 0) tx.textContent = v;
    });
  }

  // ---- 1) 지연 스냅샷 ----
  Snap.watch(SNAP, function (s) { last = s; applySnap(s); });
  document.addEventListener("periodchange", function (e) {
    if (e.detail.k !== 0) return;
    if (last) applySnap(last);
    Object.keys(wsVal).forEach(function (t) { if (byT[t]) paint(byT[t], wsVal[t], "체결"); });
  });
  function applySnap(s) {
    if (!s) { if (SNAP) { msg.snap = "종가 기준 색이에요 · 장중 스냅샷이 아직 없어요"; say(); } return; }
    if (!daily()) return;
    var d = s.d;
    if (!s.fresh) { msg.snap = "종가 기준 색이에요 · 마지막 장중 스냅샷(" + d.et + " ET)은 오래돼서 쓰지 않았어요"; say(); return; }
    var n = 0;
    Object.keys(d.q).forEach(function (t) {
      var q = d.q[t]; if (q[3]) prev[t] = q[3];
      var el = byT[t]; if (!el || viaWs[t]) return;
      paint(el, q[1], d.et + " ET"); n++;
    });
    msg.snap = "장중 스냅샷 " + d.et + " ET 색(약 " + s.ageMin + "분 전) · " + n + "칸";
    say();
    // 위 숫자 카드는 종가 기준 — 장중 값은 따로 한 줄로(섞지 않는다)
    var k = document.querySelector("[data-snap-kpi]");
    if (k) { k.textContent = "장중 " + d.et + " ET 스냅샷: 상승 " + d.adv + " · 하락 " + d.dec + " — 위 숫자는 종가 기준이에요"; k.hidden = false; }
  }

  // ---- 2) Finnhub 체결 ----
  if (!key) {
    btn.hidden = true;
    msg.ws = "체결마다 바꾸려면 미국 › 실시간에서 Finnhub 키를 넣어 주세요";
    say(); return;
  }
  say();
  btn.addEventListener("click", function () {
    btn.disabled = true; msg.ws = "연결 중…"; say();
    fetch(R + "data/live_base.json").then(function (r) { return r.json(); }).then(function (d) {
      var big = tiles.slice().sort(function (a, b) { return b.width.baseVal.value * b.height.baseVal.value - a.width.baseVal.value * a.height.baseVal.value; });
      var by = {}; big.slice(0, 50).forEach(function (t) { by[t.getAttribute("data-t")] = t; });
      var ws = new WebSocket("wss://ws.finnhub.io?token=" + encodeURIComponent(key));
      ws.onopen = function () {
        Object.keys(by).forEach(function (s) { ws.send(JSON.stringify({ type: "subscribe", symbol: s })); });
        msg.ws = "실시간 색을 켰어요 · 큰 칸 50개는 체결될 때마다 바뀌어요"; say();
      };
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.type !== "trade") return;
        m.data.forEach(function (x) {
          var t = by[x.s], b = d.b[x.s]; if (!t || !b) return;
          // 전일 종가: 스냅샷이 준 값 우선, 없으면 빌드 때 종가(하루 늦을 수 있다)
          var pc = prev[x.s] || b[1];
          viaWs[x.s] = true;
          wsVal[x.s] = (x.p / pc - 1) * 100;
          if (daily()) paint(t, wsVal[x.s], "체결");
        });
      };
      ws.onclose = function () { msg.ws = "실시간 연결이 끊겼어요 — 새로고침하면 다시 켤 수 있어요"; say(); btn.disabled = false; };
    });
  });
})();
