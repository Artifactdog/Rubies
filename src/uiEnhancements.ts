const moneyNumber = (text: string | null | undefined) => {
  if (!text) return 0
  const normalized = text.replace(/[^0-9,.-]/g, '').replace(/,/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? Math.abs(value) : 0
}

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

const sliderLimitFor = (slider: HTMLInputElement) => {
  const assignment = slider.closest('.assignment-dialog-form')
  if (assignment) {
    const cards = [...assignment.querySelectorAll<HTMLElement>('.assignment-context > div')]
    const current = cards.find((card) => card.textContent?.toLowerCase().includes('currently assigned'))
    const left = cards.find((card) => card.textContent?.toLowerCase().includes('left to assign'))
    return Math.max(0, moneyNumber(current?.querySelector('strong')?.textContent) + moneyNumber(left?.querySelector('strong')?.textContent))
  }
  if (slider.closest('.transaction-amount-editor')) {
    const rta = document.querySelector<HTMLElement>('.rta-card strong')
    return Math.max(0, moneyNumber(rta?.textContent))
  }
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
  input.addEventListener('input', sync)
  sync()
}

const enhanceMoveMoney = (card: HTMLElement) => {
  if (card.dataset.rubiesMoveEnhanced === 'true') return
  if (card.querySelector('.dialog-header h2')?.textContent?.trim() !== 'Move money') return
  const flow = card.querySelector('.move-flow')
  const amountInput = card.querySelector<HTMLInputElement>('.standalone-label input')
  const sourceBalance = card.querySelector<HTMLElement>('.source-balance strong')
  if (!flow || !amountInput || !sourceBalance) return
  card.dataset.rubiesMoveEnhanced = 'true'
  const selects = flow.querySelectorAll<HTMLSelectElement>('select')
  const oldArrow = flow.querySelector<HTMLElement>('.move-arrow')
  if (selects.length === 2 && oldArrow) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'move-arrow move-direction-button'
    button.setAttribute('aria-label', 'Reverse money movement direction')
    button.innerHTML = '<span>→</span>'
    button.addEventListener('click', () => {
      const from = selects[0].value
      const to = selects[1].value
      dispatchSelect(selects[0], to)
      dispatchSelect(selects[1], from)
      button.classList.remove('flip-pulse')
      requestAnimationFrame(() => button.classList.add('flip-pulse'))
    })
    oldArrow.replaceWith(button)
  }
  const box = document.createElement('div')
  box.className = 'move-money-slider-box'
  box.innerHTML = '<div class="rubies-pointer-slider move-slider" role="slider" aria-label="Amount to move"><span class="rubies-slider-fill"></span><span class="rubies-slider-thumb"></span></div><div class="move-slider-scale"><span>0</span><span class="move-slider-max"></span></div>'
  amountInput.closest('.standalone-label')?.insertAdjacentElement('afterend', box)
  const overlay = box.querySelector<HTMLElement>('.rubies-pointer-slider')!
  const maxLabel = box.querySelector<HTMLElement>('.move-slider-max')!
  const sync = () => {
    const max = moneyNumber(sourceBalance.textContent)
    const value = moneyNumber(amountInput.value)
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
    overlay.style.setProperty('--rubies-slider-ratio', `${ratio * 100}%`)
    overlay.classList.toggle('disabled', max <= 0)
    maxLabel.textContent = sourceBalance.textContent ?? ''
  }
  const setFromPointer = (event: PointerEvent) => {
    const max = moneyNumber(sourceBalance.textContent)
    if (max <= 0) return
    const rect = overlay.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)))
    setReactInput(amountInput, Math.round(max * ratio * 100) / 100)
    sync()
  }
  overlay.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    overlay.setPointerCapture(event.pointerId)
    setFromPointer(event)
  })
  overlay.addEventListener('pointermove', (event) => {
    if (!overlay.hasPointerCapture(event.pointerId)) return
    setFromPointer(event)
  })
  overlay.addEventListener('pointerup', (event) => {
    if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId)
  })
  amountInput.addEventListener('input', sync)
  selects.forEach((select) => select.addEventListener('change', () => requestAnimationFrame(sync)))
  new MutationObserver(sync).observe(sourceBalance, { childList: true, subtree: true, characterData: true })
  sync()
}

const enhanceSettingsScreen = (card: HTMLElement) => {
  if (card.querySelector('.dialog-header h2')?.textContent?.trim() !== 'Settings & data') return
  card.classList.add('settings-screen-card')
  card.closest('.dialog-backdrop')?.classList.add('settings-screen-backdrop')
  document.querySelector('.mobile-nav button:last-child')?.classList.add('active')
}

const syncReadyToAssignState = () => {
  const card = document.querySelector<HTMLElement>('.rta-card')
  if (!card) return
  const raw = card.querySelector('strong')?.textContent ?? ''
  const negative = /-/.test(raw)
  const value = moneyNumber(raw)
  card.classList.toggle('rta-negative', negative && value > 0)
  card.classList.toggle('rta-zero', value === 0)
  card.classList.toggle('rta-positive', !negative && value > 0)
}

const enhance = () => {
  document.querySelectorAll<HTMLInputElement>('.money-slider').forEach(enhanceSlider)
  document.querySelectorAll<HTMLElement>('.dialog-card').forEach((card) => {
    enhanceMoveMoney(card)
    enhanceSettingsScreen(card)
  })
  syncReadyToAssignState()
}

export const installUiEnhancements = () => {
  enhance()
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    if (!target?.closest('.mobile-nav button')) return
    const settings = document.querySelector('.settings-screen-card')
    settings?.querySelector<HTMLButtonElement>('.dialog-header .icon-button')?.click()
  }, true)
}
