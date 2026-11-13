import { chromium } from 'playwright'
import path from 'node:path'

const baseURL = process.env.PWA_URL || 'http://127.0.0.1:5173/'
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
  colorScheme: 'dark',
})
const page = await context.newPage()

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor()

  await page.locator('.fab').click()
  await page.locator('.title-input').fill('深色测试任务')
  await page.locator('.notes-input').fill('深色模式下的备注预览。')
  await page.locator('.time-input').fill('10:00')
  await page.locator('.duration-custom input').fill('45')
  const subAdd = page.locator('.subtask-add input')
  await subAdd.fill('一个子任务')
  await subAdd.press('Enter')
  await subAdd.fill('另一个子任务')
  await subAdd.press('Enter')
  await page.locator('.tag-input').fill('工作')
  await page.locator('.tag-input').press('Enter')
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  await page
    .locator('.today-view .task-card')
    .filter({ hasText: '深色测试任务' })
    .waitFor()
  await page.screenshot({
    path: path.join(shotsDir, 'dark-today.png'),
    animations: 'disabled',
  })

  await page
    .locator('.today-view .tag-pill')
    .filter({ hasText: '工作' })
    .click()
  await page.locator('.tags-view').waitFor()
  await page.screenshot({
    path: path.join(shotsDir, 'dark-tags.png'),
    animations: 'disabled',
  })
  await page.locator('.back-btn').click()
  await page.locator('.back-btn').click()

  await page.locator('.tab', { hasText: '日历' }).click()
  await page.locator('.cal-expand').click()
  await page.locator('.month-grid').waitFor()
  await page.screenshot({
    path: path.join(shotsDir, 'dark-calendar.png'),
    animations: 'disabled',
  })

  await page.locator('.tab', { hasText: '专注' }).click()
  await page.locator('.focus-view').waitFor()
  await page.screenshot({
    path: path.join(shotsDir, 'dark-focus.png'),
    animations: 'disabled',
  })

  console.log('✓ Dark mode screenshots captured')
} finally {
  await browser.close()
}
