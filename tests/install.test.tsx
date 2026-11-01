import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { InstallOnboarding } from '../src/features/install/InstallOnboarding'
import { eligiblePlatform, installPlatform, ONBOARDING_KEY } from '../src/features/install/platform'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const android = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
function mobile(ua = iphone, standalone = false) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  vi.stubGlobal('matchMedia', () => ({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}
beforeEach(() => localStorage.clear())
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('once-only image installation tutorial', () => {
  it.each([[iphone, 4, 'Safari 實際截圖'], [android, 3, 'Android 安裝示意']] as const)('uses the correct image progression for %s', (ua, count, label) => {
    mobile(ua); const view = render(<InstallOnboarding ready blocked={false} />)
    expect(screen.getByRole('dialog', { name: '將麻雀小夥伴加入主畫面' })).toBeTruthy()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['知道了'])
    expect(screen.getAllByAltText(new RegExp(label))).toHaveLength(count)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: '知道了' })); expect(screen.queryByRole('dialog')).toBeNull()
    view.unmount(); render(<InstallOnboarding ready blocked={false} />); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('records presentation independently of acknowledgment, including refresh or Escape', () => {
    mobile(); const view = render(<InstallOnboarding ready blocked={false} />)
    const cancel = new Event('cancel', { cancelable: true }); fireEvent(screen.getByRole('dialog'), cancel)
    expect(screen.queryByRole('dialog')).toBeNull(); view.unmount()
    render(<InstallOnboarding ready blocked={false} />); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('waits for critical dialogs and storage loading before recording a visit', () => {
    mobile(); const view = render(<InstallOnboarding ready={false} blocked />)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull()
    view.rerender(<InstallOnboarding ready blocked />); expect(screen.queryByRole('dialog')).toBeNull()
    view.rerender(<InstallOnboarding ready blocked={false} />); expect(screen.getByRole('dialog')).toBeTruthy()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
  })
  it('does not repeat on theme or ordinary route rerenders', () => {
    mobile(); const view = render(<InstallOnboarding ready blocked={false} />)
    fireEvent.click(screen.getByRole('button', { name: '知道了' }))
    view.rerender(<InstallOnboarding ready blocked />); view.rerender(<InstallOnboarding ready blocked={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('skips installed, desktop and in-app Android webviews, while detecting modern iPadOS', () => {
    expect(installPlatform({ userAgent: iphone, maxTouchPoints: 5 }, true)).toBeNull()
    expect(installPlatform({ userAgent: 'Macintosh Chrome/130 Safari', maxTouchPoints: 0 }, false)).toBeNull()
    expect(installPlatform({ userAgent: 'Macintosh Version/18 Safari', maxTouchPoints: 5 }, false)).toBe('ios')
    expect(installPlatform({ userAgent: android.replace('Android 14)', 'Android 14; wv)'), maxTouchPoints: 5 }, false)).toBeNull()
    mobile(iphone, true); expect(eligiblePlatform()).toBeNull()
    mobile(); Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    expect(eligiblePlatform()).toBeNull(); Reflect.deleteProperty(navigator, 'standalone')
  })
  it.each(['getItem', 'setItem'] as const)('skips safely when localStorage.%s throws', (method) => {
    mobile(); vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('unavailable') })
    expect(eligiblePlatform()).toBeNull()
    render(<InstallOnboarding ready blocked={false} />); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('ships local original-size iOS PNGs, faithful Android diagrams and original manifest icons', () => {
    for (let index = 1; index <= 4; index++) {
      const image = readFileSync('public/install/ios' + index + '.png')
      expect(image.readUInt32BE(16)).toBe(941); expect(image.readUInt32BE(20)).toBe(1672)
    }
    for (let index = 1; index <= 3; index++) {
      const svg = readFileSync('public/install/android' + index + '.svg', 'utf8')
      expect(svg).toContain('app.mahjong-buddy.workers.dev'); expect(svg).toContain('非實機截圖')
      expect(svg).not.toMatch(/mahjongbuddy\.com|登入|對戰|房間/)
      expect(svg).toContain('麻雀小夥伴・一索小鳥')
    }
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
    expect(manifest.display).toBe('standalone'); expect(manifest.start_url).toBe('/')
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512'])
  })
})
