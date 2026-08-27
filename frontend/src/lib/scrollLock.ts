let lockCount = 0
let previousOverflow = ''

export function lockAppScroll() {
  if (typeof document === 'undefined') return

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('app-scroll-locked')
  }

  lockCount += 1
}

export function unlockAppScroll() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) return

  lockCount -= 1
  if (lockCount > 0) return

  document.body.style.overflow = previousOverflow
  document.documentElement.classList.remove('app-scroll-locked')
}
