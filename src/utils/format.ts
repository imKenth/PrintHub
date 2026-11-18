import type { PrintService } from '../types'

export function quantityUnit(service: PrintService, quantity: number) {
  return service === 'Documents' ? (quantity === 1 ? 'page' : 'pages') : (quantity === 1 ? 'copy' : 'copies')
}

export function smoothScrollTo(destination: number) {
  const start = window.scrollY
  const distance = destination - start
  const duration = 1200
  if (Math.abs(distance) < 2) return

  const startedAt = performance.now()
  const animateScroll = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1)
    const easedProgress = progress < 0.5
      ? 4 * progress ** 3
      : 1 - ((-2 * progress + 2) ** 3) / 2
    window.scrollTo(0, start + distance * easedProgress)
    if (progress < 1) window.requestAnimationFrame(animateScroll)
  }
  window.requestAnimationFrame(animateScroll)
}
