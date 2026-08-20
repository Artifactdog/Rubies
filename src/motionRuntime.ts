const mobileMotionMedia = window.matchMedia('(max-width: 820px)')
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')

const closeSelector = '.dialog-header .icon-button, .dialog-actions .secondary-button'
const closingQueues = new WeakMap<HTMLElement, Array<() => void>>()
const sheetPositions = new WeakMap<HTMLElement, number>()
const sheetPhysicsFrames = new WeakMap<HTMLElement, number>()
const dismissVelocities = new WeakMap<HTMLElement, number>()

const dialogBackdropFor = (element: Element | null) => element?.closest<HTMLElement>('.dialog-backdrop') ?? null
const dialogCardFor = (backdrop: HTMLElement) => backdrop.querySelector<HTMLElement>(':scope > .dialog-card')

const isPrimaryMobileScreen = (card: HTMLElement) => (
  card.matches('.mobile-tab-card, .settings-screen-card, .transaction-screen-card, .transaction-mobile-screen')
  || Boolean(card.querySelector('.settings-body, .kind-toggle'))
)

const cancelSheetPhysics = (card: HTMLElement | null) => {
  if (!card) return
  const frame = sheetPhysicsFrames.get(card)
  if (frame !== undefined) cancelAnimationFrame(frame)
  sheetPhysicsFrames.delete(card)
}

const clearDragState = (card: HTMLElement | null) => {
  if (!card) return
  cancelSheetPhysics(card)
  card.classList.remove('rubies-sheet-dragging', 'rubies-sheet-rebounding')
}

const setSheetPosition = (card: HTMLElement, backdrop: HTMLElement, position: number) => {
  sheetPositions.set(card, position)
  card.classList.add('rubies-sheet-dragging')
  card.style.setProperty('--rubies-sheet-drag', `${position}px`)

  const height = Math.max(1, card.getBoundingClientRect().height)
  const progress = Math.max(0, Math.min(1, position / height))
  backdrop.style.opacity = String(1 - progress * .42)
}

const clearSheetPosition = (card: HTMLElement, backdrop: HTMLElement) => {
  sheetPositions.delete(card)
  card.classList.remove('rubies-sheet-dragging', 'rubies-sheet-rebounding')
  card.style.removeProperty('--rubies-sheet-drag')
  backdrop.style.removeProperty('opacity')
}

const resetDismissState = (backdrop: HTMLElement) => {
  closingQueues.delete(backdrop)
  dismissVelocities.delete(backdrop)
  backdrop.classList.remove('rubies-motion-dismissing')
  delete backdrop.dataset.rubiesMotionClosing
  backdrop.getAnimations().forEach((animation) => animation.cancel())
  backdrop.style.removeProperty('opacity')

  const card = dialogCardFor(backdrop)
  card?.getAnimations().forEach((animation) => animation.cancel())
  clearDragState(card)
  if (card) sheetPositions.delete(card)
  card?.style.removeProperty('--rubies-sheet-drag')
  card?.style.removeProperty('transform')
  card?.style.removeProperty('opacity')
}

const finished = (animation: Animation) => animation.finished.catch(() => undefined)

const runDismissPhysics = (card: HTMLElement, backdrop: HTMLElement, releaseVelocity: number) => new Promise<void>((resolve) => {
  cancelSheetPhysics(card)

  let position = sheetPositions.get(card) ?? 0
  let velocity = Math.max(0, releaseVelocity) * 1000
  const target = Math.ceil(card.getBoundingClientRect().height * 1.08) + 24
  const startedAt = performance.now()
  let previousTime = startedAt

  /* A tap-to-close gets a gentle initial push. A swipe keeps its measured
     release velocity unchanged, so a fast flick stays fast after the finger
     leaves the glass instead of snapping to a canned duration. */
  if (velocity < 120) velocity = 420

  card.classList.remove('rubies-sheet-rebounding')
  setSheetPosition(card, backdrop, position)

  const step = (now: number) => {
    if (!document.contains(card)) {
      sheetPhysicsFrames.delete(card)
      resolve()
      return
    }

    const dt = Math.min(0.032, Math.max(0.001, (now - previousTime) / 1000))
    previousTime = now

    const remaining = Math.max(0, target - position)
    const acceleration = 5200 + remaining * 3.2 - velocity * 1.6
    velocity = Math.max(80, velocity + acceleration * dt)
    position += velocity * dt

    setSheetPosition(card, backdrop, position)
    const progress = Math.max(0, Math.min(1, position / target))
    card.style.opacity = String(1 - progress * .06)

    if (position >= target || now - startedAt > 900) {
      setSheetPosition(card, backdrop, target)
      backdrop.style.opacity = '0'
      card.style.opacity = '.94'
      sheetPhysicsFrames.delete(card)
      resolve()
      return
    }

    const frame = requestAnimationFrame(step)
    sheetPhysicsFrames.set(card, frame)
  }

  const frame = requestAnimationFrame(step)
  sheetPhysicsFrames.set(card, frame)
})

