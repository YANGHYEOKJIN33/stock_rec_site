// 실시간 — Finnhub 웹소켓(무료: 미국 종목 동시 50개). 계획 17-1 · U2.
// 키는 보는 사람이 직접 넣는다. 이 기기 브라우저(localStorage)에만 저장하고 finnhub.io 로만 보낸다.
// 체결이 올 때마다 기준값(빌드 때 만든 live_base.json)으로 다시 잰다 — 전일 대비·20일 고가·50/200일선·52주 고점.
// 거래량 조건(②관문의 1.5배)은 장중에 확정할 수 없어 여기서 판정하지 않는다.
// 키가 없으면 장중 지연 스냅샷(U3 · snap.js)으로 채운다 — 체결마다가 아니라 30분/1시간마다의 사진.
// 거래량 속도(누적 ÷ 20일 평균 × 장 경과)는 스냅샷에만 있다 — 키가 있어도 속도는 스냅샷 시각 값이다.
(function () {
  var root = document.querySelector("[data-live]");
  if (!root) return;
  var R = root.getAttribute("data-root"), SNAP = root.getAttribute("data-snap") || "";
  var MAX = 50, KEYK = "fh_key", LISTK = "live_list";
  var $ = function (s) { return root.querySelector(s); };
  var base = {}, rows = {}, state = {}, pcs = {}, pace = {}, fresh = {}, snap = null, when = null, ws = null, retry = 0, lastTick = 0;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function fmt(v, nd) { return v == null || isNaN(v) ? "—" : Number(v).toLocaleString("ko-KR", { minimumFractionDigits: nd, maximumFractionDigits: nd }); }
  function pct(v) { return v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%"; }
  var bin = Snap.bin;
  function status(s) { var el = $("[data-status]"); el.textContent = s; }

  function list() {
    var saved = (get(LISTK) || "").split(/[\s,]+/).filter(Boolean);
    var def = (root.getAttribute("data-default") || "").split(",").filter(Boolean);
    return (saved.length ? saved : def).map(function (x) { return x.toUpperCase(); }).filter(function (x) { return base[x]; }).slice(0, MAX);
  }

  // ---------- 표 ----------
  function buildTable() {
    var tb = $("tbody"); tb.textContent = ""; rows = {};
    list().forEach(function (t) {
      var b = base[t], tr = document.createElement("tr");
      var c0 = document.createElement("td"), a = document.createElement("a");
      a.href = R + b[8]; a.textContent = t; c0.appendChild(a);
      var nm = document.createElement("div"); nm.className = "label"; nm.textContent = b[0]; c0.appendChild(nm);
      var c1 = document.createElement("td"); c1.className = "r num";
      var c2 = document.createElement("td"); c2.className = "r cell-d na";
      var c3 = document.createElement("td"); c3.className = "label";
      [c0, c1, c2, c3].forEach(function (c) { tr.appendChild(c); });
      tb.appendChild(tr);
      rows[t] = { tr: tr, px: c1, ch: c2, st: c3, last: null };
      var q = snap && snap.q[t];
      if (q && !fresh[t]) { pace[t] = q[2]; paint(t, q[0], q[3], "snap"); } else paint(t, null);
    });
    $("[data-count]").textContent = Object.keys(rows).length;
  }

  // 기준값: [이름, 전일종가, 20일고가(피벗), 50일선, 200일선, 52주고가, 20일평균거래량, 섹터, 링크]
  // src: "snap"(지연 스냅샷) | 없음(체결·REST). 체결·REST 로 한 번 받은 종목은 스냅샷이 덮지 않는다
  function paint(t, px, pc, src) {
    var r = rows[t], b = base[t]; if (!r) return;
    if (src !== "snap" && px != null) fresh[t] = true;
    r.px.title = src === "snap" && snap ? "장중 스냅샷 " + snap.et + " ET" : "";
    // 전일 종가: Finnhub 가 준 값(pc)을 기억해 이후 체결에도 쓴다. 못 받았으면 빌드 때 종가(하루 늦을 수 있다)
    if (pc) pcs[t] = pc;
    var prev = pcs[t] || b[1];
    if (px == null) { r.px.textContent = fmt(b[1], 2); r.ch.textContent = "—"; r.ch.title = "아직 체결이 없어서 전일 종가를 보여 줘요"; r.ch.className = "r cell-d na"; r.st.textContent = tags(b[1], b, t).join(" "); return; }
    var ch = (px / prev - 1) * 100;
    r.px.textContent = fmt(px, 2);
    r.ch.textContent = pct(ch); r.ch.className = "r cell-d " + bin(ch);
    r.st.textContent = tags(px, b, t).join(" ");
    if (r.last != null && px !== r.last) {
      r.tr.classList.remove("flash-up", "flash-dn"); void r.tr.offsetWidth;
      r.tr.classList.add(px > r.last ? "flash-up" : "flash-dn");
    }
    r.last = px;
    when = src === "snap" && snap ? snap.et + " ET" : null;
    check(t, px, prev, b);
  }
  // 짧은 표지: 피벗(20일 고가)까지 거리 · 50/200일선 위(▲)·아래(▼) · 52주 신고가
  function tags(px, b, t) {
    var out = [];
    if (b[2]) out.push(px > b[2] ? "피벗 위" : "피벗까지 " + ((b[2] / px - 1) * 100).toFixed(1) + "%");
    if (b[3]) out.push("50" + (px > b[3] ? "▲" : "▼"));
    if (b[4]) out.push("200" + (px > b[4] ? "▲" : "▼"));
    if (b[5] && px >= b[5]) out.push("신고가");
    if (pace[t] != null) out.push("속도 " + pace[t].toFixed(1) + "배");
    return out;
  }

  // ---------- 상태가 바뀌는 순간만 알림 ----------
  function check(t, px, prev, b) {
    var s = state[t] || (state[t] = {});
    var now = { piv: b[2] ? px > b[2] : null, m50: b[3] ? px > b[3] : null, m200: b[4] ? px > b[4] : null,
      hi: b[5] ? px >= b[5] : null, big: Math.abs((px / prev - 1) * 100) >= 3 };
    now.pv = !!(now.piv && pace[t] != null && pace[t] >= 1.5);
    if (s.init) {
      if (now.piv && !s.piv) log(t, "20일 고가 " + fmt(b[2], 2) + " 돌파 — ②관문 가격 조건 충족(거래량은 장 마감 뒤 확정)", "p");
      if (s.piv && now.piv === false) log(t, "20일 고가 아래로 다시 밀림", "n");
      if (now.m50 !== s.m50 && now.m50 != null) log(t, now.m50 ? "50일선 위로" : "50일선 아래로", now.m50 ? "p" : "n");
      if (now.m200 !== s.m200 && now.m200 != null) log(t, now.m200 ? "200일선 위로" : "200일선 아래로", now.m200 ? "p" : "n");
      if (now.hi && !s.hi) log(t, "52주 신고가", "p");
      if (now.big && !s.big) log(t, "전일 대비 " + pct((px / prev - 1) * 100), (px > prev) ? "p" : "n");
      if (now.pv && !s.pv) log(t, "20일 고가 위 + 거래량 속도 " + pace[t].toFixed(1) + "배 — ②관문에 가까워지는 중(판정은 마감 뒤)", "p");
    }
    now.init = true; state[t] = now;
  }
  function log(t, msg, side) {
    var ul = $("[data-log]"), li = document.createElement("li");
    var tm = document.createElement("span"); tm.className = "num muted"; tm.textContent = (when || new Date().toTimeString().slice(0, 8)) + " ";   // 스냅샷에서 나온 알림은 스냅샷 시각
    var sym = document.createElement("b"); sym.textContent = t + " ";
    var m = document.createElement("span"); m.className = side === "p" ? "up" : "down"; m.textContent = msg;
    li.appendChild(tm); li.appendChild(sym); li.appendChild(m);
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 20) ul.removeChild(ul.lastChild);
    $("[data-log-empty]").hidden = true;
  }

  // ---------- 연결 ----------
  function warm(key) {
    // 장이 닫혀 있으면 웹소켓엔 체결이 없다 — REST 로 현재가를 한 번 채운다(분당 60회 한도 → 1.1초 간격)
    var ts = list(), i = 0;
    (function next() {
      if (i >= ts.length || get(KEYK) !== key) return;
      var t = ts[i++];
      fetch("https://finnhub.io/api/v1/quote?symbol=" + encodeURIComponent(t) + "&token=" + encodeURIComponent(key))
        .then(function (r) { if (r.status === 401) throw new Error("키가 맞지 않아요"); return r.json(); })
        .then(function (q) { if (q && q.c) paint(t, q.c, q.pc || null); })
        .catch(function (e) { status("현재가를 받지 못했어요: " + e.message); i = ts.length; })
        .finally(function () { setTimeout(next, 1100); });
    })();
  }
  function connect() {
    var key = get(KEYK);
    if (!key) { status(snap ? "장중 스냅샷 " + snap.et + " ET 기준이에요(5분마다 새 스냅샷을 확인해요). 체결마다 바꾸려면 아래에 Finnhub 무료 키를 넣어 주세요." : "지금은 전일 종가 기준이에요. 아래에 Finnhub 무료 키를 넣으면 실시간으로 바뀌어요."); return; }
    if (ws) { try { ws.close(); } catch (e) {} }
    status("연결 중…");
    ws = new WebSocket("wss://ws.finnhub.io?token=" + encodeURIComponent(key));
    ws.onopen = function () {
      retry = 0;
      list().forEach(function (t) { ws.send(JSON.stringify({ type: "subscribe", symbol: t })); });
      status("연결됨 · " + list().length + "종목 구독 중 · 체결되면 바로 바뀌어요(장이 닫혀 있으면 변화가 없어요)");
    };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === "trade" && m.data) {
        var lastBy = {};
        m.data.forEach(function (d) { lastBy[d.s] = d.p; });
        Object.keys(lastBy).forEach(function (t) { paint(t, lastBy[t]); });
        lastTick = Date.now();
        $("[data-last]").textContent = new Date().toTimeString().slice(0, 8);
      } else if (m.type === "error") { status("오류: " + (m.msg || "") + " — 키와 구독 종목 수(최대 50)를 확인해 주세요"); }
    };
    ws.onclose = function () {
      if (!get(KEYK)) return;
      var wait = Math.min(30000, 2000 * Math.pow(2, retry++));
      status("연결이 끊겼어요 — " + Math.round(wait / 1000) + "초 뒤 다시 연결해요");
      setTimeout(connect, wait);
    };
    warm(key);
  }

  // ---------- 설정 ----------
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "save") { var v = $("[data-key]").value.trim(); if (v) { put(KEYK, v); $("[data-key]").value = ""; connect(); } }
    if (act === "clear") { put(KEYK, null); if (ws) { try { ws.close(); } catch (x) {} } status("키를 이 기기에서 지웠어요"); }
    if (act === "list") {
      put(LISTK, $("[data-list]").value.toUpperCase());
      buildTable(); if (get(KEYK)) connect();
    }
    if (act === "reset") { put(LISTK, null); $("[data-list]").value = list().join(", "); buildTable(); if (get(KEYK)) connect(); }
  });

  fetch(R + "data/live_base.json").then(function (r) { return r.json(); }).then(function (d) {
    base = d.b || {};
    $("[data-base-asof]").textContent = d.asof || "—";
    $("[data-list]").value = list().join(", ");
    buildTable(); connect();
    Snap.watch(SNAP, applySnap);
  }).catch(function () { status("기준값 파일을 불러오지 못했어요."); });

  // ---------- 장중 지연 스냅샷 ----------
  function applySnap(s) {
    var el = $("[data-snap-at]");
    if (!s) { if (el) el.textContent = SNAP ? "없음" : "꺼짐"; return; }
    if (!s.fresh) { if (el) el.textContent = s.d.et + " ET(오래돼서 쓰지 않아요)"; return; }
    snap = s.d;
    if (el) el.textContent = snap.et + " ET · 약 " + s.ageMin + "분 전";
    Object.keys(rows).forEach(function (t) {
      var q = snap.q[t]; if (!q) return;
      pace[t] = q[2];
      if (q[3]) pcs[t] = pcs[t] || q[3];
      if (fresh[t]) { when = snap.et + " ET"; rows[t].st.textContent = tags(rows[t].last, base[t], t).join(" "); check(t, rows[t].last, pcs[t] || q[3], base[t]); }
      else paint(t, q[0], q[3], "snap");
    });
    if (!get(KEYK)) connect();
  }
})();
