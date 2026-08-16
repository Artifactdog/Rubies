const mobileMotionMedia = window.matchMedia('(max-width: 820px)')
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')

const closeSelector = '.dialog-header .icon-button, .dialog-actions .secondary-button'
const closingQueues = new WeakMap<HTMLElement, Array<() => void>>()
const closingTimers = new WeakMap<HTMLElement, number>()

const motionDelay = () => reducedMotionMedia.matches ? 0 : mobileMotionMedia.matches ? 230 : 190

const dialogBackdropFor = (element: Element | null) => element?.closest<HTMLElement>('.dialog-backdrop') ?? null

const dialogCardFor = (backdrop: HTMLElement) => backdrop.querySelector<HTMLElement>(':scope > .dialog-card')

const clearDragState = (card: HTMLElement | null) => {
  if (!card) return
  card.classList.remove('rubies-sheet-dragging', 'rubies-sheet-rebounding')
}

const resetDismissState = (backdrop: HTMLElement) => {
  const timer = closingTimers.get(backdrop)
  if (timer) window.clearTimeout(timer)
  closingTimers.delete(backdrop)
  closingQueues.delete(backdrop)
  backdrop.classList.remove('rubies-motion-dismissing')
  delete backdrop.dataset.rubiesMotionClosing
  const card = dialogCardFor(backdrop)
  clearDragState(card)
  card?.style.removeProperty('--rubies-sheet-drag')
}

const runAfterDismiss = (backdrop: HTMLElement, action: () => void) => {
  const existingQueue = closingQueues.get(backdrop)
  if (existingQueue) {
    existingQueue.push(action)
    return
  }

  const queue = [action]
  closingQueues.set(backdrop, queue)
  backdrop.dataset.rubiesMotionClosing = 'true'

  const card = dialogCardFor(backdrop)
  clearDragState(card)
  backdrop.classList.add('rubies-motion-dismissing')

  const timer = window.setTimeout(() => {
    closingTimers.delete(backdrop)
    const actions = closingQueues.get(backdrop) ?? []
    closingQueues.delete(backdrop)
    actions.forEach((queuedAction) => queuedAction())
  }, motionDelay())
  closingTimers.set(backdrop, timer)
}

const clickWithoutDismiss = (button: HTMLButtonElement) => {
  button.dataset.rubiesMotionBypass = 'true'
  button.click()
}

const isExplicitCloseButton = (button: HTMLButtonElement) => {
  if (button.matches('.dialog-header .icon-button')) return true
  if (!button.matches('.dialog-actions .secondary-button')) return false
  const text = button.textContent?.trim().toLowerCase() ?? ''
  return text === 'cancel' || text === 'close' || text === 'done'
}

const handleCloseClick = (event: MouseEvent) => {
  const target = event.target as Element | null
  const button = target?.closest<HTMLButtonElement>(closeSelector)
  if (!button || !isExplicitCloseButton(button)) return false

  if (button.dataset.rubiesMotionBypass === 'true') {
    delete button.dataset.rubiesMotionBypass
    return false
  }

  const backdrop = dialogBackdropFor(button)
  if (!backdrop) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  runAfterDismiss(backdrop, () => clickWithoutDismiss(button))
  return true
}

const handleBackdropMouseDown = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.classList.contains('dialog-backdrop')) return
  const backdrop = target

  if (backdrop.dataset.rubiesMotionBackdropBypass === 'true') {
    delete backdrop.dataset.rubiesMotionBackdropBypass
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  runAfterDismiss(backdrop, () => {
    backdrop.dataset.rubiesMotionBackdropBypass = 'true'
    backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
  })
}

const handleDialogSubmit = (event: SubmitEvent) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  const backdrop = dialogBackdropFor(form)
  if (!backdrop) return
  const card = dialogCardFor(backdrop)
  if (!card || card.querySelector('.settings-body') || card.matches('.move-money-modal-card') || card.querySelector('.move-flow')) return

  if (form.dataset.rubiesMotionSubmitBypass === 'true') {
    delete form.dataset.rubiesMotionSubmitBypass
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  const submitter = event.submitter

  runAfterDismiss(backdrop, () => {
    form.dataset.rubiesMotionSubmitBypass = 'true'
    if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) form.requestSubmit(submitter)
    else form.requestSubmit()

    window.setTimeout(() => {
      if (!document.contains(backdrop)) return
      resetDismissState(backdrop)
    }, 80)
  })
}

