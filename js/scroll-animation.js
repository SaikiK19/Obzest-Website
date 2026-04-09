/* ============================================================
   Obzest — scroll-animation.js
   Scroll-driven orange peel video scrub.

   Desktop: targetTime is set instantly from scroll, but a
   rAF loop lerps displayTime toward targetTime each frame,
   then seeks only when the delta is meaningful. This decouples
   scroll events from video seeks for a smooth scrub feel.
   Mobile (<768px): video autoplays looped, all copy visible.
   ============================================================ */

(function () {
  const wrapper   = document.getElementById("animationSection");
  const video     = document.getElementById("peelVideo");
  const copyItems = document.querySelectorAll(".copy-item");

  if (!wrapper || !video) return;

  const isMobile = () => window.innerWidth < 768;

  /* ── Mobile fallback ────────────────────────────────────── */
  function initMobile() {
    video.autoplay = true;
    video.loop     = true;
    video.play().catch(() => {});
    copyItems.forEach(item => item.classList.add("visible"));
  }

  /* ── Progress ───────────────────────────────────────────── */
  function getProgress() {
    const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
    const scrollable = wrapper.offsetHeight - window.innerHeight;
    const scrolled   = window.scrollY - wrapperTop;
    return Math.max(0, Math.min(1, scrolled / scrollable));
  }

  function updateCopy(progress) {
    copyItems.forEach((item, i) => {
      const threshold = parseFloat(item.dataset.at);
      const next      = copyItems[i + 1];
      const nextAt    = next ? parseFloat(next.dataset.at) - 0.01 : 1;
      const visible   = progress >= threshold && (!next || progress < nextAt);
      item.classList.toggle("visible", visible);
    });
  }

  /* ── Lerp scrub ─────────────────────────────────────────── */
  let targetTime  = 0; // set instantly on scroll
  let displayTime = 0; // lerped toward targetTime each frame
  let isSeeking   = false;
  let rafLoop     = null;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function startLoop() {
    if (rafLoop) return;
    function loop() {
      rafLoop = requestAnimationFrame(loop);
      if (!video.duration) return;

      displayTime = lerp(displayTime, targetTime, 0.015);

      // Only seek when gap exceeds ~2 frames (0.067s) to reduce
      // seek frequency — each seek causes a micro-stall/jitter.
      if (!isSeeking && Math.abs(displayTime - video.currentTime) > 0.067) {
        isSeeking = true;
        video.currentTime = displayTime;
      }
    }
    loop();
  }

  function stopLoop() {
    if (rafLoop) { cancelAnimationFrame(rafLoop); rafLoop = null; }
  }

  video.addEventListener("seeked", () => { isSeeking = false; });

  /* ── Scroll handler — only updates target + copy ────────── */
  function onScroll() {
    const progress = getProgress();
    updateCopy(progress);
    if (video.duration) {
      targetTime = progress * video.duration;
    }
  }

  /* ── Pre-buffer ─────────────────────────────────────────────
     Seek to the last frame once so the browser fetches the full
     video, then return to 0. Eliminates stalling near the end.  */
  function prebuffer() {
    const endTime = video.duration - 0.05;
    video.currentTime = endTime;
    video.addEventListener("seeked", function restoreStart() {
      video.removeEventListener("seeked", restoreStart);
      video.currentTime = 0;
      displayTime = 0;
      isSeeking   = false;
      onScroll();
      startLoop();
    }, { once: true });
  }

  /* ── Desktop init ───────────────────────────────────────── */
  function initDesktop() {
    video.pause();
    video.currentTime = 0;
    displayTime = 0;
    targetTime  = 0;

    window.addEventListener("scroll", onScroll, { passive: true });

    if (video.duration) {
      prebuffer();
    } else {
      video.addEventListener("loadedmetadata", prebuffer, { once: true });
    }
  }

  /* ── Init ───────────────────────────────────────────────── */
  if (isMobile()) {
    initMobile();
  } else {
    initDesktop();
  }

  let wasM = isMobile();
  window.addEventListener("resize", () => {
    const nowM = isMobile();
    if (nowM !== wasM) {
      wasM = nowM;
      if (nowM) {
        window.removeEventListener("scroll", onScroll);
        stopLoop();
        initMobile();
      } else {
        video.pause();
        video.loop = false;
        initDesktop();
      }
    }
  });
})();
