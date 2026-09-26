// 지표 그림 — 마우스(손가락)를 올리면 그날 값. 값이 먼저, 날짜가 뒤.
(function () {
  document.querySelectorAll("svg.ind").forEach(function (svg) {
    var pts = (svg.getAttribute("data-pts") || "").split(";").map(function (s) { var a = s.split("|"); return [a[0], a[1]]; });
    if (pts.length < 2) return;
    var vb = svg.viewBox.baseVal, L = +svg.getAttribute("data-l"), R = +svg.getAttribute("data-r");
    var hx = svg.querySelector(".hx"), wrap = svg.parentNode, tip = document.createElement("div");
    tip.className = "ind-tip"; tip.hidden = true; wrap.appendChild(tip);
    function at(ev) {
      var r = svg.getBoundingClientRect(), cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var x = cx / r.width * vb.width, i = Math.round((x - L) / (vb.width - L - R) * (pts.length - 1));
      i = Math.max(0, Math.min(pts.length - 1, i));
      var px = L + i * (vb.width - L - R) / (pts.length - 1);
      hx.setAttribute("x1", px); hx.setAttribute("x2", px); hx.setAttribute("y1", 0); hx.setAttribute("y2", vb.height);
      tip.hidden = false;
      tip.innerHTML = "<b>" + Number(pts[i][1]).toLocaleString("ko-KR") + "</b> <span>" + pts[i][0] + "</span>";
      tip.style.left = Math.min(r.width - 120, Math.max(0, px / vb.width * r.width - 50)) + "px";
    }
    function off() { tip.hidden = true; hx.setAttribute("y2", 0); }
    svg.addEventListener("pointermove", at); svg.addEventListener("pointerleave", off);
    svg.addEventListener("touchstart", at, { passive: true }); svg.addEventListener("touchmove", at, { passive: true });
  });
})();
