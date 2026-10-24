// 장 상태 · 개장까지(10/11 bullstory 참고) — 한국장(09:00~15:30 KST) · 미국장(09:30~16:00 ET, 조기 마감 13:00).
// 휴장일은 빌드가 hol.js(window.MKT_HOL)로 넣는다. 목록이 끝난 날 뒤로는 평일을 장날로 보고 '휴장일 목록 밖'이라 적는다.
// 날 수 × 86400 으로 세므로 서머타임이 바뀌는 주말 사이에는 한 시간 어긋날 수 있다.
(function () {
  var el = document.querySelector("[data-mkt]"); if (!el || !window.MKT_HOL || !window.Intl) return;
  var H = window.MKT_HOL;
  var M = [{ k: "KRX", n: "한국장", tz: "Asia/Seoul", o: [9, 0], c: [15, 30] },
           { k: "NYSE", n: "미국장", tz: "America/New_York", o: [9, 30], c: [16, 0], h: [13, 0] }];
  var W = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function wall(tz) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" }).formatToParts(new Date())
      .forEach(function (x) { p[x.type] = x.value; });
    return { d: p.year + "-" + p.month + "-" + p.day, s: (+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second), w: W.indexOf(p.weekday) };
  }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); }
  function trading(m, iso) { var w = dow(iso); return w > 0 && w < 6 && (H[m.k] || []).indexOf(iso) < 0; }
  function known(m, iso) { return iso <= ((H.until || {})[m.k] || ""); }
  function closeAt(m, iso) { var c = ((H[m.k + "_half"] || []).indexOf(iso) >= 0 && m.h) ? m.h : m.c; return c[0] * 3600 + c[1] * 60; }
  function state(m) {
    var w = wall(m.tz), o = m.o[0] * 3600 + m.o[1] * 60, cl = closeAt(m, w.d);
    if (trading(m, w.d) && w.s >= o && w.s < cl) return { open: true, left: cl - w.s, unk: !known(m, w.d) };
    if (trading(m, w.d) && w.s < o) return { open: false, left: o - w.s, unk: !known(m, w.d) };
    for (var i = 1; i < 15; i++) {
      var d = addDays(w.d, i);
      if (trading(m, d)) return { open: false, left: i * 86400 - w.s + o, unk: !known(m, d) };
    }
    return null;
  }
  function hms(t) { var h = Math.floor(t / 3600), mi = Math.floor(t % 3600 / 60), s = t % 60;
    return h + ":" + (mi < 10 ? "0" : "") + mi + ":" + (s < 10 ? "0" : "") + s; }
  var spans = M.map(function () { var s = document.createElement("span"); el.appendChild(s); return s; });
  function render() {
    M.forEach(function (m, i) {
      var st = state(m), s = spans[i];
      if (!st) { s.textContent = ""; return; }
      s.className = st.open ? "op" : "cl";
      s.textContent = m.n + " " + (st.open ? "열림 · 마감까지 " : "마감 · 개장까지 ") + hms(st.left) + (st.unk ? " (휴장일 목록 밖)" : "");
    });
  }
  render(); setInterval(render, 1000);
})();
