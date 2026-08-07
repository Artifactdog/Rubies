let lastReadyToAssign = 0

const signedMoneyNumber = (text: string | null | undefined) => {
  if (!text) return 0
  const normalized = text
    .replace(/−/g, '-')
    .replace(/[^0-9,.-]/g, '')
    .replace(/,/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : 0
}

const moneyNumber = (text: string | null | undefined) => Math.abs(signedMoneyNumber(text))

const setReactInput = (input: HTMLInputElement, value: number) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(input, value.toFixed(2))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const dispatchSelect = (select: HTMLSelectElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
  descriptor?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

const optionAmountText = (select: HTMLSelectElement) => {
  const text = select.selectedOptions[0]?.textContent?.trim() ?? ''
  return text.match(/\(([^()]*)\)\s*$/)?.[1]?.trim() ?? ''
}

const optionAvailable = (select: HTMLSelectElement) => Math.max(0, signedMoneyNumber(optionAmountText(select)))

const sliderLimitFor = (slider: HTMLInputElement) => {
  const assignment = slider.closest('.assignment-dialog-form')
  if (assignment) {
    const cards = [...assignment.querySelectorAll<HTMLElement>('.assignment-context > div')]
    const current = cards.find((card) => card.textContent?.toLowerCase().includes('currently assigned'))
    const left = cards.find((card) => card.textContent?.toLowerCase().includes('left to assign'))
    return Math.max(
      0,
      moneyNumber(current?.querySelector('strong')?.textContent)
        + moneyNumber(left?.querySelector('strong')?.textContent),
    )
  }
  if (slider.closest('.transaction-amount-editor')) return Math.max(0, lastReadyToAssign / 100)
  return 0
}

const inputForSlider = (slider: HTMLInputElement) => {
  const assignment = slider.closest('.assignment-dialog-form')
  if (assignment) return assignment.querySelector<HTMLInputElement>('.standalone-label input')
  const transaction = slider.closest('.transaction-amount-editor')
  if (transaction) return transaction.querySelector<HTMLInputElement>('input')
  return null
}

const enhanceSlider = (slider: HTMLInputElement) => {
  if (slider.dataset.rubiesEnhanced === 'true') return
  const input = inputForSlider(slider)
  if (!input) return

  slider.dataset.rubiesEnhanced = 'true'
  slider.tabIndex = -1
  slider.style.pointerEvents = 'none'
  slider.style.opacity = '0'

  const overlay = document.createElement('div')
  overlay.className = 'rubies-pointer-slider'
  overlay.setAttribute('role', 'slider')
  overlay.setAttribute('aria-label', 'Amount slider')
  overlay.innerHTML = '<span class="rubies-slider-fill"></span><span class="rubies-slider-thumb"></span>'
  slider.parentElement?.insertBefore(overlay, slider)

  const sync = () => {
    const max = sliderLimitFor(slider)
    const value = moneyNumber(input.value)
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
    overlay.style.setProperty('--rubies-slider-ratio', `${ratio * 100}%`)
    overlay.setAttribute('aria-valuemin', '0')
    overlay.setAttribute('aria-valuemax', String(max))
    overlay.setAttribute('aria-valuenow', String(Math.min(value, max)))
    overlay.classList.toggle('disabled', max <= 0)
  }

  const setFromPointer = (event: PointerEvent) => {
    const max = sliderLimitFor(slider)
    if (max <= 0) return
    const rect = overlay.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)))
    setReactInput(input, Math.round(max * ratio * 100) / 100)
    sync()
  }

  overlay.addEventListener('pointerdown', (event) => {
    if (sliderLimitFor(slider) <= 0) return
    event.preventDefault()
    overlay.setPointerCapture(event.pointerId)
    setFromPointer(event)
  })
  overlay.addEventListener('pointermove', (event) => {
    if (!overlay.hasPointerCapture(event.pointerId)) return
    event.preventDefault()
    setFromPointer(event)
  })
  overlay.addEventListener('pointerup', (event) => {
    if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId)
  })
  overlay.addEventListener('pointercancel', (event) => {
    if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId)
  })
  input.addEventListener('input', () => requestAnimationFrame(sync))
  sync()
}

