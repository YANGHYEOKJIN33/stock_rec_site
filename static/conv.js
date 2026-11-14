// 편의기능(2026-11-04 JIN '추가하면 사용자에게 좋은 편의기능을 정리하고 구현') — 모든 쪽에서 돈다.
// 모두 이 기기 브라우저 안에서만: 저장은 localStorage, 읽는 자료는 이 사이트의 data/search.json 하나. 어디로도 보내지 않는다.
//   ① 단축키 · 도움말(?)          ② 맨 위로              ③ 이 쪽 공유             ④ 업데이트 'N시간 전'
//   ⑤ 표 정렬 · 표 복사           ⑥ 종목 쪽: 내 메모 · 종가 알림선
//   ⑦ 첫 화면 · 내 관심종목: 지난번 뒤 바뀐 관심종목 · 알림선에 닿은 종목 · 최근 본 종목
//   ⑧ 내 관심종목 옮기기(링크) · 백업 파일(내려받기 · 불러오기)      ⑨ 홈 화면에 설치
// 쪽 내용은 빌드 때 구워진다 — 이 파일이 꺼져도 쪽은 그대로 다 보인다(여기 것은 덧붙이는 도구뿐).
(function () {
  "use strict";
  var D = document, B = D.body;
  if (!B) return;
  var ROOT = B.getAttribute("data-root") || "", BUILD = B.getAttribute("data-build") || "";
  var K = { watch: "mywatch:v1", memo: "memo:v1", alert: "alerts:v1", recent: "recent:v1", seen: "seen:v1" };
  var CODE = /^[0-9A-Z][0-9A-Z.\-]{0,11}$/;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function getJ(k, d) { try { var v = JSON.parse(get(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function putJ(k, v) { return put(k, JSON.stringify(v)); }
  function arr(x) { return Object.prototype.toString.call(x) === "[object Array]" ? x : []; }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function slice(x) { return Array.prototype.slice.call(x || []); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(m) {
    var t = D.querySelector("[data-toast]");
    if (!t) return;
    t.textContent = m; t.hidden = false; clearTimeout(t._h);
    t._h = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function typing(e) { var t = e.target; return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "")); }
  function copyText(txt, ok) {
    function fallback() {
      var ta = D.createElement("textarea");
      ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.top = "0";
      B.appendChild(ta); ta.select();
      var done = false; try { done = D.execCommand("copy"); } catch (x) {}
      B.removeChild(ta);
      toast(done ? ok : "복사가 막혀 있어요 — 주소창의 주소를 길게 눌러 복사해 주세요");
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { toast(ok); }, fallback);
    else fallback();
  }
  function nd(m) { return m === "KRX" ? 0 : 2; }
  function fmt(v, d) {
    if (v == null || isNaN(v)) return "—";
    return Number(v).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(v) { return v == null || !isFinite(v) ? "" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; }
  function bstamp(b) { return /^\d{12}$/.test(b || "") ? b.slice(4, 6) + "/" + b.slice(6, 8) + " " + b.slice(8, 10) + ":" + b.slice(10, 12) : "지난번"; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function pill(tone, txt) { return '<span class="pill tone-' + esc(/^[a-z]+$/.test(tone || "") ? tone : "watch") + '">' + esc(txt) + "</span>"; }

  // 이 사이트의 검색 줄 — [이름, 코드, 경로, 시장, 상태 말, 상태 색, 종가, 하루 등락 %]. 한 번만 받는다
  var idxP = null;
  function loadIdx() {
    if (!idxP) {
      idxP = fetch(ROOT + "data/search.json" + (BUILD ? "?v=" + BUILD : ""))
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; })
        .then(function (rows) {
          var by = {};
          arr(rows).forEach(function (r) { if (r && r[1]) by[r[1]] = r; });
          return by;
        });
    }
    return idxP;
  }

  // ---------- ④ 업데이트 'N시간 전' — 빌드 · 리포트 시각(KST)에서 지금까지 ----------
  function ago() {
    var now = Date.now();
    slice(D.querySelectorAll("[data-ago]")).forEach(function (el) {
      var v = el.getAttribute("data-ago") || "";
      var p = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(v) || /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/.exec(v);
      if (!p) return;
      var t = Date.parse(p[1] + "-" + p[2] + "-" + p[3] + "T" + ("0" + p[4]).slice(-2) + ":" + p[5] + ":00+09:00");
      if (!isFinite(t)) return;
      var h = (now - t) / 3600000;
      if (h < -0.25) return;
      var txt = h < 1 ? Math.max(1, Math.round(h * 60)) + "분 전" : h < 48 ? Math.round(h) + "시간 전" : Math.round(h / 24) + "일 전";
      el.textContent = " (" + txt + ")";
      if (h > 36) { el.className = "agoold"; el.title = "하루 넘게 새로 만들어지지 않았어요 — 예약이 늦거나 쉬는 날이에요"; }
    });
  }

  // ---------- ① 단축키 · 도움말 ----------
  var dlg = null, installEvt = null;
  function helpHtml() {
    var inst = installEvt ? '<p><button type="button" class="btn" data-install>📲 홈 화면에 설치</button></p>' :
      (window.matchMedia && matchMedia("(display-mode: standalone)").matches ? "<p>이미 앱처럼 열려 있어요.</p>" :
        "<p>안드로이드 크롬: 오른쪽 위 ⋮ → <b>홈 화면에 추가</b> · 아이폰 사파리: 아래 공유(□↑) → <b>홈 화면에 추가</b>. 주소창 없이 앱처럼 열려요.</p>");
    return '<div class="row"><h2 style="margin:0">⌨ 편의기능 · 단축키</h2><button type="button" class="btn" data-close aria-label="닫기">닫기</button></div>' +
      "<h3>단축키(PC)</h3><dl class=\"keys\">" +
      "<dt><kbd>/</kbd></dt><dd>종목 검색 — 이름 · 코드 · 초성(ㅅㅅㅈㅈ → 삼성전자)</dd>" +
      "<dt><kbd>?</kbd></dt><dd>이 도움말</dd>" +
      "<dt><kbd>g</kbd> 다음 <kbd>h</kbd> <kbd>s</kbd> <kbd>j</kbd> <kbd>p</kbd> <kbd>m</kbd> <kbd>w</kbd> <kbd>n</kbd></dt><dd>오늘 · 시나리오 · 종목 · 추천 · 시장 · 내 관심종목 · 더보기로</dd>" +
      "<dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>앞 · 뒤 하위 탭</dd>" +
      "<dt><kbd>f</kbd></dt><dd>종목 쪽에서 ☆ 내 관심종목 넣기 · 빼기</dd>" +
      "<dt><kbd>Esc</kbd></dt><dd>닫기</dd></dl>" +
      "<h3>이 기기에만 저장되는 내 것</h3><p>☆ 내 관심종목 · 📝 종목 메모 · 🔔 종가 알림선 · 최근 본 종목 · 차트에 그린 선 — 서버로 보내지 않아요. " +
      "새로 만들어질 때마다 첫 화면 · 내 관심종목 맨 위에 <b>지난번 뒤 바뀐 관심종목</b>과 <b>알림선에 닿은 종목</b>을 모아 보여요(종가 기준).</p>" +
      '<h3>다른 기기로 옮기기</h3><p><a href="' + esc(ROOT) + 'stocks/mine/">종목 › 내 관심종목</a> › 📤 다른 기기로 옮기기 — 링크(종목만) · 백업 파일(메모 · 알림선 · 그린 선까지).</p>' +
      "<h3>표</h3><p>머리줄을 누르면 정렬(한 번 더 → 반대, 세 번째 → 원래대로). 긴 표는 ⧉ 표 복사로 엑셀 · 구글 시트에 붙여 넣어요.</p>" +
      "<h3>홈 화면에 추가</h3>" + inst +
      "<h3>보기</h3><p>밝게/어둡게 · 상승색은 맨 아래 단추로. 글자 크기는 브라우저 확대(PC <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>−</kbd>, 휴대폰은 두 손가락)로.</p>";
  }
  function openHelp() {
    if (!dlg) {
      dlg = D.createElement("dialog");
      dlg.className = "helpdlg";
      dlg.setAttribute("aria-label", "편의기능 · 단축키");
      B.appendChild(dlg);
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg || e.target.closest("[data-close]")) closeHelp();
      });
    }
    dlg.innerHTML = helpHtml();
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); }
    else { dlg.setAttribute("open", ""); dlg.classList.add("fallback"); }
    var c = dlg.querySelector("[data-close]"); if (c) c.focus();
  }
  function closeHelp() {
    if (!dlg) return;
    if (typeof dlg.close === "function" && dlg.open) dlg.close(); else dlg.removeAttribute("open");
  }
  var GO = { KeyH: "", KeyS: "scenarios/", KeyJ: "stocks/", KeyP: "picks/", KeyM: "market/", KeyW: "stocks/mine/", KeyN: "more/" };
  var gAt = 0;
  function subtab(d) {
    var as = slice(D.querySelectorAll("nav.subtabs a"));
    if (!as.length) return;
    var i = -1;
    as.forEach(function (a, k) { if (a.getAttribute("aria-current") === "page") i = k; });
    var j = i < 0 ? 0 : i + d;
    if (j >= 0 && j < as.length && j !== i) location.href = as[j].href;
  }
  D.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key === "Escape") { if (dlg && (dlg.open || dlg.hasAttribute("open"))) closeHelp(); return; }
    if (typing(e)) return;
    var code = e.code || "", key = e.key || "";
    if (gAt && Date.now() - gAt < 1500 && GO.hasOwnProperty(code)) { e.preventDefault(); gAt = 0; location.href = (ROOT + GO[code]) || "./"; return; }
    gAt = 0;
    if ((code === "Slash" || key === "?" || key === "/") && (e.shiftKey || key === "?")) { e.preventDefault(); openHelp(); }
    else if (code === "Slash" || key === "/") {
      var q = D.getElementById("q");
      if (q) { e.preventDefault(); q.focus(); if (q.select) q.select(); }
    }
    else if (code === "KeyG" || key === "g") gAt = Date.now();
    else if (code === "BracketRight" || key === "]") subtab(1);
    else if (code === "BracketLeft" || key === "[") subtab(-1);
    else if (code === "KeyF" || key === "f") {
      var s = D.querySelector("[data-star][data-wide]");
      if (s) { e.preventDefault(); s.click(); }
    }
  });
  D.addEventListener("click", function (e) {
    if (e.target.closest("[data-help]")) { e.preventDefault(); openHelp(); }
  });

  // ---------- ⑨ 홈 화면에 설치 — 브라우저가 '설치할 수 있다'고 알려 줄 때만 단추를 보인다 ----------
  function showInstall(on) { slice(D.querySelectorAll("[data-install]")).forEach(function (b) { b.hidden = !on; }); }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; showInstall(true); });
  window.addEventListener("appinstalled", function () { installEvt = null; showInstall(false); toast("홈 화면에 설치했어요"); });
  D.addEventListener("click", function (e) {
    var b = e.target.closest("[data-install]");
    if (!b) return;
    if (!installEvt) { openHelp(); return; }
    installEvt.prompt();
    var ev = installEvt;
    installEvt = null;
    (ev.userChoice || Promise.resolve()).then(function () { showInstall(false); closeHelp(); });
  });

  // ---------- ③ 이 쪽 공유 — 휴대폰은 공유 창, 아니면 주소 복사 ----------
  D.addEventListener("click", function (e) {
    var b = e.target.closest("[data-sharepage]");
    if (!b) return;
    var url = location.href.split("#")[0];
    if (navigator.share) navigator.share({ title: D.title, url: url }).catch(function () {});
    else copyText(url, "이 쪽 주소를 복사했어요 — 붙여 넣기만 하면 돼요");
  });

  // ---------- ② 맨 위로 ----------
  var up = D.createElement("button");
  up.type = "button"; up.className = "totop"; up.hidden = true;
  up.setAttribute("aria-label", "맨 위로"); up.title = "맨 위로";
  up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>';
  B.appendChild(up);
  var upTick = false;
  window.addEventListener("scroll", function () {
    if (upTick) return;
    upTick = true;
    requestAnimationFrame(function () { upTick = false; up.hidden = (window.scrollY || D.documentElement.scrollTop) < window.innerHeight * 1.5; });
  }, { passive: true });
  up.addEventListener("click", function () {
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" }); } catch (x) { window.scrollTo(0, 0); }
  });

  // ---------- ⑤ 표 정렬 · 표 복사 ----------
  var EMPTY = /^[\s—–\-?·.]*$/;
  function cellText(td) { return (td.getAttribute("data-v") || td.textContent || "").replace(/\s+/g, " ").trim(); }
  function numOf(s) {
    var m = s.replace(/[\s,]/g, "").replace(/[−–]/g, "-").match(/[-+]?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function colKind(rows, ci) {
    var n = 0, num = 0, date = 0;
    rows.forEach(function (r) {
      var s = cellText(r.cells[ci]);
      if (EMPTY.test(s)) return;
      n++;
      if (/^(\d{4}[-./])?\d{1,2}[-./]\d{1,2}\b/.test(s)) date++;
      else if (/^[^\d가-힣A-Za-z]{0,3}[-+−]?[\d,]*\d(\.\d+)?/.test(s.replace(/\s/g, ""))) num++;
    });
    if (!n) return "text";
    if (date / n >= 0.6) return "date";
    return num / n >= 0.7 ? "num" : "text";
  }
  function sortKey(td, kind) {
    var s = cellText(td);
    if (EMPTY.test(s)) return null;
    if (kind === "num") return numOf(s);
    if (kind === "date") {
      var p = s.match(/^(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
      return p ? (p[1] || "0000") + ("0" + p[2]).slice(-2) + ("0" + p[3]).slice(-2) : s;
    }
    return s.toLowerCase();
  }
  function tsv(t) {
    return slice(t.rows).map(function (r) {
      return slice(r.cells).map(function (c) { return (c.innerText || c.textContent || "").replace(/[\t\r\n]+/g, " ").trim(); }).join("\t");
    }).join("\n");
  }
  function initTable(t) {
    if (t.hasAttribute("data-nosort") || t.closest("[data-nosort]") || t._sorted) return;
    var head = t.tHead;
    if (!head || head.rows.length !== 1 || t.tBodies.length !== 1) return;
    var hr = head.rows[0], n = hr.cells.length, rows = slice(t.tBodies[0].rows);
    if (rows.length < 4 || n < 2) return;
    if (slice(hr.cells).some(function (c) { return c.colSpan > 1 || c.rowSpan > 1; })) return;
    if (rows.some(function (r) { return r.cells.length !== n || slice(r.cells).some(function (c) { return c.colSpan > 1 || c.rowSpan > 1; }); })) return;
    t._sorted = true;
    var body = t.tBodies[0], st = { col: -1, dir: 0 };
    rows.forEach(function (r, i) { r._o = i; });
    slice(hr.cells).forEach(function (th, ci) {
      if (th.hasAttribute("data-nosort") || !th.textContent.trim()) return;
      var kind = colKind(rows, ci), first = kind === "num" ? -1 : 1;
      th.classList.add("sortable");
      th.tabIndex = 0;
      th.setAttribute("aria-sort", "none");
      th.title = "눌러서 정렬 — 한 번 더 누르면 반대, 세 번째는 원래대로";
      function go() {
        var dir = st.col !== ci ? first : st.dir === first ? -first : 0;
        st.col = dir ? ci : -1; st.dir = dir;
        var cur = slice(body.rows);
        if (dir === 0) cur.sort(function (a, b) { return a._o - b._o; });
        else {
          cur.sort(function (a, b) {
            var x = sortKey(a.cells[ci], kind), y = sortKey(b.cells[ci], kind);
            if (x == null && y == null) return a._o - b._o;
            if (x == null) return 1;
            if (y == null) return -1;
            if (x < y) return -dir;
            if (x > y) return dir;
            return a._o - b._o;
          });
        }
        cur.forEach(function (r) { body.appendChild(r); });
        slice(hr.cells).forEach(function (h, k) {
          if (h.classList.contains("sortable")) h.setAttribute("aria-sort", k === ci && dir ? (dir > 0 ? "ascending" : "descending") : "none");
        });
      }
      th.addEventListener("click", function (e) { if (!e.target.closest("a,button")) go(); });
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    if (rows.length >= 8) {
      var cb = D.createElement("button");
      cb.type = "button"; cb.className = "tcopy"; cb.textContent = "⧉ 표 복사";
      cb.title = "탭으로 나눈 글로 복사 — 엑셀 · 구글 시트에 그대로 붙여 넣어요";
      cb.addEventListener("click", function () { copyText(tsv(t), "표를 복사했어요 — 엑셀 · 구글 시트에 붙여 넣어요"); });
      var host = t.closest(".tablewrap") || t;
      host.parentNode.insertBefore(cb, host.nextSibling);
    }
  }

  // ---------- ⑥ 종목 쪽: 내 메모 · 종가 알림선 ----------
  function memos() { return obj(getJ(K.memo, {})); }
  function alerts() { return arr(getJ(K.alert, [])).filter(function (a) { return a && CODE.test(a.c || "") && isFinite(a.p) && (a.d === "up" || a.d === "down"); }); }
  function tools(el) {
    var c = el.getAttribute("data-c") || "", name = el.getAttribute("data-n") || c, href = el.getAttribute("data-h") || "";
    var mk = el.getAttribute("data-m") || "", dg = parseInt(el.getAttribute("data-nd") || "", 10);
    var close = parseFloat(el.getAttribute("data-close")), entry = parseFloat(el.getAttribute("data-entry")), stop = parseFloat(el.getAttribute("data-stop"));
    if (!CODE.test(c)) return;
    if (!isFinite(dg)) dg = nd(mk);
    var star = D.querySelector("[data-star][data-wide]");
    var host = star ? star.parentNode : el;
    function mkBtn(txt, kind) {
      var b = D.createElement("button");
      b.type = "button"; b.className = "tbtn"; b.setAttribute("aria-expanded", "false"); b.setAttribute("data-tool", kind);
      b.textContent = txt;
      return b;
    }
    var bm = mkBtn("📝 메모", "memo"), ba = mkBtn("🔔 알림선", "alert"), bs = mkBtn("🔗 공유", "share");
    bs.removeAttribute("aria-expanded"); bs.setAttribute("data-sharepage", "");
    var after = star ? star.nextSibling : null;
    [bm, ba, bs].forEach(function (b) { host.insertBefore(b, after); });
    var panel = D.createElement("div");
    panel.className = "mypanel"; panel.hidden = true;
    el.appendChild(panel);
    var open = "";
    function label() {
      var m = memos()[c], n = alerts().filter(function (a) { return a.c === c; }).length;
      bm.textContent = m && m.t ? "📝 메모 ✓" : "📝 메모";
      ba.textContent = n ? "🔔 알림선 " + n : "🔔 알림선";
    }
    function memoView() {
      var m = memos()[c] || {};
      panel.innerHTML = '<div class="mp-h"><b>📝 내 메모</b> <span class="faint">이 기기에만 저장 · 내 관심종목 카드에도 보여요</span></div>' +
        '<label class="sr" for="mymemo">' + esc(name) + ' 메모</label>' +
        '<textarea id="mymemo" rows="4" maxlength="2000" placeholder="왜 보고 있나요? 언제 사고 · 언제 팔 생각인가요? 예) 수주잔고 발표 뒤 매수가를 넘으면 1차 매수"></textarea>' +
        '<div class="mp-f"><span class="label" data-st></span><button type="button" class="btn" data-del>지우기</button></div>';
      var ta = panel.querySelector("textarea"), stx = panel.querySelector("[data-st]"), h = 0;
      ta.value = m.t || "";
      stx.textContent = m.at ? "저장됨 · " + m.at : "";
      function save() {
        var all = memos(), t = ta.value.replace(/\s+$/, "");
        if (t) all[c] = { t: t.slice(0, 2000), at: today(), n: name, h: href, m: mk };
        else delete all[c];
        stx.textContent = putJ(K.memo, all) ? (t ? "저장했어요 · " + today() : "비웠어요") : "저장 못 했어요(브라우저 저장소가 막혀 있어요)";
        label();
      }
      ta.addEventListener("input", function () { clearTimeout(h); h = setTimeout(save, 400); });
      ta.addEventListener("blur", function () { clearTimeout(h); save(); });
      panel.querySelector("[data-del]").addEventListener("click", function () { ta.value = ""; save(); ta.focus(); });
      ta.focus();
    }
    function alertView() {
      var mine = alerts().filter(function (a) { return a.c === c; });
      var quick = [];
      if (isFinite(entry)) quick.push(['up', entry, "매수가 " + fmt(entry, dg) + " 이상"]);
      if (isFinite(stop)) quick.push(['down', stop, "손절가 " + fmt(stop, dg) + " 이하"]);
      if (isFinite(close)) { quick.push(['up', +(close * 1.05).toFixed(dg), "지금 +5%"]); quick.push(['down', +(close * 0.95).toFixed(dg), "지금 −5%"]); }
      panel.innerHTML = '<div class="mp-h"><b>🔔 종가 알림선</b> <span class="faint">새로 만들어질 때의 종가로 확인 · 첫 화면 · 내 관심종목에서 알려요</span></div>' +
        '<div class="mp-row"><label class="sr" for="mydir">방향</label><select id="mydir" data-dir><option value="up">이 값 이상(오르면)</option><option value="down">이 값 이하(내리면)</option></select>' +
        '<label class="sr" for="mypx">가격</label><input id="mypx" type="number" inputmode="decimal" step="any" min="0" data-px placeholder="가격' + (isFinite(close) ? " · 지금 " + esc(fmt(close, dg)) : "") + '">' +
        '<button type="button" class="btn" data-add>넣기</button></div>' +
        (quick.length ? '<div class="mp-q"><span class="label">바로 넣기</span> ' + quick.map(function (q, i) {
          return '<button type="button" class="chipbtn" data-q="' + i + '">' + esc(q[2]) + "</button>";
        }).join("") + "</div>" : "") +
        '<ul class="mp-list">' + (mine.length ? mine.map(function (a) {
          var on = isFinite(close) && (a.d === "down" ? close <= a.p : close >= a.p);
          var gap = isFinite(close) && close ? (a.p / close - 1) * 100 : null;
          return "<li><b>" + (a.d === "down" ? "≤ " : "≥ ") + esc(fmt(a.p, dg)) + "</b> " +
            (on ? pill("go", "지금 닿아 있어요") : gap != null ? '<span class="faint">지금보다 ' + esc(pct(gap)) + "</span>" : "") +
            ' <button type="button" class="linkbtn" data-rm="' + esc(a.d + "|" + a.p) + '">지우기</button></li>';
        }).join("") : '<li class="faint">아직 없어요 — 위에서 넣어요(종목마다 5개까지)</li>') + "</ul>";
      function add(d, p) {
        p = Number(p);
        if (!isFinite(p) || p <= 0) { toast("가격을 숫자로 넣어 주세요"); return; }
        var all = alerts();
        if (all.filter(function (a) { return a.c === c; }).length >= 5) { toast("한 종목에 5개까지예요"); return; }
        if (all.length >= 80) { toast("알림선은 모두 80개까지예요 — 지난 것을 지워 주세요"); return; }
        if (all.some(function (a) { return a.c === c && a.d === d && a.p === p; })) { toast("이미 있는 선이에요"); return; }
        all.push({ c: c, n: name, h: href, m: mk, d: d, p: p, at: today() });
        putJ(K.alert, all);
        var now = isFinite(close) && (d === "down" ? close <= p : close >= p);
        toast(now ? "넣었어요 — 지금 종가가 이미 그 선을 넘어 있어요" : "넣었어요 — 종가가 닿으면 첫 화면에서 알려요");
        label(); alertView();
      }
      panel.querySelector("[data-add]").addEventListener("click", function () {
        add(panel.querySelector("[data-dir]").value, panel.querySelector("[data-px]").value);
      });
      panel.querySelector("[data-px]").addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); add(panel.querySelector("[data-dir]").value, this.value); }
      });
      slice(panel.querySelectorAll("[data-q]")).forEach(function (b) {
        b.addEventListener("click", function () { var q = quick[+b.getAttribute("data-q")]; add(q[0], q[1]); });
      });
      slice(panel.querySelectorAll("[data-rm]")).forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.getAttribute("data-rm");
          putJ(K.alert, alerts().filter(function (a) { return !(a.c === c && a.d + "|" + a.p === k); }));
          label(); alertView();
        });
      });
    }
    function toggle(kind, btn) {
      var same = open === kind && !panel.hidden;
      [bm, ba].forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
      if (same) { panel.hidden = true; open = ""; return; }
      open = kind; panel.hidden = false; btn.setAttribute("aria-expanded", "true");
      if (kind === "memo") memoView(); else alertView();
    }
    bm.addEventListener("click", function () { toggle("memo", bm); });
    ba.addEventListener("click", function () { toggle("alert", ba); });
    label();
  }

  // ---------- ⑦ 내 소식 — 지난번 뒤 바뀐 관심종목 · 알림선에 닿은 종목 · 최근 본 종목 ----------
  function watchList() { return arr(getJ(K.watch, [])).filter(function (x) { return x && CODE.test(x.c || ""); }); }
  function changes(wl, by) {
    var now = {};
    wl.forEach(function (x) { var r = by[x.c]; if (r) now[x.c] = [r[4], r[5], r[6]]; });
    var st = getJ(K.seen, null);
    if (!st || !st.cur || !st.cur.s || !st.base) {            // 처음 — 기준만 잡는다
      putJ(K.seen, { base: { b: BUILD, s: now }, cur: { b: BUILD, s: now } });
      return "";
    }
    if (st.cur.b !== BUILD) st.base = st.cur;
    st.cur = { b: BUILD, s: now };
    putJ(K.seen, st);
    if (st.base.b === BUILD) return "";
    var rows = [];
    wl.forEach(function (x) {
      var a = obj(st.base.s)[x.c], b = now[x.c];
      if (!a || !b) return;
      var moved = a[2] && b[2] ? (b[2] / a[2] - 1) * 100 : null, stc = a[0] !== b[0];
      if (stc || (moved != null && Math.abs(moved) >= 5)) rows.push({ x: x, a: a, b: b, mv: moved, stc: stc, r: by[x.c] });
    });
    rows.sort(function (p, q) { return (q.stc - p.stc) || (Math.abs(q.mv || 0) - Math.abs(p.mv || 0)); });
    var head = "🔄 지난번(" + esc(bstamp(st.base.b)) + ") 뒤 바뀐 내 관심종목";
    if (!rows.length) return '<div class="mb-sec"><div class="label">' + head + " — 상태가 바뀌거나 5% 넘게 움직인 종목은 없어요</div></div>";
    return '<div class="mb-sec"><div class="mb-h"><b>' + head + '</b><button type="button" class="linkbtn" data-mb-ack>확인했어요</button></div><ul class="mb-list">' +
      rows.slice(0, 12).map(function (o) {
        var r = o.r;
        return '<li><a href="' + esc(ROOT + r[2]) + '">' + esc(r[0]) + "</a> " +
          (o.stc ? pill(o.a[1], o.a[0]) + ' <span aria-hidden="true">→</span> ' + pill(o.b[1], o.b[0]) : pill(o.b[1], o.b[0])) +
          (o.mv != null ? ' <span class="' + (o.mv > 0 ? "up" : o.mv < 0 ? "down" : "faint") + '">' + esc(pct(o.mv)) + "</span>" : "") + "</li>";
      }).join("") + "</ul>" + (rows.length > 12 ? '<div class="label">외 ' + (rows.length - 12) + "종목</div>" : "") + "</div>";
  }
  function mybox(el) {
    var wl = watchList(), al = alerts(), rc = arr(getJ(K.recent, [])).filter(function (x) { return x && x.h && x.n; });
    var isMine = el.hasAttribute("data-mine");
    if (!wl.length && !al.length && (isMine || !rc.length)) return;
    loadIdx().then(function (by) {
      var parts = [], hits = [], touched = false;
      al.forEach(function (a) {
        var r = by[a.c], px = r ? r[6] : null;
        if (px == null) return;
        if (a.d === "down" ? px <= a.p : px >= a.p) {
          hits.push({ a: a, px: px, r: r });
          if (!a.hit) { a.hit = BUILD; touched = true; }
        }
      });
      if (touched) putJ(K.alert, al);
      if (hits.length) {
        parts.push('<div class="mb-sec"><div class="mb-h"><b>🔔 알림선에 닿았어요</b><span class="faint">종가 기준</span></div><ul class="mb-list">' +
          hits.map(function (h) {
            var d = nd(h.r[3]);
            return '<li><a href="' + esc(ROOT + h.r[2]) + '">' + esc(h.r[0]) + "</a> 종가 <b>" + esc(fmt(h.px, d)) + "</b> " +
              (h.a.d === "down" ? "≤ " : "≥ ") + esc(fmt(h.a.p, d)) + (h.a.hit && h.a.hit !== BUILD ? ' <span class="faint">(' + esc(bstamp(h.a.hit)) + "부터)</span>" : "") +
              ' <button type="button" class="linkbtn" data-mb-rm="' + esc(h.a.c + "|" + h.a.d + "|" + h.a.p) + '">알림 지우기</button></li>';
          }).join("") + "</ul></div>");
      }
      if (wl.length) {
        var ch = changes(wl, by);
        if (ch) parts.push(ch);
      }
      if (!isMine && rc.length) {
        parts.push('<div class="mb-sec"><div class="mb-h"><b>👀 최근 본 종목</b><button type="button" class="linkbtn" data-mb-clear>지우기</button></div><div class="mb-chips">' +
          rc.slice(0, 8).map(function (x) { return '<a class="chip" href="' + esc(ROOT + x.h) + '">' + esc(x.n) + "</a>"; }).join("") + "</div></div>");
      }
      if (!parts.length) return;
      el.innerHTML = '<div class="row"><h2 style="margin:0">📌 내 소식 <span class="faint">이 기기에 저장된 것으로</span></h2>' +
        (isMine ? "" : '<a class="label" href="' + esc(ROOT) + 'stocks/mine/">내 관심종목 ' + wl.length + "개 →</a>") + "</div>" + parts.join("");
      el.hidden = false;
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-mb-ack")) {
        var st = getJ(K.seen, null);
        if (st && st.cur) { st.base = st.cur; putJ(K.seen, st); }
        var sec = b.closest(".mb-sec"); if (sec) sec.remove();
      } else if (b.hasAttribute("data-mb-rm")) {
        var k = b.getAttribute("data-mb-rm");
        putJ(K.alert, alerts().filter(function (a) { return a.c + "|" + a.d + "|" + a.p !== k; }));
        var li = b.closest("li"); if (li) li.remove();
        toast("알림선을 지웠어요");
      } else if (b.hasAttribute("data-mb-clear")) {
        put(K.recent, null);
        var s2 = b.closest(".mb-sec"); if (s2) s2.remove();
      }
      if (!el.querySelector(".mb-sec")) el.hidden = true;
    });
  }

  // ---------- ⑧ 내 관심종목 옮기기 · 백업 ----------
  var KEEP = /^(mywatch:v1|memo:v1|alerts:v1|recent:v1|theme|updown|chart\.marks|screener:v1|listpref:v1|draw:.{1,80})$/;   // 실시간 키(fh_key)는 넣지 않는다
  function dump() {
    var o = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (KEEP.test(k)) o[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return o;
  }
  function mergeIn(keys) {
    var n = { w: 0, m: 0, a: 0, o: 0 };
    var w = watchList(), have = {};
    w.forEach(function (x) { have[x.c] = 1; });
    try { arr(JSON.parse(keys[K.watch] || "[]")).forEach(function (x) {
      if (x && CODE.test(String(x.c || "")) && !have[x.c]) { have[x.c] = 1; w.push({ c: String(x.c), n: String(x.n || x.c).slice(0, 60) }); n.w++; }
    }); } catch (e) {}
    putJ(K.watch, w);
    var mm = memos();
    try { var im = obj(JSON.parse(keys[K.memo] || "{}"));
      Object.keys(im).forEach(function (c) {
        var v = obj(im[c]);
        if (!CODE.test(c) || typeof v.t !== "string" || !v.t) return;
        if (!mm[c] || String(v.at || "") > String(mm[c].at || "")) {
          mm[c] = { t: v.t.slice(0, 2000), at: String(v.at || "").slice(0, 10), n: String(v.n || c).slice(0, 60), h: String(v.h || "").slice(0, 80), m: String(v.m || "").slice(0, 4) };
          n.m++;
        }
      }); } catch (e) {}
    putJ(K.memo, mm);
    var al = alerts(), ak = {};
    al.forEach(function (a) { ak[a.c + "|" + a.d + "|" + a.p] = 1; });
    try { arr(JSON.parse(keys[K.alert] || "[]")).forEach(function (a) {
      if (!a || !CODE.test(String(a.c || "")) || (a.d !== "up" && a.d !== "down") || !isFinite(a.p) || a.p <= 0) return;
      var k = a.c + "|" + a.d + "|" + Number(a.p);
      if (ak[k] || al.length >= 80) return;
      ak[k] = 1; n.a++;
      al.push({ c: String(a.c), n: String(a.n || a.c).slice(0, 60), h: String(a.h || "").slice(0, 80), m: String(a.m || "").slice(0, 4), d: a.d, p: Number(a.p), at: String(a.at || "").slice(0, 10) });
    }); } catch (e) {}
    putJ(K.alert, al);
    Object.keys(keys).forEach(function (k) {
      if (k === K.watch || k === K.memo || k === K.alert || k === K.recent || !KEEP.test(k)) return;
      var v = keys[k];
      if (typeof v === "string" && v.length < 400000 && put(k, v)) n.o++;
    });
    return n;
  }
  function move(el) {
    el.innerHTML = '<details class="movebox"><summary>📤 다른 기기로 옮기기 · 백업</summary><div class="body">' +
      '<p class="label">내 관심종목 · 메모 · 알림선은 이 기기(브라우저)에만 있어요. 휴대폰 ↔ PC 로 옮기려면:</p>' +
      '<div class="set"><button type="button" class="btn" data-mv="link">🔗 옮기기 링크</button>' +
      '<button type="button" class="btn" data-mv="text">📋 목록을 글로 복사</button>' +
      '<button type="button" class="btn" data-mv="save">💾 백업 파일 내려받기</button>' +
      '<label class="btn">📂 백업 파일 불러오기<input type="file" accept=".json,application/json" data-mv="load" hidden></label></div>' +
      '<p class="label">링크엔 종목 코드만 들어가요 — 다른 기기에서 열면 \'더할까요?\'를 물어요. 메모 · 알림선 · 차트에 그린 선까지 옮기려면 백업 파일을 써요. ' +
      "실시간 시세 키는 백업에 넣지 않아요.</p></div></details>";
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mv]");
      if (!b || b.tagName === "INPUT") return;
      var k = b.getAttribute("data-mv"), w = watchList();
      if ((k === "link" || k === "text") && !w.length) { toast("아직 담은 종목이 없어요"); return; }
      if (k === "link") {
        var url = new URL(ROOT + "stocks/mine/", location.href).href.split("#")[0] + "#add=" + w.map(function (x) { return x.c; }).join(",");
        if (navigator.share) navigator.share({ title: "내 관심종목 옮기기", url: url }).catch(function () {});
        else copyText(url, "옮기기 링크를 복사했어요 — 다른 기기에서 열어요");
      } else if (k === "text") {
        var mm = memos();
        copyText(w.map(function (x) {
          var m = mm[x.c] && mm[x.c].t ? " — " + mm[x.c].t.split("\n")[0].slice(0, 80) : "";
          return x.n + "(" + x.c + ")" + m;
        }).join("\n"), "목록을 복사했어요");
      } else if (k === "save") {
        var blob = new Blob([JSON.stringify({ app: "stock_rec", v: 1, at: new Date().toISOString(), keys: dump() }, null, 1)], { type: "application/json" });
        var a = D.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "주식분석_내것_백업_" + today() + ".json";
        B.appendChild(a); a.click(); B.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast("백업 파일을 내려받았어요 — 다른 기기에서 '불러오기'로 넣어요");
      }
    });
    var inp = el.querySelector('input[data-mv="load"]');
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      inp.value = "";
      if (!f) return;
      if (f.size > 3000000) { toast("파일이 너무 커요(3MB 까지)"); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var d = null;
        try { d = JSON.parse(String(rd.result || "")); } catch (e) { d = null; }
        if (!d || d.app !== "stock_rec" || typeof d.keys !== "object" || !d.keys) { toast("이 사이트의 백업 파일이 아니에요"); return; }
        var keys = obj(d.keys), cnt = function (k, isArr) { try { var v = JSON.parse(keys[k] || (isArr ? "[]" : "{}")); return isArr ? arr(v).length : Object.keys(obj(v)).length; } catch (e) { return 0; } };
        var msg = "백업(" + String(d.at || "").slice(0, 10) + ")을 이 기기에 넣을까요?\n관심종목 " + cnt(K.watch, true) + " · 메모 " + cnt(K.memo) + " · 알림선 " + cnt(K.alert, true) +
          "\n관심종목 · 메모 · 알림선은 지금 것과 합치고, 보기 설정 · 그린 선은 백업 값으로 바꿔요.";
        if (!window.confirm(msg)) return;
        var n = mergeIn(keys);
        toast("넣었어요 — 관심종목 " + n.w + " · 메모 " + n.m + " · 알림선 " + n.a + "개 더함");
        setTimeout(function () { location.reload(); }, 900);
      };
      rd.readAsText(f);
    });
    var m = /#add=([^&]+)/.exec(location.hash || "");
    if (m) addFromLink(el, m[1]);
  }
  function addFromLink(el, raw) {
    var codes = [], seen = {};
    try { raw = decodeURIComponent(raw); } catch (e) {}
    raw.split(",").forEach(function (s) {
      s = s.trim().toUpperCase();
      if (CODE.test(s) && !seen[s] && codes.length < 300) { seen[s] = 1; codes.push(s); }
    });
    if (!codes.length) return;
    loadIdx().then(function (by) {
      var have = {};
      watchList().forEach(function (x) { have[x.c] = 1; });
      var ok = codes.filter(function (c) { return by[c]; }), add = ok.filter(function (c) { return !have[c]; });
      var box = D.createElement("div");
      box.className = "banner mb-import";
      box.setAttribute("role", "status");
      if (!add.length) {
        box.textContent = "이 링크의 종목 " + ok.length + "개는 이미 모두 내 관심종목에 있어요.";
      } else {
        box.innerHTML = "<div>이 링크에 종목 <b>" + ok.length + "</b>개가 있어요 — 새로 더할 것 <b>" + add.length + "</b>개: " +
          esc(add.slice(0, 10).map(function (c) { return by[c][0]; }).join(", ")) + (add.length > 10 ? " 외 " + (add.length - 10) + "개" : "") +
          '</div><div class="set"><button type="button" class="btn" data-imp="yes">내 관심종목에 더하기</button><button type="button" class="btn" data-imp="no">그만두기</button></div>';
      }
      el.insertBefore(box, el.firstChild);
      function clean() { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
      box.addEventListener("click", function (e) {
        var b = e.target.closest("[data-imp]");
        if (!b) return;
        if (b.getAttribute("data-imp") === "yes") {
          var w = watchList();
          add.forEach(function (c) { w.push({ c: c, n: by[c][0] }); });
          putJ(K.watch, w);
          clean();
          toast(add.length + "개를 더했어요");
          setTimeout(function () { location.reload(); }, 700);
        } else { clean(); box.remove(); }
      });
      if (!add.length) clean();
    });
  }

  function start() {
    ago();
    slice(D.querySelectorAll("main table")).forEach(function (t) { try { initTable(t); } catch (e) {} });
    var mt = D.querySelector("[data-mytools]"); if (mt) tools(mt);
    var mb = D.querySelector("[data-mybox]"); if (mb) mybox(mb);
    var mv = D.querySelector("[data-mymove]"); if (mv) move(mv);
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
