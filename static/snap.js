// 장중 지연 스냅샷(계획 17-6 U3) — live.yml 이 장중 30분/1시간마다 공개 저장소 live 가지에 올리는 live.json.
// 키가 없어도 518종목 전체의 장중 등락·거래량 속도를 보인다. 체결마다가 아니라 "그 시각의 사진"이다.
// q[티커] = [현재가, 전일 대비 %, 거래량 속도|null, 전일 종가]
// 오래된 스냅샷(아래 MAXAGE 초과)은 쓰지 않는다 — 어제 장중 값이 오늘 것처럼 보이면 안 되므로.
window.Snap = (function () {
  var MAXAGE = 100 * 60 * 1000;   // 1시간 간격 + 크론 지연을 넉넉히
  function load(url, cb) {
    if (!url) { cb(null); return; }
    fetch(url, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.q || !d.at) { cb(null); return; }
        var age = Date.now() - Date.parse(d.at);
        cb({ d: d, fresh: isFinite(age) && age >= -5 * 60 * 1000 && age < MAXAGE,
             ageMin: isFinite(age) ? Math.round(age / 60000) : null });
      })
      .catch(function () { cb(null); });
  }
  // 주기적으로 다시 읽는다. 탭이 안 보이면 건너뛴다
  function watch(url, cb, everyMs) {
    if (!url) { cb(null); return; }
    load(url, cb);
    setInterval(function () { if (!document.hidden) load(url, cb); }, everyMs || 5 * 60 * 1000);
  }
  function bin(v) {
    if (v == null || isNaN(v)) return "na";
    if (v < -3) return "n3"; if (v < -1) return "n2"; if (v < -0.2) return "n1"; if (v < 0.2) return "z";
    if (v < 1) return "p1"; if (v < 3) return "p2"; return "p3";
  }
  return { load: load, watch: watch, bin: bin };
})();
