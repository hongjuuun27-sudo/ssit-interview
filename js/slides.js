// 발표 자료(PPT) 모드 — app.js 의 라우팅에서 SlidesMode.enter()/leave() 로 호출
(function () {
  "use strict";

  var DATA = window.SLIDES_DATA;
  var ANSWERS = window.ANSWERS_DATA.answers;   // N번 답변 ↔ N장
  var TOTAL_SEC = 180;   // 전체 3분
  var PER_SEC = 60;      // 장당 권장 1분
  var N = DATA.slides.length;

  var $ = function (id) { return document.getElementById(id); };
  var track = $("slidesTrack");
  var viewport = $("slidesViewport");

  var pos = 0;
  var active = false;
  var showAnswer = false;

  // ---- 슬라이드 그리기 (문구는 textContent 로 원문 그대로) ----
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  DATA.slides.forEach(function (s, i) {
    var slide = el("section", "slide");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", (i + 1) + "/" + N);

    var head = el("header", "slide-head");
    var h = el("h2", "slide-title");
    // "[1장] 제목" → "[1장]" 부분만 뱃지로 꾸미고 글자는 그대로 둔다
    var m = s.title.match(/^(\[\d+장\])( .*)$/);
    if (m) {
      h.appendChild(el("span", "slide-no", m[1]));
      h.appendChild(document.createTextNode(m[2]));
    } else {
      h.textContent = s.title;
    }
    head.appendChild(h);
    slide.appendChild(head);

    var grid = el("div", "slide-grid");
    s.sections.forEach(function (sec, j) {
      var card = el("article", "s-card s-card-" + (j % 4));
      card.appendChild(el("h3", "s-card-title", sec.title));
      var ul = el("ul", "s-card-list");
      sec.items.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      card.appendChild(ul);
      grid.appendChild(card);
    });
    slide.appendChild(grid);

    // 발표 답변: 같은 장 안에 전문을 넣고, 보기 전환으로 슬라이드 대신 보여 준다
    var ans = el("article", "s-answer");
    ans.appendChild(el("h3", "s-answer-title", ANSWERS[i].title));
    ANSWERS[i].paragraphs.forEach(function (t) { ans.appendChild(el("p", null, t)); });
    slide.appendChild(ans);

    slide.appendChild(el("footer", "slide-foot", DATA.note));
    track.appendChild(slide);

    var dot = el("button", "s-dot");
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", (i + 1) + "/" + N);
    dot.addEventListener("click", function () { go(i); });
    $("sDots").appendChild(dot);
  });

  function go(i) {
    pos = Math.max(0, Math.min(N - 1, i));
    render();
  }

  function render(dragPx) {
    track.style.transform = "translateX(calc(" + (-pos * 100) + "% + " + (dragPx || 0) + "px))";
    track.classList.toggle("dragging", dragPx != null);
    var label = (pos + 1) + "/" + N;
    $("sPage").textContent = label;
    $("counter").textContent = label;
    $("sPrev").disabled = pos === 0;
    $("sNext").disabled = pos === N - 1;
    Array.prototype.forEach.call($("sDots").children, function (d, i) {
      d.classList.toggle("active", i === pos);
      d.setAttribute("aria-selected", String(i === pos));
    });
    Array.prototype.forEach.call(track.children, function (s, i) {
      s.setAttribute("aria-hidden", String(i !== pos));
      if (i !== pos) s.scrollTop = 0;
    });
    renderTimer();
  }

  // ---- 슬라이드 / 발표 답변 전환 (장 위치는 그대로) ----
  // 발표 답변은 읽기용: 타이머를 멈추고 숨긴다 (슬라이드로 돌아오면 다시 보임)
  function setAnswer(on) {
    showAnswer = on;
    if (on) timerPause();
    $("slides").classList.toggle("show-answer", on);
    $("sTimer").hidden = !!on; // 답변=읽기용: 타이머 완전 숨김 (캐시된 CSS에도 안전)
    $("sTabSlide").setAttribute("aria-pressed", String(!on));
    $("sTabAnswer").setAttribute("aria-pressed", String(on));
    $("title").textContent = on ? "발표 답변" : "발표 자료";
    if (track.children[pos]) track.children[pos].scrollTop = 0;
    if (active) history.replaceState(null, "", on ? "#/answers" : "#/slides");
  }
  $("sTabSlide").addEventListener("click", function () { setAnswer(false); });
  $("sTabAnswer").addEventListener("click", function () { setAnswer(true); });

  $("sPrev").addEventListener("click", function () { go(pos - 1); });
  $("sNext").addEventListener("click", function () { go(pos + 1); });

  document.addEventListener("keydown", function (e) {
    if (!active) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") go(pos + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(pos - 1);
  });

  // ---- 좌우 스와이프 (세로 스크롤은 브라우저에 맡김) ----
  var sx = 0, sy = 0, dx = 0, mode = null;
  viewport.addEventListener("touchstart", function (e) {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; mode = null;
  }, { passive: true });
  viewport.addEventListener("touchmove", function (e) {
    var x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
    if (!mode && (Math.abs(x) > 10 || Math.abs(y) > 10)) mode = Math.abs(x) > Math.abs(y) ? "h" : "v";
    if (mode !== "h") return;
    dx = x;
    // 처음/끝에서는 저항감을 준다
    if ((pos === 0 && dx > 0) || (pos === N - 1 && dx < 0)) dx = dx / 3;
    render(dx);
  }, { passive: true });
  viewport.addEventListener("touchend", function () {
    if (mode === "h") {
      var w = viewport.clientWidth;
      if (dx < -Math.min(60, w * 0.2)) pos = Math.min(N - 1, pos + 1);
      else if (dx > Math.min(60, w * 0.2)) pos = Math.max(0, pos - 1);
    }
    mode = null; dx = 0;
    render();
  });

  // ---- 전체 3분 타이머 (자동 넘김 없음) ----
  var elapsedMs = 0, startedAt = null, tickId = null, lastSec = 0;

  function currentMs() { return elapsedMs + (startedAt ? Date.now() - startedAt : 0); }
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderTimer() {
    var sec = Math.floor(currentMs() / 1000);
    var box = $("sTimer");
    var paceSlide = Math.min(N, Math.floor(sec / PER_SEC) + 1);
    var reached = sec >= TOTAL_SEC;
    var behind = !reached && sec > 0 && pos + 1 < paceSlide;

    $("sTimerDisplay").textContent = fmt(sec);
    $("sTimerBar").style.width = Math.min(100, (sec / TOTAL_SEC) * 100) + "%";
    box.classList.toggle("reached", reached);
    box.classList.toggle("near", !reached && sec >= TOTAL_SEC - 10);
    box.classList.toggle("behind", behind);
    $("sPace").textContent = reached ? "⏰ 3분 도달"
      : sec === 0 ? "시작을 누르면 측정합니다"
      : behind ? "권장 " + paceSlide + "장 · 조금 서두르세요"
      : "권장 " + paceSlide + "장 진행 중";

    // 1분마다 짧게, 3분 도달 시 길게 한 번 진동 (넘김은 직접)
    if (startedAt && sec > lastSec) {
      if (navigator.vibrate) {
        for (var t = lastSec + 1; t <= sec; t++) {
          if (t === TOTAL_SEC) { navigator.vibrate([200, 100, 200]); break; }
          if (t < TOTAL_SEC && t % PER_SEC === 0) { navigator.vibrate(80); break; }
        }
      }
      lastSec = sec;
    }
    $("sTimerToggle").textContent = startedAt ? "⏸ 일시정지" : (elapsedMs > 0 ? "▶ 계속" : "▶ 시작");
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
    lastSec = 0;
    renderTimer();
  }

  $("sTimerToggle").addEventListener("click", function () {
    if (startedAt) timerPause(); else timerStart();
  });
  $("sTimerReset").addEventListener("click", timerReset);

  window.SlidesMode = {
    enter: function (answer) {
      active = true;
      setAnswer(!!answer);
      document.body.classList.add("is-slides");
      render();
    },
    leave: function () {
      if (!active) return;
      active = false;
      document.body.classList.remove("is-slides");
      timerReset();
      go(0);
    }
  };
})();
