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

  async function longPressDrag(source, target) {
    const from = await source.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error('No bounding box for drag')
    const fromX = from.x + from.width / 2
    const fromY = from.y + from.height / 2
    const toX = to.x + to.width / 2
    const toY = to.y + 2
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(fromX, fromY),
    })
    await page.waitForTimeout(450)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(fromX, fromY - 12),
    })
    await page.waitForTimeout(120)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(toX, toY),
    })
    await page.waitForTimeout(180)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await page.waitForTimeout(700)
  }

  async function swipeTitle(locator, deltaX) {
    const box = await locator.boundingBox()
    if (!box) throw new Error('No bounding box for swipe')
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(startX, startY),
    })
    await page.waitForTimeout(25)
    for (const fraction of [0.35, 0.75, 1]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(startX + deltaX * fraction, startY),
      })
      await page.waitForTimeout(18)
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await page.waitForTimeout(600)
  }

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

  // Right swipe completes a task
  await swipeTitle(
    page
      .locator('.today-view .sortable-task')
      .filter({ hasText: '触摸B' })
      .locator('.task-title'),
    110,
  )
  await page
    .locator('.today-view .done-toggle')
    .filter({ hasText: '已完成 1' })
    .waitFor()
  const openAfterSwipe = await page
    .locator('.today-view .sortable-task .task-title')
    .allInnerTexts()
  if (openAfterSwipe.includes('触摸B')) {
    throw new Error('Right swipe did not complete the task')
  }
  console.log('✓ Right swipe completed a task')

  // Left swipe moves it to trash; undo restores it
  await swipeTitle(
    page
      .locator('.today-view .sortable-task')
      .filter({ hasText: '触摸A' })
      .locator('.task-title'),
    -110,
  )
  await page
    .locator('.toast', { hasText: '已移到最近删除' })
    .waitFor()
  await page.locator('.toast-action', { hasText: '撤销' }).click()
  await page
    .locator('.today-view .sortable-task')
    .filter({ hasText: '触摸A' })
    .waitFor()
  console.log('✓ Left swipe deletes with undo')

  // Inbox pending tasks accept the same long-press reorder
  await page.locator('.tab', { hasText: '收件箱' }).click()
  await page.locator('.inbox-view').waitFor()
  for (const title of ['收件A', '收件B']) {
    await page.locator('.fab').click()
    await page.locator('.title-input').fill(title)
    await page.locator('.sheet .primary-btn').click()
    await page.locator('.sheet').waitFor({ state: 'hidden' })
    await page
      .locator('.inbox-view .sortable-task .task-title', { hasText: title })
      .waitFor()
  }
  await longPressDrag(
    page
      .locator('.inbox-view .sortable-task')
      .filter({ hasText: '收件B' })
      .locator('.task-title'),
    page
      .locator('.inbox-view .sortable-task')
      .filter({ hasText: '收件A' })
      .locator('.task-title'),
  )
  const inboxTitles = await page
    .locator('.inbox-view .sortable-task .task-title')
    .allInnerTexts()
  const inboxA = inboxTitles.indexOf('收件A')
  const inboxB = inboxTitles.indexOf('收件B')
  if (!(inboxA >= 0 && inboxB >= 0 && inboxB < inboxA)) {
    throw new Error(`Inbox drag did not reorder: ${inboxTitles.join(', ')}`)
  }
  console.log('✓ Inbox long-press drag reorders tasks:', inboxTitles.join(', '))
} finally {
  await browser.close()
}
