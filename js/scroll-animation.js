/* ============================================================
   Obzest — scroll-animation.js
   Scroll-driven orange peel video scrub.

   Desktop: video.currentTime driven by scroll position within
   the sticky wrapper. Uses getBoundingClientRect for reliable
   position calculation. Scroll listener attaches immediately
   so it doesn't depend on canplaythrough (which browsers
   often skip for non-autoplay video).
   Mobile (<768px): video autoplays looped, all copy visible.
   ============================================================ */

(function () {
  const wrapper   = document.getElementById("animationSection");
  const video     = document.getElementById("peelVideo");
  const copyItems = document.querySelectorAll(".copy-item");

  if (!wrapper || !video) return;

  const isMobile = () => window.innerWidth < 768;

  /* ── Mobile fallback ──────────────────────────────────────
     Autoplay looped video, show all copy items statically.   */
  function initMobile() {
    video.autoplay = true;
    video.loop     = true;
    video.play().catch(() => {});
    copyItems.forEach(item => item.classList.add("visible"));
  }

  /* ── Progress ─────────────────────────────────────────────
     getBoundingClientRect + scrollY gives true doc position,
     unlike offsetTop which can be wrong with any positioned
     ancestor in the chain.                                   */
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

  let targetTime = 0;
  let isSeeking  = false;
  let raf        = null;

  function applySeek() {
    if (!video.duration) return;
    video.currentTime = targetTime;
  }

  video.addEventListener("seeked", () => {
    isSeeking = false;
    if (Math.abs(video.currentTime - targetTime) > 0.05) {
      isSeeking = true;
      applySeek();
    }
  });

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const progress = getProgress();
      updateCopy(progress);
      if (!video.duration) return; // wait for metadata — will re-fire on loadedmetadata
      targetTime = progress * video.duration;
      if (!isSeeking) {
        isSeeking = true;
        applySeek();
      }
    });
  }

  /* ── Desktop init ─────────────────────────────────────────
     Attach scroll listener immediately. onScroll already
     guards with `if (!video.duration) return`, so early
     calls are safe. loadedmetadata fires a one-shot seek
     to land on the correct frame once duration is known.    */
  function initDesktop() {
    video.pause();
    video.currentTime = 0;

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (!video.duration) {
      video.addEventListener("loadedmetadata", onScroll, { once: true });
    }
  }

  /* ── Init ─────────────────────────────────────────────────  */
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
        initMobile();
      } else {
        video.pause();
        video.loop = false;
        initDesktop();
      }
    }
  });
})();