const navButtons = () => [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')]

const navTargetIndex = (button: HTMLButtonElement) => navButtons().indexOf(button)

const activeDialogNavIndex = (card: HTMLElement) => {
  if (card.matches('.transaction-screen-card') || card.querySelector('.kind-toggle')) return 2
  if (card.matches('.settings-screen-card') || card.querySelector('.settings-body')) return 3
  return -1
}

const handleMobileNavigation = (event: MouseEvent) => {
  if (!mobileMotionMedia.matches) return false
  const target = event.target as Element | null
  const button = target?.closest<HTMLButtonElement>('.mobile-nav button')
  if (!button) return false

  if (button.dataset.rubiesMotionNavBypass === 'true') {
    delete button.dataset.rubiesMotionNavBypass
    return false
  }

  const card = document.querySelector<HTMLElement>('.dialog-card')
  const backdrop = card?.closest<HTMLElement>('.dialog-backdrop')
  if (!card || !backdrop) return false

  const targetIndex = navTargetIndex(button)
  const activeIndex = activeDialogNavIndex(card)
  if (activeIndex === targetIndex) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }

  const closeButton = card.querySelector<HTMLButtonElement>('.dialog-header .icon-button')
  if (!closeButton) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  runAfterDismiss(backdrop, () => {
    clickWithoutDismiss(closeButton)
    button.dataset.rubiesMotionNavBypass = 'true'
    button.click()
  })
  return true
}

type SwipeState = {
  pointerId: number
  header: HTMLElement
  card: HTMLElement
  backdrop: HTMLElement
  startY: number
  startX: number
  startedAt: number
  distance: number
}

let swipeState: SwipeState | null = null

const isSwipeDismissibleSheet = (card: HTMLElement) => {
  if (!mobileMotionMedia.matches || reducedMotionMedia.matches) return false
  if (card.matches('.mobile-tab-card, .settings-screen-card, .transaction-screen-card, .move-money-modal-card')) return false
  if (card.querySelector('.settings-body, .kind-toggle, .move-flow')) return false
  return true
}

const handleSheetPointerDown = (event: PointerEvent) => {
  if (event.pointerType === 'mouse' || event.button !== 0) return
  const target = event.target as Element | null
  if (target?.closest('button, input, select, textarea, a')) return
  const header = target?.closest<HTMLElement>('.dialog-card .dialog-header')
  const card = header?.closest<HTMLElement>('.dialog-card')
  const backdrop = card?.closest<HTMLElement>('.dialog-backdrop')
  if (!header || !card || !backdrop || !isSwipeDismissibleSheet(card)) return
  if (backdrop.dataset.rubiesMotionClosing === 'true') return

  swipeState = {
    pointerId: event.pointerId,
    header,
    card,
    backdrop,
    startY: event.clientY,
    startX: event.clientX,
    startedAt: performance.now(),
    distance: 0,
  }
  header.setPointerCapture(event.pointerId)
}

const handleSheetPointerMove = (event: PointerEvent) => {
  const state = swipeState
  if (!state || state.pointerId !== event.pointerId) return
  const deltaY = Math.max(0, event.clientY - state.startY)
  const deltaX = Math.abs(event.clientX - state.startX)
  if (deltaY < 4 || deltaX > deltaY * 1.15) return

  event.preventDefault()
  state.distance = deltaY
  state.card.classList.remove('rubies-sheet-rebounding')
  state.card.classList.add('rubies-sheet-dragging')
  state.card.style.setProperty('--rubies-sheet-drag', `${deltaY}px`)
}

const reboundSheet = (state: SwipeState) => {
  const { card } = state
  card.classList.remove('rubies-sheet-dragging')
  card.classList.add('rubies-sheet-rebounding')
  requestAnimationFrame(() => card.style.setProperty('--rubies-sheet-drag', '0px'))
  window.setTimeout(() => {
    if (!document.contains(card)) return
    card.classList.remove('rubies-sheet-rebounding')
    card.style.removeProperty('--rubies-sheet-drag')
  }, 260)
}

const finishSheetSwipe = (event: PointerEvent, cancelled = false) => {
  const state = swipeState
  if (!state || state.pointerId !== event.pointerId) return
  swipeState = null

  if (state.header.hasPointerCapture(event.pointerId)) state.header.releasePointerCapture(event.pointerId)
  const elapsed = Math.max(1, performance.now() - state.startedAt)
  const velocity = state.distance / elapsed
  const threshold = Math.min(150, Math.max(84, state.card.getBoundingClientRect().height * .13))

  if (!cancelled && (state.distance >= threshold || (state.distance >= 36 && velocity > .58))) {
    const closeButton = state.card.querySelector<HTMLButtonElement>('.dialog-header .icon-button')
    if (closeButton) {
      runAfterDismiss(state.backdrop, () => clickWithoutDismiss(closeButton))
      return
    }
  }
  reboundSheet(state)
}

const handleSheetPointerUp = (event: PointerEvent) => finishSheetSwipe(event)
const handleSheetPointerCancel = (event: PointerEvent) => finishSheetSwipe(event, true)

export const installMotionRuntime = () => {
  document.documentElement.classList.add('rubies-motion-ready')

  document.addEventListener('mousedown', handleBackdropMouseDown, true)
  document.addEventListener('submit', handleDialogSubmit, true)
  document.addEventListener('pointerdown', handleSheetPointerDown, { capture: true, passive: true })
  document.addEventListener('pointermove', handleSheetPointerMove, { capture: true, passive: false })
  document.addEventListener('pointerup', handleSheetPointerUp, true)
  document.addEventListener('pointercancel', handleSheetPointerCancel, true)
  document.addEventListener('click', (event) => {
    if (handleCloseClick(event)) return
    handleMobileNavigation(event)
  }, true)
}
