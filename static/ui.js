// 보기 설정(밝기·상승색) · 종목 검색 · 종목 카드 걸러 보기. 쪽 내용은 빌드 때 구워진다 — JS 가 꺼져도 다 보인다.
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var t = get("theme"), u = get("updown");
  if (t) root.setAttribute("data-theme", t);
  if (u) root.setAttribute("data-updown", u);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-set]");
    if (!b) return;
    var k = b.getAttribute("data-set");
    if (k === "theme") {
      var dark = root.getAttribute("data-theme") === "dark" ||
        (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
      var nt = dark ? "light" : "dark";
      root.setAttribute("data-theme", nt); put("theme", nt);
    } else if (k === "updown") {
      var nu = root.getAttribute("data-updown") === "us" ? "kr" : "us";
      root.setAttribute("data-updown", nu); put("updown", nu);
    }
  });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ICON = { go: "M5 12.5l4.5 4.5L19 7.5", ready: "M7 17L17 7M9 7h8v8", wait: "M9 6v12M15 6v12",
               stop: "M6.5 6.5l11 11M17.5 6.5l-11 11", watch: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" };
  function pill(tone, txt) {
    return '<span class="pill tone-' + tone + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICON[tone] || ICON.watch) +
      '" stroke-linecap="round" stroke-linejoin="round"/></svg>' + esc(txt) + "</span>";
  }

  // ---------- 내 관심종목 — 이 기기 브라우저(localStorage)에만 저장. 서버로 보내지 않는다 ----------
  var MYK = "mywatch:v1";
  function myList() { try { return JSON.parse(localStorage.getItem(MYK) || "[]") || []; } catch (e) { return []; } }
  function saveList(l) { try { localStorage.setItem(MYK, JSON.stringify(l)); } catch (e) {} }
  function has(code) { return myList().some(function (x) { return x.c === code; }); }
  function starBtn(code, name) {
    var on = has(code);
    return '<button type="button" class="star" data-star="' + esc(code) + '" data-name="' + esc(name) + '" aria-pressed="' + on + '" aria-label="' + esc(name) + (on ? " 내 관심종목에서 빼기" : " 내 관심종목에 넣기") + '">' + (on ? "★" : "☆") + "</button>";
  }
  window.__starBtn = starBtn;
  function paintStars() {
    var l = myList(), set = {};
    l.forEach(function (x) { set[x.c] = 1; });
    document.querySelectorAll("[data-star]").forEach(function (b) {
      var on = !!set[b.getAttribute("data-star")], tx = b.hasAttribute("data-wide") ? (on ? "★ 내 관심종목" : "☆ 내 관심종목에 넣기") : (on ? "★" : "☆");
      if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", String(on));
      if (b.textContent !== tx) b.textContent = tx;                // 바뀔 때만 — 관찰자가 다시 부르지 않게
    });
    var n = document.querySelector("[data-mycount]"), nt = l.length ? String(l.length) : "";
    if (n && n.textContent !== nt) n.textContent = nt;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-star]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var code = b.getAttribute("data-star"), l = myList(), i = -1;
    l.forEach(function (x, k) { if (x.c === code) i = k; });
    if (i >= 0) l.splice(i, 1); else l.push({ c: code, n: b.getAttribute("data-name") || code });
    saveList(l); paintStars();
    var t = document.querySelector("[data-toast]");
    if (t) { t.textContent = (i >= 0 ? "내 관심종목에서 뺐어요" : "내 관심종목에 넣었어요 — 종목 › 내 관심종목에서 모아 봐요"); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 2600); }
  }, true);
  document.addEventListener("DOMContentLoaded", paintStars);
  var pend = false;
  new MutationObserver(function () { if (!pend) { pend = true; requestAnimationFrame(function () { pend = false; paintStars(); }); } })
    .observe(document.body || document.documentElement, { childList: true, subtree: true });

  // ---------- 종목 검색(머리) — 이름·코드 · 초성 없이 부분 일치 · 화살표/엔터로 고른다 ----------
  var box = document.querySelector("[data-search]");
  if (box) {
    var inp = box.querySelector("input"), ul = box.querySelector("ul"), rootP = box.getAttribute("data-root") || "";
    var idx = null, sel = -1, hits = [];
    function load() {
      if (idx) return Promise.resolve(idx);
      return fetch(rootP + "data/search.json").then(function (r) { return r.json(); }).then(function (d) { idx = d; return d; })
        .catch(function () { idx = []; return idx; });
    }
    function render() {
      var q = inp.value.trim().toLowerCase();
      if (!q || !idx) { ul.hidden = true; inp.setAttribute("aria-expanded", "false"); return; }
      hits = idx.filter(function (r) { return r[0].toLowerCase().indexOf(q) >= 0 || r[1].toLowerCase().indexOf(q) >= 0; })
        .sort(function (a, b) { return (a[0].toLowerCase().indexOf(q) === 0 ? 0 : 1) - (b[0].toLowerCase().indexOf(q) === 0 ? 0 : 1); }).slice(0, 8);
      sel = hits.length ? 0 : -1;
      ul.innerHTML = hits.length ? hits.map(function (r, i) {
        return '<li role="option" id="q-o' + i + '"><a href="' + rootP + r[2] + '"' + (i === sel ? ' aria-selected="true"' : "") + "><span>" + esc(r[0]) +
          '<span class="code">' + esc(r[1]) + " · " + (r[3] === "KRX" ? "한국" : "미국") + "</span></span>" + pill(r[5], r[4]) + "</a></li>";
      }).join("") : '<li class="label" style="padding:10px 12px">찾는 종목이 없어요. 한국 대형주 300개·미국 대형주 500여 개·관심종목 안에서 찾아요.</li>';
      ul.hidden = false; inp.setAttribute("aria-expanded", "true");
      inp.setAttribute("aria-activedescendant", sel >= 0 ? "q-o" + sel : "");
    }
    function move(d) {
      if (!hits.length) return;
      sel = (sel + d + hits.length) % hits.length;
      ul.querySelectorAll("a").forEach(function (a, i) { a.setAttribute("aria-selected", String(i === sel)); });
      inp.setAttribute("aria-activedescendant", "q-o" + sel);
    }
    inp.addEventListener("focus", load);
    inp.addEventListener("input", function () { load().then(render); });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" && sel >= 0 && hits[sel]) { e.preventDefault(); location.href = rootP + hits[sel][2]; }
      else if (e.key === "Escape") { inp.value = ""; render(); }
    });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) { ul.hidden = true; inp.setAttribute("aria-expanded", "false"); } });
  }

  // ---------- 종목 카드 목록: 전체를 JSON 으로 받아 단계·이름으로 걸러 본다 ----------
  var cl = document.querySelector("[data-cardlist]");
  if (cl) {
    var rp = cl.getAttribute("data-root") || "", all = null, lv = "all";
    var list = cl.querySelector("ul.cards"), q = cl.querySelector("[data-q]"), sortSel = cl.querySelector("[data-sort]"), cnt = cl.querySelector("[data-count]");
    function fmt(v, nd) { return v == null ? "—" : Number(v).toLocaleString("ko-KR", { minimumFractionDigits: nd ? 2 : 0, maximumFractionDigits: nd ? 2 : 0 }); }
    function lad(c) {
      var l = c.ladder; if (!l) return "";
      return '<div class="ladder" aria-hidden="true"><span class="track"></span><span class="loss" style="left:' + l.stop + "%;width:" + (l.entry - l.stop).toFixed(1) +
        '%"></span><span class="gain" style="left:' + l.entry + "%;width:" + (l.target - l.entry).toFixed(1) + '%"></span><span class="tick" style="left:' + l.stop +
        '%"></span><span class="tick" style="left:' + l.entry + '%;background:var(--accent)"></span><span class="tick" style="left:' + l.target + '%"></span><span class="tl" style="left:' +
        l.stop + '%">손절</span><span class="tl" style="left:' + l.entry + '%;color:var(--accent)">매수가</span><span class="tl" style="left:' + l.target +
        '%">목표</span><span class="now" style="left:' + Math.min(98, Math.max(2, l.close)) + '%"><b></b><i></i><s></s></span></div>';
    }
    function card(c) {
      var d1 = c.d1 == null ? "" : '<span class="' + (c.d1 > 0 ? "up" : c.d1 < 0 ? "down" : "faint") + '">' + (c.d1 > 0 ? "+" : c.d1 < 0 ? "−" : "") + Math.abs(c.d1).toFixed(1) + "%</span>";
      var meta = c.entry ? "매수가 " + fmt(c.entry, c.nd) + (c.dist == null ? "" : " · " + (c.dist > 0 ? c.dist + "% 남음" : "이미 넘음")) : "매수가 계산 전";
      return '<li><a class="scard" href="' + rp + c.href + '"><div class="top2"><div style="min-width:0"><div class="nm">' + esc(c.name) + '</div><div class="cd">' + esc(c.code) +
        (c.sector ? " · " + esc(String(c.sector).slice(0, 14)) : "") + "</div></div>" + pill(c.tone, c.short) + '</div><div class="px">' + fmt(c.close, c.nd) + d1 +
        '</div><div class="meta">' + meta + " · 조건 " + c.n_ok + "/" + c.n_all + "</div>" + lad(c) + "</a>" + starBtn(c.code, c.name) + "</li>";
    }
    function draw() {
      if (!all) return;
      var s = (q && q.value.trim().toLowerCase()) || "";
      var rows = all.filter(function (c) { return (lv === "all" || c.level === lv) && (!s || c.name.toLowerCase().indexOf(s) >= 0 || c.code.toLowerCase().indexOf(s) >= 0); });
      var k = sortSel ? sortSel.value : "best";
      if (k === "rs") rows.sort(function (a, b) { return (b.rs || 0) - (a.rs || 0); });
      else if (k === "d1") rows.sort(function (a, b) { return (b.d1 || -99) - (a.d1 || -99); });
      else if (k === "near") rows.sort(function (a, b) { return (a.dist == null || a.dist <= 0 ? 999 : a.dist) - (b.dist == null || b.dist <= 0 ? 999 : b.dist); });
      var show = rows.slice(0, 120);
      list.innerHTML = show.length ? show.map(card).join("") : '<li class="cards-empty">조건에 맞는 종목이 없어요.</li>';
      if (cnt) cnt.textContent = rows.length + "개" + (rows.length > show.length ? " 중 " + show.length + "개 표시 — 이름으로 찾아보세요" : "");
    }
    var mine = cl.hasAttribute("data-mine"), srcs = (cl.getAttribute("data-srcs") || "").split(" ").filter(Boolean);
    Promise.all(srcs.map(function (u) { return fetch(u).then(function (r) { return r.json(); }).catch(function () { return []; }); }))
      .then(function (ls) {
        var seen = {}, merged = [];
        ls.forEach(function (l) { l.forEach(function (c) { if (!seen[c.code]) { seen[c.code] = 1; merged.push(c); } }); });
        cl._all = merged; cl._first = ls[0] || [];
        if (mine) {
          var m = myList(), pos = {};
          m.forEach(function (x, i) { pos[x.c] = i; });
          all = merged.filter(function (c) { return c.code in pos; }).sort(function (a, b) { return pos[a.code] - pos[b.code]; });
          var e = cl.querySelector("[data-empty]"); if (e) e.hidden = all.length > 0;
        } else { all = merged; }
        draw();
      });
    cl.addEventListener("click", function (e) {
      var f = e.target.closest("[data-fill]"); if (!f || !cl._first) return;
      var base = cl._first.map(function (c) { return { c: c.code, n: c.name }; });
      saveList(base); location.reload();
    });
    cl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lv]"); if (!b) return;
      lv = b.getAttribute("data-lv");
      cl.querySelectorAll("[data-lv]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      draw();
    });
    if (q) q.addEventListener("input", draw);
    if (sortSel) sortSel.addEventListener("change", draw);
  }
})();
