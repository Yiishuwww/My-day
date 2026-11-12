import { chromium } from 'playwright'
import path from 'node:path'

const baseURL = process.env.PWA_URL || 'http://127.0.0.1:4173/'
const parsedURL = new URL(baseURL)
const basePath = parsedURL.pathname.endsWith('/')
  ? parsedURL.pathname
  : `${parsedURL.pathname}/`
const shotsDir = path.resolve('shots')

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
})

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
})

const page = await context.newPage()
page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message))
page.on('console', (message) => {
  if (message.type() === 'error') console.error('CONSOLE ERROR:', message.text())
})

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor({ state: 'visible' })

  const swState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active?.state ?? 'missing'
  })
  if (swState !== 'activated') throw new Error(`Service worker state: ${swState}`)
  console.log('✓ Service worker activated')

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  if (!manifestHref) throw new Error('Manifest link missing')
  const manifestURL = new URL(manifestHref, page.url()).href
  const manifestResponse = await context.request.get(manifestURL)
  if (!manifestResponse.ok()) throw new Error('Manifest fetch failed')
  const manifest = await manifestResponse.json()
  if (manifest.display !== 'standalone') throw new Error('Manifest display wrong')
  if (manifest.start_url !== basePath || manifest.scope !== basePath) {
    throw new Error(
      `Manifest scope wrong: start_url=${manifest.start_url}, scope=${manifest.scope}, expected=${basePath}`,
    )
  }
  if (!manifest.icons || manifest.icons.length < 2) {
    throw new Error('Manifest icons missing')
  }
  console.log(
    `✓ Manifest valid: ${manifest.name} (${manifest.icons.length} icons, scope ${manifest.scope})`,
  )

  for (const src of [
    'pwa-192x192.png',
    'pwa-512x512.png',
    'apple-touch-icon.png',
    'favicon.svg',
  ]) {
    const response = await context.request.get(new URL(src, baseURL).href)
    if (!response.ok()) throw new Error(`Asset failed: ${src}`)
    const type = response.headers()['content-type']
    console.log(`✓ ${src} (${type})`)
  }

  await page.reload({ waitUntil: 'networkidle' })
  const controlled = await page.evaluate(() =>
    Boolean(navigator.serviceWorker.controller),
  )
  if (!controlled) throw new Error('Page is not controlled by the service worker')
  console.log('✓ Page is controlled by the service worker')

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.today-view').waitFor({ state: 'visible', timeout: 10000 })
  await page.screenshot({ path: path.join(shotsDir, '11-offline.png') })
  console.log('✓ App opens offline from the service worker cache')
  await context.setOffline(false)

  console.log('\nAll PWA checks passed.')
} finally {
  await browser.close()
}
