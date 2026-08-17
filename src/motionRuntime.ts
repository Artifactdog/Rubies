const mobileMotionMedia = window.matchMedia('(max-width: 820px)')
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')

const closeSelector = '.dialog-header .icon-button, .dialog-actions .secondary-button'
const closingQueues = new WeakMap<HTMLElement, Array<() => void>>()

const dialogBackdropFor = (element: Element | null) => element?.closest<HTMLElement>('.dialog-backdrop') ?? null

const dialogCardFor = (backdrop: HTMLElement) => backdrop.querySelector<HTMLElement>(':scope > .dialog-card')

const isPrimaryMobileScreen = (card: HTMLElement) => (
  card.matches('.mobile-tab-card, .settings-screen-card, .transaction-screen-card, .transaction-mobile-screen')
  || Boolean(card.querySelector('.settings-body, .kind-toggle'))
)

const clearDragState = (card: HTMLElement | null) => {
  if (!card) return
  card.classList.remove('rubies-sheet-dragging', 'rubies-sheet-rebounding')
}

const resetDismissState = (backdrop: HTMLElement) => {
  closingQueues.delete(backdrop)
  backdrop.classList.remove('rubies-motion-dismissing')
  delete backdrop.dataset.rubiesMotionClosing
  backdrop.getAnimations().forEach((animation) => animation.cancel())
  backdrop.style.removeProperty('opacity')

  const card = dialogCardFor(backdrop)
  card?.getAnimations().forEach((animation) => animation.cancel())
  clearDragState(card)
  card?.style.removeProperty('--rubies-sheet-drag')
  card?.style.removeProperty('transform')
  card?.style.removeProperty('opacity')
}

const finished = (animation: Animation) => animation.finished.catch(() => undefined)

const playDismissAnimation = async (backdrop: HTMLElement) => {
  if (reducedMotionMedia.matches) return
  const card = dialogCardFor(backdrop)
  if (!card) return

  const mobile = mobileMotionMedia.matches
  if (mobile && isPrimaryMobileScreen(card)) return

  /* Read the visual state before clearing drag classes. Otherwise a swiped sheet
     briefly snaps back to its fully-open transform before its exit begins. */
  const cardStyle = getComputedStyle(card)
  const backdropStyle = getComputedStyle(backdrop)
  const currentTransform = cardStyle.transform === 'none' ? 'translate3d(0, 0, 0) scale(1)' : cardStyle.transform
  const currentOpacity = Number.parseFloat(cardStyle.opacity) || 1
  const currentBackdropOpacity = Number.parseFloat(backdropStyle.opacity) || 1
  const mobileExitY = Math.ceil(card.getBoundingClientRect().height * 1.08)

  card.getAnimations().forEach((animation) => animation.cancel())
  backdrop.getAnimations().forEach((animation) => animation.cancel())
  clearDragState(card)
  card.style.removeProperty('--rubies-sheet-drag')

  const cardAnimation = card.animate(
    mobile
      ? [
          /* There is deliberately no intermediate waypoint here. A committed
             swipe must continue from the exact finger position straight down;
             any fixed percentage waypoint can make an already-dragged sheet
             jump upward before it leaves the viewport. */
          { transform: currentTransform, opacity: currentOpacity },
          { transform: `translate3d(0, ${mobileExitY}px, 0) scale(.985)`, opacity: .92 },
        ]
      : [
          { transform: currentTransform, opacity: currentOpacity, offset: 0 },
          { transform: 'translate3d(0, 3px, 0) scale(.995)', opacity: .98, offset: .18 },
          { transform: 'translate3d(0, 30px, 0) scale(.925)', opacity: 0, offset: 1 },
        ],
    {
      duration: mobile ? 410 : 320,
      easing: mobile ? 'cubic-bezier(.32, 0, .67, 0)' : 'cubic-bezier(.4, 0, .2, 1)',
      fill: 'forwards',
    },
  )

  const backdropAnimation = backdrop.animate(
    [
      { opacity: currentBackdropOpacity },
      { opacity: 0 },
    ],
    {
      duration: mobile ? 360 : 280,
      easing: 'cubic-bezier(.4, 0, 1, 1)',
      fill: 'forwards',
    },
  )

  await Promise.all([finished(cardAnimation), finished(backdropAnimation)])
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
  backdrop.classList.add('rubies-motion-dismissing')

  void playDismissAnimation(backdrop).then(() => {
    const actions = closingQueues.get(backdrop) ?? []
    closingQueues.delete(backdrop)
    actions.forEach((queuedAction) => queuedAction())
  })
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
  const card = dialogCardFor(backdrop)
  if (mobileMotionMedia.matches && card && isPrimaryMobileScreen(card)) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  runAfterDismiss(backdrop, () => clickWithoutDismiss(button))
  return true
}

