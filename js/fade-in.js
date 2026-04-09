/* ============================================================
   Obzest — fade-in.js
   IntersectionObserver fade-in for .js-fade-in elements.
   Runs on every page, independent of the video animation.
   ============================================================ */
(function () {
  const targets = document.querySelectorAll(".js-fade-in");
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach(el => observer.observe(el));
})();
