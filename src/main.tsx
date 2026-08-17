import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './mobile-polish.css'
import './ui-stability.css'
import './mobile-layout-fixes.css'
import './mobile-native.css'
import './mobile-screen-fixes.css'
import './mobile-dialog-contract.css'
import './mobile-consistency.css'
import './motion.css'
import './moveMoneyPolish.css'
import { installUiRuntime } from './uiRuntime'
import { installMobileViewport } from './mobileViewport'
import { installMotionRuntime } from './motionRuntime'
import { installMoveMoneyPolish } from './moveMoneyPolish'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

installMotionRuntime()
installUiRuntime()
installMoveMoneyPolish()
installMobileViewport()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Service worker registration failed', error)
    })
  })
}
