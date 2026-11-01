export const ONBOARDING_KEY = 'mahjong-buddy:a2hs-onboarding-seen:v1'
export type InstallPlatform = 'ios' | 'android'
export function installPlatform(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>, standalone: boolean): InstallPlatform | null {
  if (standalone) return null
  const ua = nav.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)
  if (ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return 'ios'
  return /Android/.test(ua) && /Chrome\//.test(ua) && !/; wv\)|EdgA|OPR\//.test(ua) ? 'android' : null
}
export function eligiblePlatform(): InstallPlatform | null {
  try {
    if (localStorage.getItem(ONBOARDING_KEY)) return null
    localStorage.setItem(ONBOARDING_KEY + ':probe', '1'); localStorage.removeItem(ONBOARDING_KEY + ':probe')
    return installPlatform(navigator, window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  } catch { return null } // No durable seen flag: skip rather than repeat a blocking popup.
}
