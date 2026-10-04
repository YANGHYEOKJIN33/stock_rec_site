// 조건 검색(8차 #1) — data/screen.json(머리 + 줄)을 받아 브라우저에서 거른다. 조건은 주소 #… 에 남긴다(공유 · 뒤로 가기).
(function () {
  var form = document.querySelector("[data-screener]");
  if (!form) return;
  var root = form.getAttribute("data-root") || "", body = document.querySelector("[data-scr-body]"),
      cnt = document.querySelector("[data-scr-count]"), sortSel = document.querySelector("[data-scr-sort]"),
      more = document.querySelector("[data-scr-more]");
  var cols = null, rows = [], ix = {}, shown = 100;
  var PRESET = {
    buy: { lv: "buy" },
    trend: { "rs.min": 80, "ma200.min": 0 },
    value: { "pe.max": 15, "roe.min": 10 },
    div: { "dy.min": 3 },
    growth: { "rg.min": 20 },
    dip: { "hi52.max": -30, "fq.min": 70 },
    est: { "er.min": 2 },
    cheapfv: { "fvu.min": 20 },
    resil: { "lead.min": 1 },
    lead: { "csc.min": 70 }
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(v, nd) { return v == null ? "—" : Number(v).toLocaleString("ko-KR", { minimumFractionDigits: nd || 0, maximumFractionDigits: nd || 0 }); }
  function pct(v) { return v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; }
  function cls(v) { return v == null ? "faint" : v > 0 ? "up" : v < 0 ? "down" : ""; }
  function state() {
    var st = {};
    form.querySelectorAll("input, select").forEach(function (el) { if (el.value !== "") st[el.name] = el.value; });
    if (sortSel && sortSel.value) st.sort = sortSel.value;
    return st;
  }
  function apply(st) {
    form.querySelectorAll("input, select").forEach(function (el) { el.value = st[el.name] != null ? st[el.name] : ""; });
    if (sortSel && st.sort) sortSel.value = st.sort;
    var det = form.querySelector(".scr-more");                // 접힌 칸에 값이 있으면 펼친다
    if (det && Array.prototype.some.call(det.querySelectorAll("input"), function (el) { return el.value !== ""; })) det.open = true;
  }
  function toHash(st) {
    var p = Object.keys(st).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(st[k]); }).join("&");
    try { history.replaceState(null, "", p ? "#" + p : location.pathname + location.search); } catch (e) {}
  }
  function fromHash() {
    var st = {}, h = location.hash.replace(/^#/, "");
    if (!h) return null;
    h.split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) st[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
    return st;
  }
  function pass(r, st) {
    for (var k in st) {
      if (k === "sort") continue;
      var v = st[k];
      if (k === "q") {
        var q = v.toLowerCase();
        if ((r[ix.n] + " " + r[ix.c] + " " + (r[ix.sec] || "")).toLowerCase().indexOf(q) < 0) return false;
        continue;
      }
      var dot = k.indexOf("."), f = dot > 0 ? k.slice(0, dot) : k, op = dot > 0 ? k.slice(dot + 1) : "eq", x = r[ix[f]];
      if (op === "eq") { if (String(x) !== v) return false; continue; }
      if (x == null) return false;                             // 모름 ≠ 0 — 조건을 걸면 뺀다
      var t = parseFloat(v);
      if (isNaN(t)) continue;
      if (op === "min" && x < t) return false;
      if (op === "max" && x > t) return false;
    }
    return true;
  }
  function row(r) {
    var g = function (k) { return r[ix[k]]; };
    return "<tr><td><a href=\"" + root + esc(g("h")) + "\"><b>" + esc(g("n")) + "</b></a> <span class=\"faint\">" + esc(g("c")) + " · " +
      (g("m") === "KRX" ? "한국" : "미국") + (g("sec") ? " · " + esc(String(g("sec")).slice(0, 10)) : "") + "</span></td>" +
      "<td class=\"r\">" + (g("lvs") ? "<span class=\"pill tone-" + ({ buy: "go", ready: "ready", market: "wait", late: "wait", avoid: "stop" }[g("lv")] || "watch") + "\">" + esc(g("lvs")) + "</span>" : "—") + (g("cts") ? "<div class=\"label\" title=\"차트 유형(참고) · 점수 " + esc(g("csc")) + "\">🧭" + esc(g("cts")) + "</div>" : "") + "</td>" +
      "<td class=\"r num\">" + num(g("p"), g("nd")) + " <span class=\"" + cls(g("d1")) + "\">" + pct(g("d1")) + "</span></td>" +
      "<td class=\"r num " + cls(g("r20")) + "\">" + pct(g("r20")) + "</td>" +
      "<td class=\"r num\">" + (g("rs") == null ? "—" : g("rs")) + "</td>" +
      "<td class=\"r num\">" + (g("pe") == null ? "—" : g("pe")) + "</td>" +
      "<td class=\"r num\">" + (g("dy") == null ? "—" : g("dy") + "%") + "</td>" +
      "<td class=\"r num\">" + (g("roe") == null ? "—" : g("roe") + "%") + "</td>" +
      "<td class=\"r num\">" + (g("fa") == null ? "—" : g("fa")) + "</td>" +
      "<td class=\"r num " + cls(g("er")) + "\">" + pct(g("er")) + "</td>" +
      "<td class=\"r num " + cls(g("fvu")) + "\">" + pct(g("fvu")) + "</td></tr>";
  }
  function draw() {
    if (!cols) return;
    var st = state();
    toHash(st);
    try { localStorage.setItem("screener:v1", JSON.stringify(st)); } catch (e) {}
    var hit = rows.filter(function (r) { return pass(r, st); });
    var sk = (st.sort || "rs").replace(/^-/, ""), asc = (st.sort || "").charAt(0) === "-" ? false : null;
    var low = { pe: 1, pb: 1, de: 1, hi52: 1 };                 // 작을수록 앞에 둘 칸은 오름차순
    var up = asc === null ? !!low[sk] : asc;
    hit.sort(function (a, b) {
      var x = a[ix[sk]], y = b[ix[sk]];
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      if (typeof x === "string") return up ? String(x).localeCompare(y) : String(y).localeCompare(x);
      return up ? x - y : y - x;
    });
    body.innerHTML = hit.slice(0, shown).map(row).join("") || "<tr><td colspan=\"11\" class=\"faint\">조건에 맞는 종목이 없어요. 조건을 하나씩 풀어 보세요.</td></tr>";
    cnt.textContent = "· " + hit.length + "종목" + (hit.length > shown ? " 중 " + shown + "개 표시" : "");
    if (more) more.hidden = hit.length <= shown;
  }
  form.addEventListener("input", function () { shown = 100; draw(); });
  form.addEventListener("change", function () { shown = 100; draw(); });
  if (sortSel) sortSel.addEventListener("change", draw);
  if (more) more.addEventListener("click", function () { shown += 200; draw(); });
  document.querySelectorAll("th[data-k]").forEach(function (th) {
    th.style.cursor = "pointer";
    th.addEventListener("click", function () {
      var k = th.getAttribute("data-k"), opt = sortSel && sortSel.querySelector("option[value=\"" + k + "\"]");
      if (opt) { sortSel.value = k; draw(); }
    });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-preset]"); if (!b) return;
    var p = b.getAttribute("data-preset"), st = {};
    if (p !== "reset") { for (var k in PRESET[p]) st[k] = String(PRESET[p][k]); }
    if (sortSel) st.sort = sortSel.value;
    apply(st); shown = 100; draw();
  });
  fetch(form.getAttribute("data-src")).then(function (r) { return r.json(); }).then(function (d) {
    cols = d.cols; rows = d.rows || [];
    cols.forEach(function (c, i) { ix[c] = i; });
    var sec = form.querySelector("select[name=sec]");         // 업종 목록은 자료에서(쪽 글자 수를 늘리지 않게)
    if (sec) (d.sectors || []).forEach(function (s) { var o = document.createElement("option"); o.value = o.textContent = s; sec.appendChild(o); });
    var st = fromHash();
    if (!st) { try { st = JSON.parse(localStorage.getItem("screener:v1") || "null"); } catch (e) { st = null; } }
    if (st) apply(st);
    draw();
  }).catch(function () { cnt.textContent = "· 목록을 못 불러왔어요"; });
})();
