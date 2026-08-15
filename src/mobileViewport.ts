const mobileMedia = window.matchMedia('(max-width: 820px)')

let viewportFrame = 0
let followUpTimer = 0

const isEditingControl = () => {
  const active = document.activeElement as HTMLElement | null
  return Boolean(active?.matches('input, textarea, select, [contenteditable="true"]'))
}

const syncMobileViewport = () => {
  viewportFrame = 0
  const root = document.documentElement

  if (!mobileMedia.matches) {
    root.classList.remove('rubies-keyboard-open')
    root.style.removeProperty('--rubies-visual-height')
    root.style.removeProperty('--rubies-visual-top')
    root.style.removeProperty('--rubies-active-nav-height')
    return
  }

  const viewport = window.visualViewport
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight))
  const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0))
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight)
  const keyboardInset = Math.max(0, layoutHeight - height - top)
  const screenHeight = Math.max(1, window.screen.height)
  const keyboardOpen = isEditingControl() && (keyboardInset > 80 || height < screenHeight * 0.78)
  const nav = document.querySelector<HTMLElement>('.mobile-nav')
  const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0

  root.style.setProperty('--rubies-visual-height', `${height}px`)
  root.style.setProperty('--rubies-visual-top', `${top}px`)
  root.style.setProperty('--rubies-active-nav-height', keyboardOpen ? '0px' : `${navHeight}px`)
  root.classList.toggle('rubies-keyboard-open', keyboardOpen)
}

const scheduleViewportSync = () => {
  if (viewportFrame) return
  viewportFrame = window.requestAnimationFrame(syncMobileViewport)
}

const scheduleKeyboardFollowUp = () => {
  scheduleViewportSync()
  window.clearTimeout(followUpTimer)
  followUpTimer = window.setTimeout(scheduleViewportSync, 280)
}

export const installMobileViewport = () => {
  syncMobileViewport()

  window.visualViewport?.addEventListener('resize', scheduleViewportSync, { passive: true })
  window.visualViewport?.addEventListener('scroll', scheduleViewportSync, { passive: true })
  window.addEventListener('resize', scheduleViewportSync, { passive: true })
  window.addEventListener('orientationchange', scheduleKeyboardFollowUp, { passive: true })
  document.addEventListener('focusin', scheduleKeyboardFollowUp, true)
  document.addEventListener('focusout', scheduleKeyboardFollowUp, true)
  mobileMedia.addEventListener('change', scheduleViewportSync)
}
