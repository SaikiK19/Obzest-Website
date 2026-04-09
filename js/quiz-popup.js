// ── Quiz Popup ───────────────────────────────────────────────
// Appears once per session after the products section scrolls into view.

;(function () {
  if (sessionStorage.getItem('obzest_quiz_v2')) return

  const QUESTION_COUNT = 3
  const DISCOUNT_CODE  = 'CITRUS10'
  const DISCOUNT_PCT   = 10

  const BANK = [
    { q: "What percentage of the world's lemons are produced in India?",
      opts: ["16%", "25%", "36%", "50%"], a: "16%" },
    { q: "Which citrus fruit is a cross between a grapefruit and a mandarin?",
      opts: ["Tangelo", "Yuzu", "Ugli fruit", "Clementine"], a: "Tangelo" },
    { q: "How many lemons does it take to charge a small smartphone?",
      opts: ["About 500", "About 250", "About 100", "About 5,000"], a: "About 500" },
    { q: "Which country is the world's largest producer of oranges?",
      opts: ["Brazil", "USA", "China", "India"], a: "Brazil" },
    { q: "What gives citrus fruits their sour taste?",
      opts: ["Citric acid", "Ascorbic acid", "Malic acid", "Tartaric acid"], a: "Citric acid" },
    { q: "The navel orange has a small second fruit embedded at which end?",
      opts: ["Blossom end", "Stem end", "Both ends", "It's named after the US Navy"], a: "Blossom end" },
    { q: "Which citrus fruit was used to prevent scurvy on long sea voyages?",
      opts: ["Lime", "Orange", "Lemon", "Grapefruit"], a: "Lime" },
    { q: "What is the outer colored layer of citrus peel called?",
      opts: ["Zest", "Pith", "Rind", "Albedo"], a: "Zest" },
    { q: "Approximately how many varieties of citrus fruits exist worldwide?",
      opts: ["Over 600", "About 50", "Around 200", "Fewer than 30"], a: "Over 600" },
    { q: "Which citrus fruit is the most widely grown in the world?",
      opts: ["Orange", "Lemon", "Lime", "Grapefruit"], a: "Orange" },
    { q: "The pink grapefruit gets its color from which pigment?",
      opts: ["Lycopene", "Beta-carotene", "Anthocyanin", "Chlorophyll"], a: "Lycopene" },
    { q: "Which country is the origin of the Yuzu citrus fruit?",
      opts: ["China", "Japan", "Korea", "Vietnam"], a: "China" },
  ]

  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

  function pickQuestions() {
    return shuffle(BANK).slice(0, QUESTION_COUNT).map(q => ({
      ...q, opts: shuffle(q.opts),
    }))
  }

  // ── State ─────────────────────────────────────────────────
  let questions = [], current = 0, answers = [], selected = null

  // ── DOM ───────────────────────────────────────────────────
  const popup = document.getElementById('quizPopup')
  const inner = document.getElementById('quizPopupInner')
  const closeBtn = document.getElementById('quizPopupClose')

  function openPopup() {
    sessionStorage.setItem('obzest_quiz_v2', '1')
    renderStart()
    popup.classList.add('open')
  }

  function closePopup() {
    popup.classList.remove('open')
  }

  closeBtn.addEventListener('click', closePopup)

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && popup.classList.contains('open')) closePopup()
  })

  document.addEventListener('click', e => {
    if (popup.classList.contains('open') && !popup.contains(e.target)) closePopup()
  })

  // ── Fade helper ───────────────────────────────────────────
  function fadeSwap(renderFn) {
    inner.style.opacity = '0'
    inner.style.transform = 'translateY(6px)'
    setTimeout(() => {
      renderFn()
      inner.style.opacity = '1'
      inner.style.transform = 'translateY(0)'
    }, 180)
  }

  // ── Screens ───────────────────────────────────────────────
  function renderStart() {
    questions = pickQuestions()
    current = 0; answers = []; selected = null
    inner.style.transition = 'none'
    inner.style.opacity = '1'
    inner.style.transform = 'translateY(0)'
    inner.innerHTML = `
      <div class="qp-header">
        <div class="qp-icon">🍊</div>
        <div class="qp-title">Citrus Trivia</div>
        <div class="qp-sub">Answer all ${QUESTION_COUNT} correctly and unlock <strong>${DISCOUNT_PCT}% off</strong> your order.</div>
      </div>
      <button class="qp-btn-primary" id="qpStart">Play to Win</button>
    `
    document.getElementById('qpStart').addEventListener('click', () => {
      inner.style.transition = 'opacity 0.18s ease, transform 0.18s ease'
      fadeSwap(renderQuestion)
    })
  }

  function renderQuestion() {
    const q = questions[current]
    const dots = questions.map((_, i) =>
      `<div class="qp-dot ${i < current ? 'done' : i === current ? 'active' : ''}"></div>`
    ).join('')

    inner.innerHTML = `
      <div class="qp-progress">
        <span class="qp-progress-label">Question ${current + 1} of ${questions.length}</span>
        <div class="qp-dots">${dots}</div>
      </div>
      <p class="qp-question">${q.q}</p>
      <div class="qp-options" id="qpOptions"></div>
      <button class="qp-btn-primary qp-next hidden" id="qpNext">
        ${current + 1 < questions.length ? 'Next →' : 'See Results'}
      </button>
    `

    const optContainer = document.getElementById('qpOptions')
    q.opts.forEach(opt => {
      const btn = document.createElement('button')
      btn.className = 'qp-option'
      btn.textContent = opt
      btn.addEventListener('click', () => handleSelect(btn, opt, q.a))
      optContainer.appendChild(btn)
    })

    document.getElementById('qpNext').addEventListener('click', advance)
  }

  function handleSelect(btn, opt, answer) {
    if (selected !== null) return
    selected = opt
    document.querySelectorAll('.qp-option').forEach(b => {
      b.disabled = true
      if (b.textContent === answer) b.classList.add('correct')
      else if (b === btn)          b.classList.add('wrong')
      else                         b.classList.add('dimmed')
    })
    document.getElementById('qpNext').classList.remove('hidden')
  }

  function advance() {
    if (selected === null) return
    answers.push(selected === questions[current].a)
    selected = null
    if (current + 1 < questions.length) {
      fadeSwap(() => { current++; renderQuestion() })
    } else {
      fadeSwap(renderResult)
    }
  }

  function renderResult() {
    const correct = answers.filter(Boolean).length
    const won = correct === questions.length
    inner.innerHTML = won ? `
      <div class="qp-result">
        <div class="qp-icon">🎉</div>
        <div class="qp-result-title win">Perfect Score!</div>
        <p class="qp-result-sub">You aced it! Here's your <strong>${DISCOUNT_PCT}% off</strong> code:</p>
        <div class="qp-code-box">
          <span class="qp-code">${DISCOUNT_CODE}</span>
          <button class="qp-copy" id="qpCopy">Copy</button>
        </div>
        <p class="qp-fine">Use at checkout to claim your discount.</p>
      </div>
    ` : `
      <div class="qp-result">
        <div class="qp-icon">🍋</div>
        <div class="qp-result-title lose">So close!</div>
        <p class="qp-result-sub">You got <strong>${correct} of ${questions.length}</strong> correct. Need a perfect score to unlock the discount!</p>
      </div>
    `
    const copyBtn = document.getElementById('qpCopy')
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        try { navigator.clipboard.writeText(DISCOUNT_CODE) } catch (_) {}
        this.textContent = 'Copied ✓'
        this.classList.add('copied')
      })
    }
  }

  // ── Trigger: IntersectionObserver on products section ─────
  const target = document.querySelector('.products-grid')
  if (!target) return

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      observer.disconnect()
      setTimeout(openPopup, 200)
    }
  }, { threshold: 0.15 })

  observer.observe(target)
})()