const enhanceMoveMoney = (card: HTMLElement) => {
  if (card.dataset.rubiesMoveEnhanced === 'true') return
  if (card.querySelector('.dialog-header h2')?.textContent?.trim() !== 'Move money') return

  const form = card.querySelector<HTMLFormElement>('form')
  const flow = card.querySelector<HTMLElement>('.move-flow')
  const amountInput = card.querySelector<HTMLInputElement>('.standalone-label input')
  const sourceBalance = card.querySelector<HTMLElement>('.source-balance strong')
  const sourceBalanceBox = sourceBalance?.closest<HTMLElement>('.source-balance')
  const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (!form || !flow || !amountInput || !sourceBalance || !sourceBalanceBox || !submitButton) return

  const selects = flow.querySelectorAll<HTMLSelectElement>('select')
  const oldArrow = flow.querySelector<HTMLElement>('.move-arrow')
  if (selects.length !== 2 || !oldArrow) return

  card.dataset.rubiesMoveEnhanced = 'true'
  card.dataset.moveDirection = 'forward'

  const directionButton = document.createElement('button')
  directionButton.type = 'button'
  directionButton.className = 'move-arrow move-direction-button'
  directionButton.setAttribute('aria-label', 'Move from left to right. Tap to reverse direction.')
  directionButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'
  oldArrow.replaceWith(directionButton)

  const sliderBox = document.createElement('div')
  sliderBox.className = 'move-money-slider-box'
  sliderBox.innerHTML = '<div class="rubies-pointer-slider move-slider" role="slider" aria-label="Amount to move"><span class="rubies-slider-fill"></span><span class="rubies-slider-thumb"></span></div><div class="move-slider-scale"><span>0</span><span class="move-slider-max"></span></div>'
  amountInput.closest('.standalone-label')?.insertAdjacentElement('afterend', sliderBox)

  const overlay = sliderBox.querySelector<HTMLElement>('.rubies-pointer-slider')!
  const maxLabel = sliderBox.querySelector<HTMLElement>('.move-slider-max')!
  const ownError = document.createElement('div')
  ownError.className = 'form-error move-enhancement-error'
  ownError.hidden = true
  sourceBalanceBox.insertAdjacentElement('afterend', ownError)

  const isReverse = () => card.dataset.moveDirection === 'reverse'
  const sourceSelect = () => (isReverse() ? selects[1] : selects[0])
  const destinationSelect = () => (isReverse() ? selects[0] : selects[1])
  const sourceMax = () => optionAvailable(sourceSelect())
  const sourceMoneyText = () => optionAmountText(sourceSelect())

  const sync = () => {
    if (form.dataset.rubiesReverseSubmitting === 'true') return
    const max = sourceMax()
    const value = moneyNumber(amountInput.value)
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
    const valid = value > 0 && sourceSelect().value !== destinationSelect().value && value <= max

    overlay.style.setProperty('--rubies-slider-ratio', `${ratio * 100}%`)
    overlay.classList.toggle('disabled', max <= 0)
    overlay.setAttribute('aria-valuemin', '0')
    overlay.setAttribute('aria-valuemax', String(max))
    overlay.setAttribute('aria-valuenow', String(Math.min(value, max)))
    maxLabel.textContent = sourceMoneyText()
    sourceBalance.textContent = sourceMoneyText()
    sourceBalanceBox.firstChild && (sourceBalanceBox.firstChild.textContent = 'Available from source: ')
    submitButton.disabled = !valid

    ownError.hidden = value <= max
    ownError.textContent = value > max ? 'The selected source does not have enough available money.' : ''
    card.classList.toggle('move-reversed', isReverse())
    directionButton.classList.toggle('reverse', isReverse())
    directionButton.setAttribute(
      'aria-label',
      isReverse()
        ? 'Move from right to left. Tap to reverse direction.'
        : 'Move from left to right. Tap to reverse direction.',
    )
  }

  const setFromPointer = (event: PointerEvent) => {
    const max = sourceMax()
    if (max <= 0) return
    const rect = overlay.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)))
    setReactInput(amountInput, Math.round(max * ratio * 100) / 100)
    sync()
  }

  directionButton.addEventListener('click', () => {
    card.dataset.moveDirection = isReverse() ? 'forward' : 'reverse'
    requestAnimationFrame(sync)
  })

  overlay.addEventListener('pointerdown', (event) => {
    if (sourceMax() <= 0) return
    event.preventDefault()
    overlay.setPointerCapture(event.pointerId)
    setFromPointer(event)
  })
  overlay.addEventListener('pointermove', (event) => {
    if (!overlay.hasPointerCapture(event.pointerId)) return
    event.preventDefault()
    setFromPointer(event)
  })
  overlay.addEventListener('pointerup', (event) => {
    if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId)
  })
  overlay.addEventListener('pointercancel', (event) => {
    if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId)
  })

  amountInput.addEventListener('input', () => requestAnimationFrame(sync))
  selects.forEach((select) => select.addEventListener('change', () => requestAnimationFrame(sync)))

  form.addEventListener('submit', (event) => {
    if (!isReverse() || form.dataset.rubiesReverseSubmitting === 'true') return

    const max = sourceMax()
    const value = moneyNumber(amountInput.value)
    if (value <= 0 || value > max || sourceSelect().value === destinationSelect().value) {
      event.preventDefault()
      event.stopImmediatePropagation()
      sync()
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    const leftValue = selects[0].value
    const rightValue = selects[1].value
    form.dataset.rubiesReverseSubmitting = 'true'
    card.dataset.moveDirection = 'forward'
    card.classList.add('move-submitting')
    dispatchSelect(selects[0], rightValue)
    dispatchSelect(selects[1], leftValue)

    window.setTimeout(() => {
      form.requestSubmit(submitButton)
      window.setTimeout(() => {
        if (!document.contains(card)) return
        dispatchSelect(selects[0], leftValue)
        dispatchSelect(selects[1], rightValue)
        delete form.dataset.rubiesReverseSubmitting
        card.dataset.moveDirection = 'reverse'
        card.classList.remove('move-submitting')
        requestAnimationFrame(sync)
      }, 120)
    }, 0)
  }, true)

  sync()
}

