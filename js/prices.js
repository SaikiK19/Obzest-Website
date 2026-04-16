/* ============================================================
   Obzest — prices.js
   Fetches live variant prices from Shopify Storefront API and
   updates every [data-variant-price] element on the page.
   Falls back silently to hardcoded values if the fetch fails.
   ============================================================ */

(function () {
  const SHOP  = 'rdgqyy-vh.myshopify.com'
  const TOKEN = '08f3c82f329a795cbd33cbf615b98efe'
  const API   = `https://${SHOP}/api/2024-01/graphql.json`

  const priceEls = document.querySelectorAll('[data-variant-price]')
  if (!priceEls.length) return

  const ids = [...new Set([...priceEls].map(el => el.dataset.variantPrice))]

  const Q = `
    query getPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          price { amount currencyCode }
        }
      }
    }
  `

  function fmt(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'USD',
    }).format(parseFloat(amount))
  }

  fetch(API, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query: Q, variables: { ids } }),
  })
    .then(r => r.json())
    .then(json => {
      const map = {}
      ;(json.data?.nodes || []).forEach(node => {
        if (node?.id) map[node.id] = node.price
      })
      priceEls.forEach(el => {
        const price = map[el.dataset.variantPrice]
        if (!price) return
        const weight = el.dataset.weight
        el.textContent = weight
          ? `${fmt(price.amount, price.currencyCode)} · ${weight}`
          : fmt(price.amount, price.currencyCode)
      })
    })
    .catch(() => {})
})()
