import { chromium } from 'playwright'

const baseURL = process.env.PWA_URL || 'http://127.0.0.1:5173/'

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
})

const page = await context.newPage()
page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message))

async function addTask(title) {
  await page.locator('.fab').click()
  await page.locator('.title-input').fill(title)
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  await page.locator('.today-view .task-title', { hasText: title }).first().waitFor()
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor()
  await addTask('触摸A')
  await addTask('触摸B')
  await page.waitForTimeout(250)

  const sourceTitle = page
    .locator('.today-view .sortable-task')
    .filter({ hasText: '触摸B' })
    .locator('.task-title')
  const targetTitle = page
    .locator('.today-view .sortable-task')
    .filter({ hasText: '触摸A' })
    .locator('.task-title')
  await sourceTitle.scrollIntoViewIfNeeded()
  const sourceBox = await sourceTitle.boundingBox()
  const targetBox = await targetTitle.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('No bounding box')

  const client = await context.newCDPSession(page)
  const point = (x, y) => [
    {
      x,
      y,
      id: 1,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    },
  ]
  const x = sourceBox.x + sourceBox.width / 2
  const y = sourceBox.y + sourceBox.height / 2
  const targetX = targetBox.x + targetBox.width / 2
  const targetY = targetBox.y + 2

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(x, y),
  })
  await page.waitForTimeout(450)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: point(x, y - 12),
  })
  await page.waitForTimeout(120)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: point(targetX, targetY),
  })
  await page.waitForTimeout(180)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await page.waitForTimeout(700)

  const titles = await page
    .locator('.today-view .sortable-task .task-title')
    .allInnerTexts()
  const aIndex = titles.indexOf('触摸A')
  const bIndex = titles.indexOf('触摸B')
  if (!(bIndex >= 0 && aIndex >= 0 && bIndex < aIndex)) {
    throw new Error(`Touch drag did not reorder: ${titles.join(', ')}`)
  }
  console.log('✓ Touch long-press drag reordered tasks:', titles.join(', '))
} finally {
  await browser.close()
}
