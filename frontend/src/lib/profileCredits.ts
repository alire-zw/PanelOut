export const PROFILE_CREDITS_EVENT = 'panelout:profile-credits'

let creditsShown = false

export function readProfileCreditsShown(): boolean {
  return creditsShown
}

export function writeProfileCreditsShown(shown: boolean) {
  creditsShown = shown
  window.dispatchEvent(new Event(PROFILE_CREDITS_EVENT))
}
