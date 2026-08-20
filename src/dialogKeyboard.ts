const mobileMedia = window.matchMedia('(max-width: 820px)')

const isPrimaryMobileScreen = (card: HTMLElement) => (
  card.matches('.mobile-tab-card, .settings-screen-card, .transaction-screen-card, .transaction-mobile-screen')
  || Boolean(card.querySelector('.settings-body, .kind-toggle'))
)

const topmostClosableDialogButton = () => {
  const backdrops = [...document.querySelectorAll<HTMLElement>('.dialog-backdrop')]

  for (let index = backdrops.length - 1; index >= 0; index -= 1) {
    const backdrop = backdrops[index]
    if (backdrop.dataset.rubiesMotionClosing === 'true' || backdrop.getClientRects().length === 0) continue

    const card = backdrop.querySelector<HTMLElement>(':scope > .dialog-card')
    if (!card) continue
    if (mobileMedia.matches && isPrimaryMobileScreen(card)) continue

    const closeButton = card.querySelector<HTMLButtonElement>('.dialog-header .icon-button')
    if (closeButton && !closeButton.disabled) return closeButton
  }

  return null
}

const handleDialogEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.repeat || event.isComposing || event.defaultPrevented) return

  const closeButton = topmostClosableDialogButton()
  if (!closeButton) return

  event.preventDefault()
  event.stopPropagation()
  closeButton.click()
}

export const installDialogKeyboard = () => {
  /* Bubble phase lets focused controls consume Escape first when appropriate.
     If nothing handled it, the topmost actual dialog closes through its existing
     close button, which keeps mouse and keyboard dismissal on the same motion path. */
  document.addEventListener('keydown', handleDialogEscape)
}
