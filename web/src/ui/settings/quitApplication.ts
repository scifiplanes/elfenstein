/** Best-effort exit: script-opened tabs can close; otherwise navigate to a blank document. */
export function quitApplication() {
  window.close()
  window.setTimeout(() => {
    window.location.replace('about:blank')
  }, 100)
}
