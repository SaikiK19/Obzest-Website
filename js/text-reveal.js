/* ============================================================
   Obzest — text-reveal.js
   Scroll-driven word-by-word opacity reveal.

   Each .text-reveal-outer is a tall scroll container.
   The .brand-intro--sticky section inside it is sticky,
   so content stays centred while the user scrolls through.
   Words in .js-text-reveal animate from ghost → full opacity
   as scroll progress moves through the outer wrapper.
   ============================================================ */

(function () {

  /* Split an element's text into ghost + fill word spans.
     Returns the NodeList of fill spans for that element.     */
  function splitWords(el) {
    const text = el.textContent.trim();
    const words = text.split(/\s+/);

    el.innerHTML = words.map(function (word) {
      return (
        '<span class="reveal-word">' +
          '<span class="reveal-ghost" aria-hidden="true">' + word + '</span>' +
          '<span class="reveal-fill">' + word + '</span>' +
        '</span>'
      );
    }).join(' ');

    return el.querySelectorAll('.reveal-fill');
  }

  /* Initialise one .text-reveal-outer wrapper */
  function initWrapper(outer) {
    const targets = outer.querySelectorAll('.js-text-reveal');
    if (!targets.length) return;

    /* Collect all fill spans across every target in this wrapper */
    const allFills = [];
    targets.forEach(function (el) {
      splitWords(el).forEach(function (span) {
        allFills.push(span);
      });
    });

    const total = allFills.length;

    function update() {
      const rect       = outer.getBoundingClientRect();
      const scrollable = outer.offsetHeight - window.innerHeight;
      const scrolled   = -rect.top;
      const progress   = Math.max(0, Math.min(1, scrolled / scrollable));

      allFills.forEach(function (fill, i) {
        const start       = i / total;
        const end         = start + 1 / total;
        const wordProgress = Math.max(0, Math.min(1, (progress - start) / (end - start)));
        fill.style.opacity = wordProgress;
      });
    }

    window.addEventListener('scroll', update, { passive: true });
    /* Run once in case user lands mid-page */
    update();
  }

  /* Find all wrappers on the page */
  document.querySelectorAll('.text-reveal-outer').forEach(initWrapper);

})();
