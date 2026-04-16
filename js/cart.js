/* ============================================================
   Obzest — cart.js
   Shopify Storefront API cart integration
   ============================================================ */

;(function () {
  const SHOP  = 'rdgqyy-vh.myshopify.com'
  const TOKEN = '08f3c82f329a795cbd33cbf615b98efe'
  const API   = `https://${SHOP}/api/2024-01/graphql.json`
  const CART_KEY      = 'obzest_cart_id'
  const TIMER_KEY     = 'obzest_cart_timer_end'
  const TIMER_MS      = 15 * 60 * 1000
  const DISCOUNT_CODE = 'CITRUS10'

  // ── GraphQL helper ─────────────────────────────────────────
  async function gql(query, variables) {
    const res = await fetch(API, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) throw new Error(`Network error (${res.status})`)
    const json = await res.json()
    if (json.errors) throw new Error(json.errors[0].message)
    return json.data
  }

  // ── Shared cart fragment ───────────────────────────────────
  const CART_FIELDS = `
    fragment CartFields on Cart {
      id
      checkoutUrl
      totalQuantity
      lines(first: 20) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                price { amount currencyCode }
                product { title }
              }
            }
          }
        }
      }
      cost {
        subtotalAmount { amount currencyCode }
      }
    }
  `

  const M_CREATE = `
    ${CART_FIELDS}
    mutation cartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `

  const M_ADD = `
    ${CART_FIELDS}
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `

  const M_REMOVE = `
    ${CART_FIELDS}
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `

  const M_UPDATE = `
    ${CART_FIELDS}
    mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `

  const Q_CART = `
    ${CART_FIELDS}
    query getCart($id: ID!) {
      cart(id: $id) { ...CartFields }
    }
  `

  // ── State ──────────────────────────────────────────────────
  let cart = null

  // ── API calls ──────────────────────────────────────────────
  async function fetchCart() {
    const id = localStorage.getItem(CART_KEY)
    if (!id) return null
    try {
      const data = await gql(Q_CART, { id })
      return data.cart  // null if Shopify cart expired
    } catch { return null }
  }

  async function createCart(variantId, quantity) {
    const data = await gql(M_CREATE, {
      lines: [{ merchandiseId: variantId, quantity: quantity || 1 }],
    })
    const errs = data.cartCreate.userErrors
    if (errs.length) throw new Error(errs[0].message)
    return data.cartCreate.cart
  }

  async function addLines(cartId, variantId, quantity) {
    const data = await gql(M_ADD, {
      cartId,
      lines: [{ merchandiseId: variantId, quantity: quantity || 1 }],
    })
    const errs = data.cartLinesAdd.userErrors
    if (errs.length) throw new Error(errs[0].message)
    return data.cartLinesAdd.cart
  }

  async function removeLines(cartId, lineIds) {
    const data = await gql(M_REMOVE, { cartId, lineIds })
    const errs = data.cartLinesRemove.userErrors
    if (errs.length) throw new Error(errs[0].message)
    return data.cartLinesRemove.cart
  }

  async function updateLine(cartId, lineId, quantity) {
    const data = await gql(M_UPDATE, {
      cartId,
      lines: [{ id: lineId, quantity }],
    })
    const errs = data.cartLinesUpdate.userErrors
    if (errs.length) throw new Error(errs[0].message)
    return data.cartLinesUpdate.cart
  }

  // ── Cart timer ────────────────────────────────────────────
  function startTimer() {
    if (localStorage.getItem(TIMER_KEY)) return // already running
    localStorage.setItem(TIMER_KEY, String(Date.now() + TIMER_MS))
  }

  function timerRemaining() {
    const end = parseInt(localStorage.getItem(TIMER_KEY) || '0', 10)
    return Math.max(0, end - Date.now())
  }

  function timerActive() {
    return timerRemaining() > 0
  }

  function checkoutUrl() {
    if (!cart?.checkoutUrl) return '#'
    // Force checkout through the myshopify.com domain — getobzest.com now
    // points to the static Netlify site, not Shopify, so we swap the host.
    const url = new URL(cart.checkoutUrl)
    url.hostname = SHOP
    if (timerActive() && (cart.totalQuantity ?? 0) > 0) {
      url.searchParams.set('discount', DISCOUNT_CODE)
    }
    return url.toString()
  }

  function fmtTime(ms) {
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // Updates only the timer display elements — called every second
  function tickTimer() {
    const remaining = timerRemaining()
    const row     = document.getElementById('oc-timer-row')
    const display = document.getElementById('oc-timer-display')
    const co      = document.getElementById('oc-checkout')

    if (!row || !display) return

    if (remaining <= 0) {
      row.style.display = 'none'
      if (co && cart?.checkoutUrl) co.href = cart.checkoutUrl
      return
    }

    row.style.display = ''
    display.textContent = fmtTime(remaining)
    if (co) co.href = checkoutUrl()
  }

  // ── Public: add to cart ────────────────────────────────────
  async function addToCart(variantId, btn) {
    const original = btn.textContent
    btn.disabled = true
    btn.textContent = 'Adding…'

    try {
      const cartId = localStorage.getItem(CART_KEY)
      let fresh

      if (cartId) {
        try {
          fresh = await addLines(cartId, variantId)
        } catch {
          // Cart likely expired — create a new one
          fresh = await createCart(variantId)
          localStorage.setItem(CART_KEY, fresh.id)
        }
      } else {
        fresh = await createCart(variantId)
        localStorage.setItem(CART_KEY, fresh.id)
      }

      cart = fresh
      startTimer()
      updateBadge()
      renderLines()
      openDrawer()

      btn.textContent = 'Added ✓'
      setTimeout(() => {
        btn.disabled = false
        btn.textContent = original
      }, 1800)
    } catch (err) {
      btn.disabled = false
      btn.textContent = original
      showToast(err.message || 'Could not add to cart — please try again.')
    }
  }

  // ── Drawer ─────────────────────────────────────────────────
  function openDrawer() {
    document.getElementById('oc-drawer')?.classList.add('open')
    document.getElementById('oc-overlay')?.classList.add('visible')
    document.body.style.overflow = 'hidden'
  }

  function closeDrawer() {
    document.getElementById('oc-drawer')?.classList.remove('open')
    document.getElementById('oc-overlay')?.classList.remove('visible')
    document.body.style.overflow = ''
  }

  // ── Currency formatter ─────────────────────────────────────
  function fmt(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'USD',
    }).format(parseFloat(amount))
  }

  // ── Render cart lines in drawer ────────────────────────────
  function renderLines() {
    const body   = document.getElementById('oc-body')
    const footer = document.getElementById('oc-footer')
    if (!body || !footer) return

    const lines = cart?.lines?.edges ?? []

    if (!lines.length) {
      const shopHref = window.location.pathname.includes('/products/')
        ? '../products/orange.html'
        : 'products/orange.html'
      body.innerHTML = `
        <div class="oc-empty">
          <p>Your cart is empty.</p>
          <a class="oc-shop-link" href="${shopHref}">Shop the Collection →</a>
        </div>
      `
      footer.style.display = 'none'
      return
    }

    footer.style.display = ''

    // Timer banner — injected once, kept in sync by tickTimer()
    if (!document.getElementById('oc-timer-row')) {
      const timerEl = document.createElement('div')
      timerEl.id = 'oc-timer-row'
      timerEl.className = 'oc-timer-row'
      timerEl.innerHTML = `
        <div class="oc-timer-inner">
          <span class="oc-timer-icon">⏳</span>
          <div class="oc-timer-text">
            <span>Order in <strong id="oc-timer-display">--:--</strong> for 10% off</span>
            <span class="oc-timer-code">Use code <strong>${DISCOUNT_CODE}</strong> at checkout</span>
          </div>
        </div>
      `
      footer.insertBefore(timerEl, footer.firstChild)
    }
    tickTimer()

    body.innerHTML = lines.map(({ node: ln }) => {
      const v    = ln.merchandise
      const unit = parseFloat(v.price.amount)
      return `
        <div class="oc-line">
          <div class="oc-line-meta">
            <p class="oc-line-name">${v.product.title}</p>
            <p class="oc-line-price">${fmt(unit * ln.quantity, v.price.currencyCode)}</p>
          </div>
          <div class="oc-line-controls">
            <button class="oc-qty-btn" data-dir="dec" data-id="${ln.id}" data-qty="${ln.quantity}">−</button>
            <span class="oc-qty-val">${ln.quantity}</span>
            <button class="oc-qty-btn" data-dir="inc" data-id="${ln.id}" data-qty="${ln.quantity}">+</button>
            <button class="oc-remove" data-id="${ln.id}" aria-label="Remove">×</button>
          </div>
        </div>
      `
    }).join('')

    // Subtotal
    const sub = cart?.cost?.subtotalAmount
    if (sub) {
      const el = document.getElementById('oc-subtotal')
      if (el) el.textContent = fmt(sub.amount, sub.currencyCode)
    }

    // Checkout URL (includes discount param when timer is active)
    const co = document.getElementById('oc-checkout')
    if (co) co.href = checkoutUrl()

    // Qty / remove event listeners
    body.querySelectorAll('.oc-qty-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id  = btn.dataset.id
        const qty = parseInt(btn.dataset.qty)
        const nq  = btn.dataset.dir === 'inc' ? qty + 1 : qty - 1
        btn.disabled = true
        try {
          if (nq < 1) {
            cart = await removeLines(cart.id, [id])
          } else {
            cart = await updateLine(cart.id, id, nq)
          }
          updateBadge()
          renderLines()
        } catch (err) {
          showToast(err.message)
          btn.disabled = false
        }
      })
    })

    body.querySelectorAll('.oc-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        try {
          cart = await removeLines(cart.id, [btn.dataset.id])
          updateBadge()
          renderLines()
        } catch (err) {
          showToast(err.message)
          btn.disabled = false
        }
      })
    })
  }

  // ── Navbar badge ───────────────────────────────────────────
  function updateBadge() {
    const badge = document.getElementById('oc-badge')
    if (!badge) return
    const qty = cart?.totalQuantity ?? 0
    badge.textContent = qty
    badge.hidden = qty === 0
  }

  // ── Toast notification ─────────────────────────────────────
  function showToast(msg) {
    const el = document.getElementById('oc-toast')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._t)
    el._t = setTimeout(() => el.classList.remove('show'), 3800)
  }

  // ── Inject styles ──────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style')
    style.textContent = `
/* ── Cart icon in navbar ────────────────────────────────── */
.oc-cart-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  line-height: 1;
  color: inherit;
  transition: opacity 0.2s ease;
  margin-left: 20px;
  flex-shrink: 0;
}
.oc-cart-btn:hover { opacity: 0.65; }

/* Match nav link colours per context */
.oc-cart-btn svg { stroke: rgba(241,241,241,1); transition: stroke 0.3s ease; }
.navbar.scrolled .oc-cart-btn svg,
.navbar.over-animation .oc-cart-btn svg { stroke: var(--color-teal, #1A7978); }
.page-orange .navbar:not(.scrolled):not(.over-animation) .oc-cart-btn svg { stroke: var(--color-cream, #EDE4C4); }
.page-shop   .navbar:not(.scrolled):not(.over-animation) .oc-cart-btn svg { stroke: var(--color-teal, #1A7978); }

.oc-badge {
  position: absolute;
  top: -4px; right: -6px;
  min-width: 17px; height: 17px;
  border-radius: 999px;
  background: var(--color-burnt, #C74E24);
  color: #fff;
  font-size: 10px;
  font-family: var(--font, sans-serif);
  font-weight: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
  pointer-events: none;
}

/* Mobile: push cart icon to right of logo, before hamburger */
@media (max-width: 768px) {
  .oc-cart-btn { margin-left: auto; margin-right: 12px; }
}
/* Tighten drawer padding on small screens */
@media (max-width: 480px) {
  .oc-header { padding: 22px 20px; }
  .oc-body   { padding: 8px 20px; }
  .oc-footer { padding: 20px 20px; }
}

/* ── Overlay ────────────────────────────────────────────── */
#oc-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.42);
  z-index: 300;
  opacity: 0; pointer-events: none;
  transition: opacity 0.35s ease;
}
#oc-overlay.visible { opacity: 1; pointer-events: all; }

/* ── Drawer ─────────────────────────────────────────────── */
#oc-drawer {
  position: fixed;
  top: 0; right: 0;
  width: min(420px, 100vw);
  height: 100vh;
  background: var(--color-cream-light, #F5F0E4);
  border-left: 1px solid var(--color-cream-dark, #D4C9A8);
  z-index: 350;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.45s cubic-bezier(0.76, 0, 0.24, 1);
}
#oc-drawer.open { transform: translateX(0); }

/* Header */
.oc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 32px;
  border-bottom: 1px solid var(--color-cream-dark, #D4C9A8);
  flex-shrink: 0;
}
.oc-header h2 {
  font-family: var(--font, sans-serif);
  font-weight: 400;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text, #C74E24);
  margin: 0;
}
.oc-close {
  background: none; border: none;
  font-size: 26px; line-height: 1;
  cursor: pointer;
  color: var(--color-text, #C74E24);
  font-family: var(--font, sans-serif);
  opacity: 0.5;
  transition: opacity 0.2s ease;
  padding: 0;
}
.oc-close:hover { opacity: 1; }

/* Body */
.oc-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 32px;
}

/* Empty */
.oc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 16px;
  text-align: center;
  padding: 40px 0;
}
.oc-empty p {
  font-family: var(--font, sans-serif);
  font-weight: 300;
  font-size: 15px;
  color: var(--color-text, #C74E24);
  opacity: 0.5;
  margin: 0;
}
.oc-shop-link {
  font-family: var(--font, sans-serif);
  font-weight: 400;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-teal, #1A7978);
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* Line items */
.oc-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid var(--color-cream-dark, #D4C9A8);
}
.oc-line-meta { flex: 1; min-width: 0; }
.oc-line-name {
  font-family: var(--font, sans-serif);
  font-weight: 400;
  font-size: 14px;
  color: var(--color-text, #C74E24);
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oc-line-price {
  font-family: var(--font, sans-serif);
  font-weight: 300;
  font-size: 13px;
  color: var(--color-text, #C74E24);
  opacity: 0.6;
  margin: 0;
}

/* Qty controls */
.oc-line-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.oc-qty-btn {
  width: 28px; height: 28px;
  background: var(--color-cream, #EDE4C4);
  border: 1px solid var(--color-cream-dark, #D4C9A8);
  border-radius: 50%;
  cursor: pointer;
  font-size: 15px; line-height: 1;
  color: var(--color-text, #C74E24);
  display: flex; align-items: center; justify-content: center;
  padding: 0;
  font-family: var(--font, sans-serif);
  transition: background 0.15s ease;
}
.oc-qty-btn:hover:not(:disabled) { background: var(--color-cream-dark, #D4C9A8); }
.oc-qty-btn:disabled { opacity: 0.35; cursor: default; }
.oc-qty-val {
  font-family: var(--font, sans-serif);
  font-size: 14px; font-weight: 400;
  color: var(--color-text, #C74E24);
  width: 22px; text-align: center;
}
.oc-remove {
  background: none; border: none; cursor: pointer;
  font-size: 20px; line-height: 1;
  color: var(--color-text, #C74E24);
  opacity: 0.3; padding: 0;
  font-family: var(--font, sans-serif);
  margin-left: 4px;
  transition: opacity 0.2s ease;
}
.oc-remove:hover { opacity: 0.75; }

/* Footer */
.oc-footer {
  padding: 24px 32px;
  border-top: 1px solid var(--color-cream-dark, #D4C9A8);
  flex-shrink: 0;
}
.oc-subtotal-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
}
.oc-subtotal-row span:first-child {
  font-family: var(--font, sans-serif);
  font-weight: 400; font-size: 12px;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-text, #C74E24);
}
.oc-subtotal-row span:last-child {
  font-family: var(--font, sans-serif);
  font-weight: 400; font-size: 17px;
  color: var(--color-text, #C74E24);
}
.oc-checkout-btn {
  display: block; width: 100%;
  padding: 16px;
  background: var(--color-burnt, #C74E24);
  color: var(--color-cream, #EDE4C4);
  font-family: var(--font, sans-serif);
  font-weight: 400; font-size: 13px;
  letter-spacing: 0.16em; text-transform: uppercase;
  text-align: center;
  border-radius: 2px;
  text-decoration: none;
  transition: opacity 0.2s ease;
}
.oc-checkout-btn:hover { opacity: 0.87; }
.oc-fine {
  font-family: var(--font, sans-serif);
  font-size: 11px; font-weight: 300;
  color: var(--color-text, #C74E24);
  opacity: 0.38;
  text-align: center;
  margin-top: 12px;
  letter-spacing: 0.03em;
}

/* ── Cart timer banner ──────────────────────────────────── */
.oc-timer-row {
  background: var(--color-teal, #1A7978);
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.oc-timer-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.oc-timer-icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}
.oc-timer-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.oc-timer-text span {
  font-family: var(--font, sans-serif);
  font-size: 13px;
  font-weight: 300;
  color: var(--color-cream, #EDE4C4);
  line-height: 1.4;
}
.oc-timer-text strong {
  font-weight: 500;
  color: #fff;
}
.oc-timer-code {
  font-size: 11px !important;
  opacity: 0.8;
  letter-spacing: 0.04em;
}

/* ── Toast ──────────────────────────────────────────────── */
#oc-toast {
  position: fixed;
  bottom: 28px; left: 50%;
  transform: translateX(-50%) translateY(12px);
  background: #1c1c1c;
  color: #f5f0e4;
  font-family: var(--font, sans-serif);
  font-size: 13px; font-weight: 300;
  letter-spacing: 0.03em;
  padding: 12px 24px;
  border-radius: 3px;
  z-index: 400;
  opacity: 0; pointer-events: none;
  transition: opacity 0.28s ease, transform 0.28s ease;
  max-width: 90vw; text-align: center;
}
#oc-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
`
    document.head.appendChild(style)
  }

  // ── Inject cart icon + drawer + overlay into DOM ───────────
  function injectDOM() {
    // Cart icon button — insert before hamburger in .nav-inner
    const navInner = document.querySelector('.nav-inner')
    if (navInner) {
      const btn = document.createElement('button')
      btn.id = 'oc-cart-btn'
      btn.className = 'oc-cart-btn'
      btn.setAttribute('aria-label', 'Open cart')
      btn.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        <span class="oc-badge" id="oc-badge" hidden>0</span>
      `
      btn.addEventListener('click', openDrawer)
      const hamburger = navInner.querySelector('.hamburger')
      navInner.insertBefore(btn, hamburger || null)
    }

    // Overlay
    const overlay = document.createElement('div')
    overlay.id = 'oc-overlay'
    overlay.addEventListener('click', closeDrawer)
    document.body.appendChild(overlay)

    // Drawer
    const drawer = document.createElement('aside')
    drawer.id = 'oc-drawer'
    drawer.setAttribute('role', 'dialog')
    drawer.setAttribute('aria-modal', 'true')
    drawer.setAttribute('aria-label', 'Shopping cart')
    drawer.innerHTML = `
      <div class="oc-header">
        <h2>Cart</h2>
        <button class="oc-close" id="oc-close" aria-label="Close cart">×</button>
      </div>
      <div class="oc-body" id="oc-body">
        <div class="oc-empty"><p>Your cart is empty.</p></div>
      </div>
      <div class="oc-footer" id="oc-footer" style="display:none">
        <div class="oc-subtotal-row">
          <span>Subtotal</span>
          <span id="oc-subtotal">—</span>
        </div>
        <a id="oc-checkout" href="#" class="oc-checkout-btn">Checkout</a>
        <p class="oc-fine">Shipping &amp; taxes calculated at checkout</p>
      </div>
    `
    document.body.appendChild(drawer)
    document.getElementById('oc-close').addEventListener('click', closeDrawer)

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDrawer()
    })

    // Toast
    const toast = document.createElement('div')
    toast.id = 'oc-toast'
    document.body.appendChild(toast)
  }

  // ── Wire [data-variant] buttons ────────────────────────────
  function wireButtons() {
    document.querySelectorAll('[data-variant]').forEach(btn => {
      btn.disabled = false
      btn.removeAttribute('title')
      btn.addEventListener('click', () => addToCart(btn.dataset.variant, btn))
    })
  }

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    injectStyles()
    injectDOM()
    wireButtons()

    // Restore any existing cart from localStorage
    const existing = await fetchCart()
    if (existing) {
      cart = existing
      updateBadge()
      renderLines()
    }

    // 1-second tick for the cart timer countdown
    setInterval(tickTimer, 1000)
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init()
})()
