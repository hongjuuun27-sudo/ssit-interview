(function () {
  "use strict";

  var DATA = window.QA_DATA;
  var DONE_KEY = "ssit.done.v1";
  var TARGET_KEY = "ssit.target.v1";
  var MY_KEY = "ssit.myAnswers.v1";  // { [문항 id]: [{ id, text, at }, ...] } — 진도 초기화와 무관하게 유지

  var $ = function (id) { return document.getElementById(id); };

  // 전체 문항을 평탄화해 두고 장 정보도 함께 둔다
  var ALL = [];
  DATA.chapters.forEach(function (ch) {
    ch.questions.forEach(function (q) {
      ALL.push({ id: q.id, q: q.q, a: q.a, check: q.check, chNo: ch.no, chTitle: ch.title });
    });
  });

  // ---- 저장소 ----
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 무시 */ }
  }
  var done = load(DONE_KEY, {});
  var myAnswers = load(MY_KEY, {});
  if (!myAnswers || typeof myAnswers !== "object" || Array.isArray(myAnswers)) myAnswers = {};

  // ---- 상태 ----
  var deck = [];       // 현재 연습 중인 문항 배열
  var deckTitle = "";
  var pos = 0;
  var answerOpen = false;

  // ---- 홈 ----
  function renderHome() {
    var list = $("chapterList");
    list.innerHTML = "";
    var totalDone = 0;

    DATA.chapters.forEach(function (ch) {
      var n = ch.questions.length;
      var d = ch.questions.filter(function (q) { return done[q.id]; }).length;
      totalDone += d;

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.className = "chapter" + (d === n ? " complete" : "");
      btn.innerHTML =
        '<span class="chapter-no">' + ch.no + "</span>" +
        '<span class="chapter-body">' +
          '<span class="chapter-title"></span>' +
          '<span class="chapter-sub">' + n + "문항 · 연습 " + d + "/" + n +
            '<span class="bar"><span class="bar-fill" style="width:' + pct(d, n) + '%"></span></span>' +
          "</span>" +
        "</span>" +
        '<span class="chapter-arrow">›</span>';
      btn.querySelector(".chapter-title").textContent = ch.title;
      btn.addEventListener("click", function () { location.hash = "#/c/" + ch.no; });
      li.appendChild(btn);
      list.appendChild(li);
    });

    $("totalDone").textContent = totalDone;
    $("totalCount").textContent = ALL.length;
    $("totalBar").style.width = pct(totalDone, ALL.length) + "%";
  }

  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- 연습 ----
  function startDeck(items, title) {
    deck = items;
    deckTitle = title;
    pos = 0;
    renderQuestion();
  }

  function renderQuestion() {
    var item = deck[pos];
    answerOpen = false;
    timerReset();

    $("title").textContent = deckTitle;
    $("counter").textContent = (pos + 1) + "/" + deck.length;
    $("qChapter").textContent = item.chNo + ". " + item.chTitle;
    $("qCheck").hidden = !item.check;
    $("qText").textContent = item.q;
    $("aText").textContent = item.a || "(답변 없음)";
    $("answerLabel").textContent = item.check ? "초안 답변 · 본인 확인 필요" : "모범답안";
    $("answer").classList.toggle("draft", item.check);
    renderAnswer();
    maEditing = null;
    renderMy();
    renderDone();

    $("prevBtn").disabled = pos === 0;
    $("nextBtn").textContent = pos === deck.length - 1 ? "완료 ✓" : "다음 ›";
    window.scrollTo(0, 0);
  }

  function renderAnswer() {
    $("answer").hidden = !answerOpen;
    $("toggleAnswerBtn").textContent = answerOpen ? "모범답안 숨기기" : "모범답안 보기";
    $("toggleAnswerBtn").setAttribute("aria-expanded", String(answerOpen));
  }

  function renderDone() {
    var isDone = !!done[deck[pos].id];
    $("qDone").hidden = !isDone;
    $("markDoneBtn").textContent = isDone ? "✓ 연습함 (탭하면 해제)" : "연습함으로 표시";
    $("markDoneBtn").classList.toggle("is-done", isDone);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (!document.execCommand("copy")) reject(new Error("copy failed"));
        else resolve();
      } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function flashCopyBtn(ok) {
    var b = $("copyQBtn");
    if (!b) return;
    var prev = b.textContent;
    b.textContent = ok ? "복사됨 ✓" : "복사 실패";
    b.classList.toggle("copied", !!ok);
    clearTimeout(flashCopyBtn._t);
    flashCopyBtn._t = setTimeout(function () {
      b.textContent = "질문 복사";
      b.classList.remove("copied");
    }, 1400);
  }

  $("copyQBtn").addEventListener("click", function () {
    var item = deck[pos];
    if (!item) return;
    // 사용자가 붙여넣어 답을 이어서 쓰도록 A. 뒤 공백까지
    var text = "Q. " + item.q + "\nA. ";
    copyText(text).then(function () { flashCopyBtn(true); }).catch(function () { flashCopyBtn(false); });
  });

  $("toggleAnswerBtn").addEventListener("click", function () {
    answerOpen = !answerOpen;
    renderAnswer();
  });

  $("markDoneBtn").addEventListener("click", function () {
    var id = deck[pos].id;
    if (done[id]) delete done[id]; else done[id] = Date.now();
    save(DONE_KEY, done);
    renderDone();
  });

  // ---- 내 연습 답변 (문항별 여러 버전) ----
  var maSelected = {};   // 문항 id → 선택한 답변 id (세션 메모리, 없으면 최신)
  var maEditing = null;  // null | "add" | "edit"
  var maOpen = true;     // 본문 펼침 (말하기 연습 중 가리기용)

  function myList(qid) {
    var list = myAnswers[qid];
    return Array.isArray(list) ? list : [];
  }

  function maIndex(list, qid) {
    for (var i = 0; i < list.length; i++) if (list[i].id === maSelected[qid]) return i;
    return list.length - 1;  // 기본은 최신(마지막)
  }

  function fmtDate(ms) {
    var d = new Date(ms);
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "." + two(d.getMonth() + 1) + "." + two(d.getDate()) + " " + two(d.getHours()) + ":" + two(d.getMinutes());
  }

  function renderMy() {
    var qid = deck[pos].id;
    var list = myList(qid);
    var idx = maIndex(list, qid);
    var has = list.length > 0;
    var editing = maEditing !== null;

    $("maCount").textContent = list.length;
    $("maEmpty").hidden = has || editing;
    $("maToggle").hidden = !has || editing;
    $("maToggle").textContent = maOpen ? "숨기기" : "보기";
    $("maToggle").setAttribute("aria-expanded", String(maOpen));

    var tabs = $("maTabs");
    tabs.innerHTML = "";
    tabs.hidden = !has;
    list.forEach(function (v, i) {
      var b = document.createElement("button");
      b.className = "ma-tab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(i === idx));
      b.disabled = editing;
      b.textContent = "버전 " + (i + 1);
      b.addEventListener("click", function () {
        maSelected[qid] = v.id;
        renderMy();
      });
      tabs.appendChild(b);
    });
    var sel = tabs.children[idx];
    if (sel) tabs.scrollLeft = Math.max(0, sel.offsetLeft - 8);  // .ma-tabs 는 position: relative

    $("maBody").hidden = !has || !maOpen || maEditing === "edit";
    if (has) {
      $("maMeta").textContent = "버전 " + (idx + 1) + " · " + fmtDate(list[idx].at);
      $("maText").textContent = list[idx].text;
    }

    $("maEditor").hidden = !editing;
    $("maActions").hidden = editing;
    $("maAdd").textContent = has ? "+ 새 버전 추가" : "+ 첫 답변 추가";
    $("maEdit").hidden = !has;
    $("maDelete").hidden = !has;
    $("maActions").classList.toggle("single", !has);
    $("maClearAll").hidden = !has || editing;
  }

  function maStartEdit(mode) {
    var qid = deck[pos].id;
    var list = myList(qid);
    maEditing = mode;
    $("maEditorLabel").textContent = mode === "add"
      ? "새 버전 " + (list.length + 1)
      : "버전 " + (maIndex(list, qid) + 1) + " 수정";
    $("maInput").value = mode === "edit" ? list[maIndex(list, qid)].text : "";
    $("maSave").disabled = mode === "add";
    renderMy();
    $("maInput").focus();
  }

  // 편집 중 내용이 있으면 떠나기 전에 확인
  function maCanLeave() {
    if (maEditing === null) return true;
    var qid = deck[pos].id;
    var list = myList(qid);
    var orig = maEditing === "edit" ? list[maIndex(list, qid)].text : "";
    if ($("maInput").value === orig) return true;
    return confirm("저장하지 않은 답변이 있어요. 버리고 이동할까요?");
  }

  $("maInput").addEventListener("input", function () {
    $("maSave").disabled = !$("maInput").value.trim();
  });
  $("maAdd").addEventListener("click", function () { maStartEdit("add"); });
  $("maEdit").addEventListener("click", function () { maStartEdit("edit"); });
  $("maCancel").addEventListener("click", function () {
    maEditing = null;
    renderMy();
  });
  $("maSave").addEventListener("click", function () {
    var text = $("maInput").value.trim();
    if (!text) return;
    var qid = deck[pos].id;
    var list = myList(qid).slice();
    if (maEditing === "add") {
      var v = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), text: text, at: Date.now() };
      list.push(v);
      maSelected[qid] = v.id;
    } else {
      var i = maIndex(list, qid);
      list[i] = { id: list[i].id, text: text, at: Date.now() };
    }
    myAnswers[qid] = list;
    save(MY_KEY, myAnswers);
    maEditing = null;
    maOpen = true;
    renderMy();
  });
  $("maDelete").addEventListener("click", function () {
    var qid = deck[pos].id;
    var list = myList(qid);
    var i = maIndex(list, qid);
    if (!confirm("버전 " + (i + 1) + "을(를) 삭제할까요?")) return;
    list = list.slice(0, i).concat(list.slice(i + 1));
    if (list.length) myAnswers[qid] = list; else delete myAnswers[qid];
    delete maSelected[qid];
    save(MY_KEY, myAnswers);
    renderMy();
  });
  $("maClearAll").addEventListener("click", function () {
    var qid = deck[pos].id;
    if (!confirm("이 질문의 연습 답변 " + myList(qid).length + "개를 모두 삭제할까요?")) return;
    delete myAnswers[qid];
    delete maSelected[qid];
    save(MY_KEY, myAnswers);
    renderMy();
  });
  $("maToggle").addEventListener("click", function () {
    maOpen = !maOpen;
    renderMy();
  });

  $("prevBtn").addEventListener("click", function () {
    if (pos > 0 && maCanLeave()) { pos--; renderQuestion(); }
  });
  $("nextBtn").addEventListener("click", function () {
    if (!maCanLeave()) return;
    if (pos < deck.length - 1) { pos++; renderQuestion(); }
    else { location.hash = "#/"; }
  });

  // ---- 타이머 ----
  var target = load(TARGET_KEY, 90);
  var elapsedMs = 0;
  var startedAt = null;  // 실행 중이면 시작 시각
  var tickId = null;
  var buzzed = false;

  function currentMs() { return elapsedMs + (startedAt ? Date.now() - startedAt : 0); }

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderTimer() {
    var sec = Math.floor(currentMs() / 1000);
    var box = document.querySelector(".timer");
    $("timerDisplay").textContent = fmt(sec);
    $("targetDisplay").textContent = fmt(target);
    $("timerBar").style.width = Math.min(100, (sec / target) * 100) + "%";
    box.classList.toggle("reached", sec >= target);
    box.classList.toggle("near", sec < target && sec >= target - 10);
    // 목표 도달 시 진동만 한 번 (답은 열지 않음)
    if (sec >= target && !buzzed && startedAt) {
      buzzed = true;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    $("timerToggle").textContent = startedAt ? "⏸ 일시정지" : (elapsedMs > 0 ? "▶ 계속" : "▶ 시작");
    document.querySelectorAll(".preset").forEach(function (b) {
      b.classList.toggle("active", Number(b.dataset.sec) === target);
    });
  }

  function timerStart() {
    if (startedAt) return;
    startedAt = Date.now();
    tickId = setInterval(renderTimer, 250);
    renderTimer();
  }
  function timerPause() {
    if (!startedAt) return;
    elapsedMs += Date.now() - startedAt;
    startedAt = null;
    clearInterval(tickId);
    renderTimer();
  }
  function timerReset() {
    clearInterval(tickId);
    startedAt = null;
    elapsedMs = 0;
    buzzed = false;
    renderTimer();
  }

  $("timerToggle").addEventListener("click", function () {
    if (startedAt) timerPause(); else timerStart();
  });
  $("timerReset").addEventListener("click", timerReset);
  document.querySelectorAll(".preset").forEach(function (b) {
    b.addEventListener("click", function () {
      target = Number(b.dataset.sec);
      save(TARGET_KEY, target);
      buzzed = Math.floor(currentMs() / 1000) >= target;
      renderTimer();
    });
  });

  // ---- 홈 기타 버튼 ----
  $("shuffleBtn").addEventListener("click", function () { location.hash = "#/shuffle"; });
  $("slidesBtn").addEventListener("click", function () { location.hash = "#/slides"; });
  $("answersBtn").addEventListener("click", function () { location.hash = "#/answers"; });
  $("backBtn").addEventListener("click", function () {
    if (!$("practice").hidden && !maCanLeave()) return;
    location.hash = "#/";
  });
  $("resetProgressBtn").addEventListener("click", function () {
    if (confirm("연습 진도를 모두 초기화할까요?")) {
      done = {};
      save(DONE_KEY, done);
      renderHome();
    }
  });

  // ---- 라우팅 ----
  function showView(name, answer) {
    var practice = name === "practice";
    var slides = name === "slides";
    $("home").hidden = name !== "home";
    $("practice").hidden = !practice;
    $("slides").hidden = !slides;
    $("pager").hidden = !practice;
    $("backBtn").hidden = name === "home";
    if (slides) { timerReset(); window.SlidesMode.enter(answer); return; }
    window.SlidesMode.leave();
    if (!practice) {
      timerReset();
      $("title").textContent = "SSIT 면접 연습";
      $("counter").textContent = "";
      renderHome();
    }
  }

  function route() {
    var h = location.hash;
    var m = h.match(/^#\/c\/(\d+)$/);
    if (m) {
      var ch = DATA.chapters.filter(function (c) { return c.no === Number(m[1]); })[0];
      if (ch) {
        showView("practice");
        startDeck(ALL.filter(function (x) { return x.chNo === ch.no; }), ch.no + ". " + ch.title);
        return;
      }
    }
    if (h === "#/slides" || h === "#/answers") {
      showView("slides", h === "#/answers");
      return;
    }
    if (h === "#/shuffle") {
      showView("practice");
      startDeck(shuffle(ALL), "전체 섞기");
      return;
    }
    showView("home");
  }

  window.addEventListener("hashchange", route);
  route();

  // ---- 오프라인(PWA) ----
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
