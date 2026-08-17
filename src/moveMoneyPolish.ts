const amountSuffix = /\s+\(([^()]*)\)\s*$/

const moveMoneyCards = () => [...document.querySelectorAll<HTMLElement>('.dialog-card')]
  .filter((card) => card.querySelector('.dialog-header h2')?.textContent?.trim() === 'Move money')

const prepareOptionLabels = (select: HTMLSelectElement) => {
  ;[...select.options].forEach((option) => {
    const original = option.dataset.rubiesOriginalText ?? option.textContent?.trim() ?? ''
    if (!option.dataset.rubiesOriginalText) option.dataset.rubiesOriginalText = original

    const match = original.match(amountSuffix)
    if (!match) return

    option.dataset.rubiesAvailableText = match[1].trim()
    const cleanLabel = original.replace(amountSuffix, '').trim()
    if (cleanLabel) option.label = cleanLabel
  })
}

const ensureEndpointSummary = (label: HTMLLabelElement, select: HTMLSelectElement) => {
  let summary = label.querySelector<HTMLElement>(':scope > .move-endpoint-summary')
  if (!summary) {
    summary = document.createElement('span')
    summary.className = 'move-endpoint-summary'
    summary.innerHTML = '<span class="move-endpoint-summary-label">Available</span><strong></strong>'
    select.insertAdjacentElement('afterend', summary)
  }

  const selected = select.selectedOptions[0]
  const amount = selected?.dataset.rubiesAvailableText ?? ''
  const value = summary.querySelector<HTMLElement>('strong')
  if (value) value.textContent = amount || '—'
}

const enhanceMoveMoneyCard = (card: HTMLElement) => {
  const flow = card.querySelector<HTMLElement>('.move-flow')
  if (!flow) return

  const labels = [...flow.querySelectorAll<HTMLLabelElement>(':scope > label')]
  labels.forEach((label) => {
    const select = label.querySelector<HTMLSelectElement>('select')
    if (!select) return
    prepareOptionLabels(select)
    ensureEndpointSummary(label, select)
  })

  card.classList.add('rubies-move-money-polished')
}

const enhance = () => moveMoneyCards().forEach(enhanceMoveMoneyCard)

let enhanceFrame = 0
const scheduleEnhance = () => {
  if (enhanceFrame) return
  enhanceFrame = requestAnimationFrame(() => {
    enhanceFrame = 0
    enhance()
  })
}

export const installMoveMoneyPolish = () => {
  enhance()
  document.addEventListener('click', scheduleEnhance, true)
  document.addEventListener('change', scheduleEnhance, true)
  document.addEventListener('input', scheduleEnhance, true)
}