const runReboundPhysics = (card: HTMLElement, backdrop: HTMLElement, releaseVelocity: number) => {
  cancelSheetPhysics(card)

  let position = sheetPositions.get(card) ?? 0
  let velocity = Math.max(-2600, Math.min(900, releaseVelocity * 1000))
  const stiffness = 260
  const damping = 32
  const startedAt = performance.now()
  let previousTime = startedAt

  card.classList.add('rubies-sheet-dragging', 'rubies-sheet-rebounding')

  const settleOpen = () => {
    setSheetPosition(card, backdrop, 0)
    clearSheetPosition(card, backdrop)
    sheetPhysicsFrames.delete(card)
  }

  const step = (now: number) => {
    if (!document.contains(card)) {
      sheetPhysicsFrames.delete(card)
      return
    }

    const dt = Math.min(0.032, Math.max(0.001, (now - previousTime) / 1000))
    previousTime = now

    const acceleration = -stiffness * position - damping * velocity
    velocity += acceleration * dt
    position += velocity * dt

    /* The fully-open position is a hard physical stop. Allowing the spring to
       overshoot above zero makes an upward reversal look like a visual jitter. */
    if (position <= 0) {
      settleOpen()
      return
    }

    setSheetPosition(card, backdrop, position)

    if ((position < .35 && Math.abs(velocity) < 12) || now - startedAt > 900) {
      settleOpen()
      return
    }

    const frame = requestAnimationFrame(step)
    sheetPhysicsFrames.set(card, frame)
  }

  const frame = requestAnimationFrame(step)
  sheetPhysicsFrames.set(card, frame)
}