const handleBackdropMouseDown = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.classList.contains('dialog-backdrop')) return
  const backdrop = target
  const card = dialogCardFor(backdrop)
  if (mobileMotionMedia.matches && card && isPrimaryMobileScreen(card)) return

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
  if (!(form instanceof HTMLFormElement) || !form.checkValidity()) return
  const backdrop = dialogBackdropFor(form)
  if (!backdrop) return
  const card = dialogCardFor(backdrop)
  if (!card || card.querySelector('.settings-body') || card.matches('.move-money-modal-card') || card.querySelector('.move-flow')) return
  if (mobileMotionMedia.matches && isPrimaryMobileScreen(card)) return

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

const handleGroupToggle = (event: MouseEvent) => {
  const target = event.target as Element | null
  const button = target?.closest<HTMLButtonElement>('.group-name')
  if (!button) return false

  if (button.dataset.rubiesMotionGroupBypass === 'true') {
    delete button.dataset.rubiesMotionGroupBypass
    return false
  }

  const group = button.closest<HTMLElement>('.category-group')
  const body = group?.querySelector<HTMLElement>('.group-categories')
  if (!group) return false

  if (!body) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const expandedBody = group.querySelector<HTMLElement>('.group-categories')
        if (!expandedBody) return
        expandedBody.classList.add('rubies-group-expanding')
        expandedBody.addEventListener('animationend', () => expandedBody.classList.remove('rubies-group-expanding'), { once: true })
      })
    })
    return false
  }

  if (reducedMotionMedia.matches) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  body.classList.add('rubies-group-collapsing')
  window.setTimeout(() => {
    button.dataset.rubiesMotionGroupBypass = 'true'
    button.click()
  }, 220)
  return true
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

  /* New and Settings are peer navigation screens. The existing nav runtime owns
     switching them immediately; modal exit choreography must not intercept it. */
  if (isPrimaryMobileScreen(card)) return false

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
  if (!mobileMotionMedia.matches || reducedMotionMedia.matches || isPrimaryMobileScreen(card)) return false
  return Boolean(card.querySelector('.dialog-header .icon-button'))
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

  /* A sheet can be grabbed as soon as it is visible. Finish any entrance
     animation first so pointer movement cannot fight a still-running transform. */
  card.getAnimations().forEach((animation) => {
    try {
      animation.finish()
    } catch {
      animation.cancel()
    }
  })

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
  card.style.setProperty('--rubies-sheet-drag', '0px')
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
  }, 440)
}

const finishSheetSwipe = (event: PointerEvent, cancelled = false) => {
  const state = swipeState
  if (!state || state.pointerId !== event.pointerId) return
  swipeState = null

  if (state.header.hasPointerCapture(event.pointerId)) state.header.releasePointerCapture(event.pointerId)
  const elapsed = Math.max(1, performance.now() - state.startedAt)
  const velocity = state.distance / elapsed
  const threshold = Math.min(170, Math.max(92, state.card.getBoundingClientRect().height * .14))

  if (!cancelled && (state.distance >= threshold || (state.distance >= 42 && velocity > .5))) {
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
    if (handleGroupToggle(event)) return
    handleMobileNavigation(event)
  }, true)
}
