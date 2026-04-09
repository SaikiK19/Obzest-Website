/* ============================================================
   Obzest — nav.js
   Navbar scroll state + mobile hamburger menu
   ============================================================ */

(function () {
  const navbar      = document.getElementById("navbar");
  const hamburger   = document.getElementById("hamburger");
  const mobileMenu  = document.getElementById("mobileMenu");
  const mobileClose = document.getElementById("mobileClose");
  const overlay     = document.getElementById("mobileOverlay");

  /* ── Scroll state ─────────────────────────────────────────── */
  const SCROLL_THRESHOLD = 80;
  const animSection = document.getElementById("animationSection");

  function onScroll() {
    const y = window.scrollY;
    const inAnim = animSection &&
      y >= animSection.offsetTop &&
      y < animSection.offsetTop + animSection.offsetHeight;

    if (inAnim) {
      navbar.classList.remove("scrolled");
      navbar.classList.add("over-animation");
    } else if (y > SCROLL_THRESHOLD) {
      navbar.classList.add("scrolled");
      navbar.classList.remove("over-animation");
    } else {
      navbar.classList.remove("scrolled");
      navbar.classList.remove("over-animation");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // run once on load

  /* ── Mobile menu ──────────────────────────────────────────── */
  function openMenu() {
    mobileMenu.classList.add("open");
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
    hamburger.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    mobileMenu.classList.remove("open");
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
    hamburger.setAttribute("aria-expanded", "false");
  }

  hamburger.addEventListener("click", openMenu);
  mobileClose.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  // Close on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });
})();
