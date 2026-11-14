// 이달 달력(10/11) — 날짜 칸을 누르면 그날 일정을 아래에 그린다. 자료는 서버가 data-cal 에 넣어 두었다.
// 이름 · 설명은 신뢰하지 않는 자료로 보고 textContent 로만 넣는다.
(function () {
  var box = document.querySelector("[data-calday]"); if (!box) return;
  var data; try { data = JSON.parse(box.getAttribute("data-cal") || "{}"); } catch (e) { return; }
  var root = box.getAttribute("data-root") || "";
  var title = box.querySelector("[data-calday-title]"), list = box.querySelector("[data-calday-list]");
  function el(tag, cls, txt) { var x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }
  function render(day) {
    var ev = data[day] || [];
    title.textContent = day.slice(5).replace("-", "/") + " 일정" + (ev.length ? "" : " — 받은 일정이 없어요");
    list.textContent = "";
    ev.forEach(function (e) {
      var li = el("li", "cev" + (e.hi ? " hi" : ""));
      li.appendChild(el("span", "ct num", e.t || "종일")); li.appendChild(document.createTextNode(" "));
      li.appendChild(el("span", "cw", e.where || "")); li.appendChild(document.createTextNode(" "));
      if (e.hi) { li.appendChild(el("span", "chip", "중요")); li.appendChild(document.createTextNode(" ")); }
      var b = el("b", null, e.name || "");
      if (e.href || (e.url && /^https:\/\//.test(e.url))) {
        var a = el("a"); a.href = e.href ? root + e.href : e.url;
        if (!e.href) { a.target = "_blank"; a.rel = "noopener"; }
        a.appendChild(b); li.appendChild(a);
      } else { li.appendChild(b); }
      if (e.est) { li.appendChild(document.createTextNode(" ")); li.appendChild(el("span", "chip", "예상")); }
      if (e.sub) { li.appendChild(document.createTextNode(" ")); li.appendChild(el("span", "faint", e.sub)); }
      list.appendChild(li);
    });
  }
  document.addEventListener("click", function (ev) {
    var c = ev.target.closest("button[data-day]"); if (!c) return;
    document.querySelectorAll("button[data-day][aria-pressed]").forEach(function (x) { x.removeAttribute("aria-pressed"); });
    c.setAttribute("aria-pressed", "true");
    render(c.getAttribute("data-day"));
    if (box.getBoundingClientRect().top > window.innerHeight) box.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
