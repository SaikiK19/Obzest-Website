// ── Shop Countdown Timer ─────────────────────────────────────
// Session-based 10-minute countdown shown on shop/product pages
// and on the homepage (after scrolling past the hero).
// Persists across product page navigation via localStorage.

;(function () {
  const DURATION_MS   = 10 * 60 * 1000
  const STORAGE_KEY   = 'obzest_shop_timer_end'

  const banner  = document.getElementById('shopCountdownBanner')
  const display = document.getElementById('shopCountdownDisplay')
  if (!banner || !display) return

  // Resolve or start timer
  let stored  = localStorage.getItem(STORAGE_KEY)
  let endTime = stored ? parseInt(stored, 10) : NaN

  if (isNaN(endTime) || endTime <= Date.now()) {
    endTime = Date.now() + DURATION_MS
    localStorage.setItem(STORAGE_KEY, String(endTime))
  }

  function pad(n) { return String(n).padStart(2, '0') }

  function tick() {
    const remaining = endTime - Date.now()
    if (remaining <= 0) {
      localStorage.removeItem(STORAGE_KEY)
      banner.classList.add('expired')
      const cta = display.closest('.countdown-cta')
      if (cta) cta.textContent = 'This offer has expired.'
      return
    }
    const m = Math.floor(remaining / 60000)
    const s = Math.floor((remaining % 60000) / 1000)
    display.textContent = pad(m) + ':' + pad(s)
  }

  tick()
  const interval = setInterval(() => {
    const remaining = endTime - Date.now()
    if (remaining <= 0) clearInterval(interval)
    tick()
  }, 1000)

  // ── Scroll-reveal mode (homepage) ─────────────────────────
  // If the banner has data-scroll-reveal, keep it hidden until
  // the user scrolls past the hero (100vh), then slide it in
  // and push the navbar down to make room.
  if (!('scrollReveal' in banner.dataset)) return

  // Initial hidden state is set in CSS via [data-scroll-reveal] attribute selector
  // so there's no JS-caused flash on load. We just add 'revealed' on scroll.
  function reveal() {
    if (window.scrollY < window.innerHeight * 0.8) return
    banner.classList.add('revealed')
    document.body.classList.add('has-countdown-banner')
    window.removeEventListener('scroll', reveal)
  }

  window.addEventListener('scroll', reveal, { passive: true })
  reveal() // handle case where page loads already scrolled
})()
