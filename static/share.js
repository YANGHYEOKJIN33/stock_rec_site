// 시황 정리 공유(10/11) — '복사'는 글 + 이 쪽 주소를 클립보드로, '공유'는 휴대폰 공유 창(없으면 복사).
// 글은 서버가 만든 <pre data-share-text> 를 textContent 로 읽는다(HTML 로 넣지 않는다).
(function () {
  var pre = document.querySelector("[data-share-text]"); if (!pre) return;
  var note = document.querySelector("[data-share-note]");
  var text = pre.textContent;
  var url = location.href.split("#")[0];
  function say(m) { if (note) { note.hidden = false; note.textContent = m; } }
  function copy() {
    var all = text + "\n" + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(all).then(function () { say("복사했어요 — 붙여 넣기만 하면 돼요."); },
        function () { fallback(all); });
    } else { fallback(all); }
  }
  function fallback(all) {
    var ta = document.createElement("textarea"); ta.value = all; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); say("복사했어요 — 붙여 넣기만 하면 돼요."); }
    catch (e) { say("복사가 막혀 있어요 — 아래 '공유 글 미리보기'를 길게 눌러 복사해 주세요."); }
    document.body.removeChild(ta);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-share]"); if (!b) return;
    if (b.getAttribute("data-share") === "share" && navigator.share) {
      navigator.share({ title: document.title, text: text, url: url }).catch(function () {});
    } else { copy(); }
  });
})();