const mobileMedia = window.matchMedia('(max-width: 820px)')

const enhanceMobileTabScreen = (card: HTMLElement) => {
  const title = card.querySelector('.dialog-header h2')?.textContent?.trim()
  const backdrop = card.closest<HTMLElement>('.dialog-backdrop')
  if (!backdrop) return

  if (title === 'Settings & data') {
    card.classList.add('mobile-tab-card', 'settings-screen-card')
    backdrop.classList.add('mobile-tab-backdrop', 'settings-screen-backdrop')
  }

  if (title === 'New transaction') {
    card.classList.add('mobile-tab-card', 'transaction-screen-card')
    backdrop.classList.add('mobile-tab-backdrop', 'transaction-screen-backdrop')
  }
}

const closeMobileTab = (selector?: string) => {
  const card = document.querySelector<HTMLElement>(selector ?? '.mobile-tab-card')
  card?.querySelector<HTMLButtonElement>('.dialog-header .icon-button')?.click()
}

const syncMobileNav = () => {
  const nav = document.querySelector<HTMLElement>('.mobile-nav')
  if (!nav) return
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>('button')]
  if (buttons.length < 4) return

  const settingsLabel = buttons[3].querySelector('span')
  if (settingsLabel) settingsLabel.textContent = 'Settings'
  if (!mobileMedia.matches) return

  buttons.forEach((button) => button.classList.remove('active'))
  if (document.querySelector('.transaction-screen-card')) buttons[2].classList.add('active')
  else if (document.querySelector('.settings-screen-card')) buttons[3].classList.add('active')
  else if (document.querySelector('.accounts-header')) buttons[1].classList.add('active')
  else buttons[0].classList.add('active')
}

const syncReadyToAssignState = () => {
  const card = document.querySelector<HTMLElement>('.rta-card')
  if (!card) return
  const raw = card.querySelector('strong')?.textContent ?? ''
  const negative = /[-−]/.test(raw)
  const value = moneyNumber(raw)
  lastReadyToAssign = (negative ? -value : value) * 100
  card.classList.toggle('rta-negative', negative && value > 0)
  card.classList.toggle('rta-zero', value === 0)
  card.classList.toggle('rta-positive', !negative && value > 0)
}

const enhance = () => {
  document.querySelectorAll<HTMLInputElement>('.money-slider').forEach(enhanceSlider)
  document.querySelectorAll<HTMLElement>('.dialog-card').forEach((card) => {
    enhanceMoveMoney(card)
    enhanceMobileTabScreen(card)
  })
  syncReadyToAssignState()
  syncMobileNav()
}

export const installUiEnhancements = () => {
  enhance()

  const observer = new MutationObserver(() => requestAnimationFrame(enhance))
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

  document.addEventListener('click', (event) => {
    if (!mobileMedia.matches) return
    const target = event.target as Element | null
    const button = target?.closest<HTMLButtonElement>('.mobile-nav button')
    if (!button) return

    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')]
    const index = buttons.indexOf(button)
    if (index === 0 || index === 1) closeMobileTab()
    if (index === 2) closeMobileTab('.settings-screen-card')
    if (index === 3) closeMobileTab('.transaction-screen-card')
    requestAnimationFrame(syncMobileNav)
  }, true)

  mobileMedia.addEventListener('change', () => requestAnimationFrame(enhance))
}