const playDismissAnimation = async (backdrop: HTMLElement) => {
  if (reducedMotionMedia.matches) return
  const card = dialogCardFor(backdrop)
  if (!card) return

  const mobile = mobileMotionMedia.matches
  if (mobile && isPrimaryMobileScreen(card)) return

  card.getAnimations().forEach((animation) => animation.cancel())
  backdrop.getAnimations().forEach((animation) => animation.cancel())

  if (mobile) {
    const releaseVelocity = dismissVelocities.get(backdrop) ?? 0
    dismissVelocities.delete(backdrop)
    await runDismissPhysics(card, backdrop, releaseVelocity)
    return
  }

  const cardStyle = getComputedStyle(card)
  const backdropStyle = getComputedStyle(backdrop)
  const currentTransform = cardStyle.transform === 'none' ? 'translate3d(0, 0, 0) scale(1)' : cardStyle.transform
  const currentOpacity = Number.parseFloat(cardStyle.opacity) || 1
  const currentBackdropOpacity = Number.parseFloat(backdropStyle.opacity) || 1

  clearDragState(card)
  sheetPositions.delete(card)
  card.style.removeProperty('--rubies-sheet-drag')

  /* Desktop dismissal mirrors the restrained opening language: a single
     monotonic transform and opacity path. No intermediate dip or deep shrink,
     so the card never changes direction or looks like it catches on a frame. */
  const cardAnimation = card.animate(
    [
      { transform: currentTransform, opacity: currentOpacity },
      { transform: 'translate3d(0, 14px, 0) scale(.982)', opacity: 0 },
    ],
    {
      duration: 220,
      easing: 'cubic-bezier(.4, 0, .6, 1)',
      fill: 'forwards',
    },
  )

  const backdropAnimation = backdrop.animate(
    [
      { opacity: currentBackdropOpacity },
      { opacity: 0 },
    ],
    {
      duration: 180,
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

type VelocitySample = { y: number; time: number }

type SwipeState = {
  pointerId: number
  header: HTMLElement
  card: HTMLElement
  backdrop: HTMLElement
  startY: number
  startX: number
  startOffset: number
  distance: number
  samples: VelocitySample[]
}

let swipeState: SwipeState | null = null

const isSwipeDismissibleSheet = (card: HTMLElement) => {
  if (!mobileMotionMedia.matches || reducedMotionMedia.matches || isPrimaryMobileScreen(card)) return false
  return Boolean(card.querySelector('.dialog-header .icon-button'))
}

const addVelocitySample = (state: SwipeState, y: number, time: number) => {
  state.samples.push({ y, time })
  const cutoff = time - 110
  while (state.samples.length > 3 && state.samples[0].time < cutoff) state.samples.shift()
  while (state.samples.length > 9) state.samples.shift()
}

const releaseVelocityFor = (state: SwipeState, releaseTime: number) => {
  if (state.samples.length < 2) return 0

  let velocity = 0
  let seeded = false
  for (let index = 1; index < state.samples.length; index += 1) {
    const previous = state.samples[index - 1]
    const current = state.samples[index]
    const elapsed = current.time - previous.time
    if (elapsed < 3) continue

    const segmentVelocity = Math.max(-4.5, Math.min(4.5, (current.y - previous.y) / elapsed))
    velocity = seeded ? velocity * .25 + segmentVelocity * .75 : segmentVelocity
    seeded = true
  }

  if (!seeded) return 0
  const lastSample = state.samples[state.samples.length - 1]
  const age = Math.max(0, releaseTime - lastSample.time)
  const freshness = Math.max(0, 1 - age / 90)
  return velocity * freshness
}

const recentVerticalIntentFor = (state: SwipeState) => {
  if (state.samples.length < 2) return 0
  const lastIndex = state.samples.length - 1
  const startIndex = Math.max(0, lastIndex - 2)
  return state.samples[lastIndex].y - state.samples[startIndex].y
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

  cancelSheetPhysics(card)

  card.getAnimations().forEach((animation) => {
    try {
      animation.finish()
    } catch {
      animation.cancel()
    }
  })
  backdrop.getAnimations().forEach((animation) => {
    try {
      animation.finish()
    } catch {
      animation.cancel()
    }
  })

  const now = performance.now()
  const startOffset = Math.max(0, sheetPositions.get(card) ?? 0)
  swipeState = {
    pointerId: event.pointerId,
    header,
    card,
    backdrop,
    startY: event.clientY,
    startX: event.clientX,
    startOffset,
    distance: startOffset,
    samples: [{ y: event.clientY, time: now }],
  }
  card.classList.remove('rubies-sheet-rebounding')
  setSheetPosition(card, backdrop, startOffset)
  header.setPointerCapture(event.pointerId)
}

const handleSheetPointerMove = (event: PointerEvent) => {
  const state = swipeState
  if (!state || state.pointerId !== event.pointerId) return

  const rawDeltaY = event.clientY - state.startY
  const distance = Math.max(0, state.startOffset + rawDeltaY)
  const deltaX = Math.abs(event.clientX - state.startX)
  const verticalTravel = Math.abs(rawDeltaY)
  if (verticalTravel < 4 || deltaX > verticalTravel * 1.15) return

  event.preventDefault()
  state.distance = distance
  addVelocitySample(state, event.clientY, performance.now())
  cardDirectionOwnsGesture(state.card)
  setSheetPosition(state.card, state.backdrop, distance)
}

const cardDirectionOwnsGesture = (card: HTMLElement) => {
  card.classList.remove('rubies-sheet-rebounding')
}

const finishSheetSwipe = (event: PointerEvent, cancelled = false) => {
  const state = swipeState
  if (!state || state.pointerId !== event.pointerId) return
  swipeState = null

  if (state.header.hasPointerCapture(event.pointerId)) state.header.releasePointerCapture(event.pointerId)

  const releaseTime = performance.now()
  const velocity = releaseVelocityFor(state, releaseTime)
  const recentIntent = recentVerticalIntentFor(state)
  const threshold = Math.min(170, Math.max(92, state.card.getBoundingClientRect().height * .14))
  const projectedDistance = Math.max(0, state.distance + velocity * 220)
  const upwardIntent = recentIntent < -2 || velocity < -.08
  const downwardFlick = velocity > .38
  const shouldDismiss = !cancelled && !upwardIntent && (
    (downwardFlick && state.distance >= 18 && projectedDistance >= threshold * .82)
    || (state.distance >= threshold && projectedDistance >= threshold)
  )

  if (shouldDismiss) {
    const closeButton = state.card.querySelector<HTMLButtonElement>('.dialog-header .icon-button')
    if (closeButton) {
      dismissVelocities.set(state.backdrop, Math.max(0, velocity))
      runAfterDismiss(state.backdrop, () => clickWithoutDismiss(closeButton))
      return
    }
  }

  const reboundVelocity = cancelled ? 0 : upwardIntent ? Math.min(0, velocity) : velocity
  runReboundPhysics(state.card, state.backdrop, reboundVelocity)
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
