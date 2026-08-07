const mobileMedia = window.matchMedia('(max-width: 820px)')

const signedMoneyNumber = (text: string | null | undefined) => {
  if (!text) return 0
  const normalized = text.replace(/−/g, '-').replace(/[^0-9,.-]/g, '').replace(/,/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : 0
}

const syncNavHeight = () => {
  const nav = document.querySelector<HTMLElement>('.mobile-nav')
  const height = mobileMedia.matches && nav ? Math.ceil(nav.getBoundingClientRect().height) : 0
  document.documentElement.style.setProperty('--rubies-mobile-nav-height', `${height}px`)
}

const findDialogByTitle = (title: string) => [...document.querySelectorAll<HTMLElement>('.dialog-card')]
  .find((card) => card.querySelector('.dialog-header h2')?.textContent?.trim() === title)

const syncDialogRoles = () => {
  const move = findDialogByTitle('Move money')
  move?.classList.add('move-money-modal-card')
  move?.closest('.dialog-backdrop')?.classList.add('move-money-modal-backdrop')

  const transaction = findDialogByTitle('New transaction')
  transaction?.classList.add('transaction-mobile-screen')
  transaction?.closest('.dialog-backdrop')?.classList.add('transaction-mobile-backdrop')
}

let observedRta: Element | null = null
let rtaObserver: IntersectionObserver | null = null
let sourceVisible = true

const ensureHud = () => {
  let hud = document.querySelector<HTMLButtonElement>('.budget-health-hud')
  if (!hud) {
    hud = document.createElement('button')
    hud.type = 'button'
    hud.className = 'budget-health-hud'
    hud.innerHTML = '<span>Ready to assign</span><strong></strong>'
    hud.addEventListener('click', () => {
      document.querySelector<HTMLElement>('.rta-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    document.body.appendChild(hud)
  }
  return hud
}

const syncBudgetHealthHud = () => {
  const source = document.querySelector<HTMLElement>('.rta-card')
  const hud = ensureHud()

  if (!source) {
    hud.classList.remove('visible')
    return
  }

  const amountText = source.querySelector('strong')?.textContent?.trim() ?? ''
  const amount = signedMoneyNumber(amountText)
  hud.querySelector('strong')!.textContent = amountText
  hud.classList.toggle('positive', amount > 0)
  hud.classList.toggle('zero', amount === 0)
  hud.classList.toggle('negative', amount < 0)

  const anyDialog = Boolean(document.querySelector('.dialog-backdrop'))
  hud.classList.toggle('visible', !sourceVisible && !anyDialog)

  if (observedRta !== source) {
    rtaObserver?.disconnect()
    observedRta = source
    sourceVisible = true
    rtaObserver = new IntersectionObserver((entries) => {
      sourceVisible = entries[0]?.isIntersecting ?? true
      requestAnimationFrame(syncBudgetHealthHud)
    }, { threshold: 0.05 })
    rtaObserver.observe(source)
  }
}

const syncTransactionColors = () => {
  const transaction = findDialogByTitle('New transaction')
  if (!transaction) return
  const buttons = transaction.querySelectorAll<HTMLButtonElement>('.kind-toggle button')
  if (buttons.length < 2) return
  buttons[0].classList.add('expense-kind')
  buttons[1].classList.add('income-kind')
}

const sync = () => {
  syncNavHeight()
  syncDialogRoles()
  syncTransactionColors()
  syncBudgetHealthHud()
}

export const installUiStability = () => {
  sync()

  const observer = new MutationObserver(() => requestAnimationFrame(sync))
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

  window.addEventListener('resize', () => requestAnimationFrame(syncNavHeight), { passive: true })
  window.addEventListener('orientationchange', () => requestAnimationFrame(syncNavHeight), { passive: true })
  mobileMedia.addEventListener('change', () => requestAnimationFrame(sync))
}
