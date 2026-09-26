// 지도 기간 전환(U4-1) — 1일·1주·1달·3달·연초. 칸마다 기간별 값(data-p)을 빌드가 넣어 두었다.
// 기간이 길수록 눈금을 넓힌다(×1·×2·×4·×8·×8) — 같은 눈금이면 긴 기간은 전부 가장 진한 색이 되어 구분이 안 된다.
// 범례 숫자도 같이 바꾼다. 1일로 돌아오면 'periodchange' 를 알려 장중 색(livemap.js)이 다시 칠할 수 있게 한다.
(function () {
  var box = document.querySelector("[data-periods]"); if (!box) return;
  var card = box.closest(".card");
  var tiles = Array.prototype.slice.call(card.querySelectorAll("rect.tile[data-p]"));
  var leg = card.querySelector(".legend-scale[data-bins]");
  var base = (leg ? leg.getAttribute("data-bins") : "-3,-1,-0.2,0.2,1,3").split(",").map(Number);
  var CLS = ["n3", "n2", "n1", "z", "p1", "p2", "p3"];
  function setCls(el, c) { el.setAttribute("class", el.getAttribute("class").replace(/\b(n3|n2|n1|z|p1|p2|p3|na)\b/, c)); }
  function bin(v, sc) {
    if (v == null || isNaN(v)) return "na";
    for (var i = 0; i < base.length; i++) if (v < base[i] * sc) return CLS[i];
    return "p3";
  }
  function num(x) { var a = Math.abs(x); return (x < 0 ? "−" : "") + (a >= 10 ? a.toFixed(0) : String(+a.toFixed(1))); }
  function legend(sc) {
    if (!leg) return;
    var b = base.map(function (x) { return x * sc; }), sp = leg.querySelectorAll("span");
    var lab = ["≤" + num(b[0]) + "%", num(b[0]) + "~" + num(b[1]), num(b[1]) + "~" + num(b[2]), "±" + num(b[3]),
               num(b[3]) + "~" + num(b[4]), num(b[4]) + "~" + num(b[5]), "≥" + num(b[5]) + "%"];
    for (var i = 0; i < sp.length && i < lab.length; i++) sp[i].textContent = lab[i];
  }
  function apply(k, sc, name) {
    var n = 0;
    tiles.forEach(function (t) {
      var raw = (t.getAttribute("data-p") || "").split(",")[k], v = raw === "" || raw == null ? null : Number(raw);
      var c = bin(v, sc), txt = v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
      setCls(t, c); t.setAttribute("data-c", k === 0 ? txt : txt + " · " + name);
      if (v != null) n++;
      t.parentNode.querySelectorAll("text").forEach(function (tx) {
        setCls(tx, c);
        if (tx.getAttribute("class").indexOf("tv") === 0) tx.textContent = txt;
      });
    });
    legend(sc);
    var lb = card.querySelector("[data-period-label]"); if (lb) lb.textContent = k === 0 ? "오늘" : name;
    var note = card.querySelector("[data-period-note]");
    if (note) {
      note.hidden = k === 0;
      note.textContent = k === 0 ? "" : name + " 수익률(종가 기준) · 값이 있는 칸 " + n + "개 · 눈금 ×" + sc + "(범례 숫자 참고) · 장중 색은 1일 보기에서만 나와요";
    }
    document.body.setAttribute("data-period", k === 0 ? "d1" : "p" + k);
    document.dispatchEvent(new CustomEvent("periodchange", { detail: { k: k } }));
  }
  box.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-k]"); if (!b) return;
    box.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    apply(Number(b.getAttribute("data-k")), Number(b.getAttribute("data-scale")), b.getAttribute("data-name"));
  });
})();
