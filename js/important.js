// 중요 질문(별표) 저장소 — 문항 id 배열을 localStorage "ssit.important.v1" 에 보관.
// 브라우저에서는 window.Important, Node 테스트에서는 module.exports 로 쓴다.
(function (root) {
  "use strict";

  var KEY = "ssit.important.v1";

  // 저장값이 깨져 있어도 항상 중복 없는 문자열 배열을 돌려준다
  function parse(raw) {
    if (raw == null) return [];
    var v;
    try { v = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(v)) return [];
    var out = [];
    v.forEach(function (id) {
      if (typeof id === "string" && id && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  function create(storage) {
    var ids;
    try { ids = parse(storage ? storage.getItem(KEY) : null); } catch (e) { ids = []; }

    function persist() {
      try { if (storage) storage.setItem(KEY, JSON.stringify(ids)); } catch (e) { /* 저장 불가 환경 무시 */ }
    }

    return {
      KEY: KEY,
      has: function (id) { return ids.indexOf(id) >= 0; },
      set: function (id, on) {
        var i = ids.indexOf(id);
        if (on && i < 0) ids.push(id);
        else if (!on && i >= 0) ids.splice(i, 1);
        else return on;
        persist();
        return on;
      },
      toggle: function (id) { return this.set(id, !this.has(id)); },
      ids: function () { return ids.slice(); },
      // 문항 목록 순서를 유지한 채 별표 문항만 (데이터에서 사라진 id 는 표시하지 않지만 저장값은 보존)
      filter: function (items) { return items.filter(function (x) { return ids.indexOf(x.id) >= 0; }); }
    };
  }

  var api = { KEY: KEY, parse: parse, create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Important = api;
})(typeof window !== "undefined" ? window : this);
