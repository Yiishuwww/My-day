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
  colorScheme: 'light',
})

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'canShare', {
    value: () => false,
    configurable: true,
  })
})

const page = await context.newPage()
page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message))
page.on('console', (message) => {
  if (message.type() === 'error') console.error('CONSOLE ERROR:', message.text())
})

const log = (message) => console.log(`✓ ${message}`)
const fail = (message) => {
  throw new Error(message)
}
const shot = async (name) => {
  await page.screenshot({
    path: path.join(shotsDir, `${name}.png`),
    animations: 'disabled',
  })
}

async function saveSheet() {
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
}

async function addTodayTask(title, options = {}) {
  await page.locator('.tab', { hasText: '今日' }).click()
  await page.locator('.fab').click()
  await page.locator('.sheet').waitFor({ state: 'visible' })
  await page.locator('.title-input').fill(title)
  if (options.notes) await page.locator('.notes-input').fill(options.notes)
  if (options.highPriority) {
    await page.locator('.sheet .seg-option').filter({ hasText: '高' }).click()
  }
  if (options.tags) {
    const tagInput = page.locator('.tag-input')
    for (const tag of options.tags) {
      await tagInput.fill(tag)
      await tagInput.press('Enter')
    }
  }
  if (options.date) {
    await page.locator('.date-chip input').fill(options.date)
  }
  await saveSheet()
  await page
    .locator('.today-view .task-title', { hasText: title })
    .first()
    .waitFor()
}

async function openSearch() {
  await page.locator('.search-toggle').click()
  await page.locator('.search-view').waitFor()
}

async function closeSearch() {
  await page.locator('.search-view .tags-head .back-btn').click()
  await page.locator('.today-view').waitFor()
}

async function searchTitles() {
  return page.locator('.search-result-title').allInnerTexts()
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor()
  const dates = await page.evaluate(() => {
    const fmt = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    return { today: fmt(now), yesterday: fmt(yesterday) }
  })

  // Seed tasks
  await addTodayTask('搜索苹果', {
    notes: '备注里也有香蕉',
    highPriority: true,
    tags: ['工作'],
  })
  await addTodayTask('搜索香蕉', { tags: ['生活'] })
  await addTodayTask('已完成任务')
  await page
    .locator('.today-view .task-card')
    .filter({ hasText: '已完成任务' })
    .locator('.task-check')
    .click()
  await page.locator('.done-toggle', { hasText: '已完成 1' }).waitFor()
  await addTodayTask('逾期任务', { date: dates.yesterday })

  // Create an inbox task
  await page.locator('.tab', { hasText: '收件箱' }).click()
  await page.locator('.fab').click()
  await page.locator('.title-input').fill('收件任务')
  await saveSheet()
  await page.locator('.inbox-view').getByText('收件任务').waitFor()

  // 1. Search by notes, tags, status, priority
  await page.locator('.tab', { hasText: '今日' }).click()
  await openSearch()
  if (await page.locator('.tabbar').count()) fail('Tabbar should hide in search')
  const input = page.locator('.search-box input')
  await input.fill('香蕉')
  await page.waitForTimeout(150)
  let titles = await searchTitles()
  if (!titles.includes('搜索苹果') || !titles.includes('搜索香蕉')) {
    fail(`Full-text search missed notes/title: ${titles.join(', ')}`)
  }
  await input.fill('')
  await page.locator('.search-tags .chip').filter({ hasText: '工作' }).click()
  await page.waitForTimeout(150)
  titles = await searchTitles()
  if (!titles.includes('搜索苹果') || titles.includes('搜索香蕉')) {
    fail(`Tag filter failed: ${titles.join(', ')}`)
  }
  await page.locator('.search-tags .chip').filter({ hasText: '工作' }).click()
  await page
    .locator('.search-priority-row .chip')
    .filter({ hasText: '高' })
    .click()
  await page.waitForTimeout(150)
  titles = await searchTitles()
  if (!titles.includes('搜索苹果') || titles.includes('搜索香蕉')) {
    fail(`Priority filter failed: ${titles.join(', ')}`)
  }
  await page
    .locator('.search-priority-row .chip')
    .filter({ hasText: '全部优先级' })
    .click()
  await page.locator('.search-status .seg-option').filter({ hasText: '已完成' }).click()
  await page.waitForTimeout(150)
  titles = await searchTitles()
  if (!titles.includes('已完成任务')) {
    fail(`Status filter failed: ${titles.join(', ')}`)
  }
  await page.locator('.search-status .seg-option').filter({ hasText: '待办' }).click()
  await shot('phase1-search')
  log('Search by notes, tag, priority and status works')

  // 2. Bulk complete
  await page.locator('.search-view .tags-head .text-btn').click()
  await page
    .locator('.search-result')
    .filter({ hasText: '搜索香蕉' })
    .locator('.search-select')
    .click()
  await page.locator('.selection-bar').getByRole('button', { name: '完成' }).click()
  await page.locator('.toast', { hasText: '已完成 1 个任务' }).waitFor()
  await page.locator('.search-status .seg-option').filter({ hasText: '已完成' }).click()
  await page.waitForTimeout(150)
  titles = await searchTitles()
  if (!titles.includes('搜索香蕉')) fail('Bulk complete did not complete the task')
  log('Bulk complete works')

  // 3. Bulk reschedule
  await page.locator('.search-status .seg-option').filter({ hasText: '待办' }).click()
  await page.locator('.search-view .tags-head .text-btn').click()
  await page
    .locator('.search-result')
    .filter({ hasText: '搜索苹果' })
    .locator('.search-select')
    .click()
  await page.locator('.selection-bar').getByRole('button', { name: '改期' }).click()
  await page.locator('.bulk-date-sheet').waitFor()
  await page.locator('.bulk-date-sheet .chip').filter({ hasText: '明天' }).click()
  await page.locator('.toast', { hasText: '已把 1 个任务移到' }).waitFor()
  log('Bulk reschedule works')

  // 4. Bulk trash and undo
  await page.locator('.search-view .tags-head .text-btn').click()
  await page
    .locator('.search-result')
    .filter({ hasText: '收件任务' })
    .locator('.search-select')
    .click()
  await page.locator('.selection-bar').getByRole('button', { name: '删除' }).click()
  const undoToast = page.locator('.toast', { hasText: '已移到最近删除' })
  await undoToast.waitFor()
  await undoToast.locator('.toast-action').click()
  await page.locator('.toast', { hasText: '已恢复' }).waitFor()
  await page.waitForTimeout(250)
  titles = await searchTitles()
  if (!titles.includes('收件任务')) fail('Bulk delete undo did not restore the task')
  log('Bulk delete and undo work')
  await closeSearch()

  // 5. Quick reschedule from overdue and inbox
  await page.locator('.tab', { hasText: '今日' }).click()
  const overdueCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '逾期任务' })
  await overdueCard.locator('.quick-chip').filter({ hasText: '今天' }).click()
  await page.locator('.section-title', { hasText: '顺延' }).waitFor({ state: 'hidden' })
  await page.locator('.today-view').getByText('逾期任务').waitFor()

  await page.locator('.tab', { hasText: '收件箱' }).click()
  const inboxCard = page
    .locator('.inbox-view .task-card')
    .filter({ hasText: '收件任务' })
  await inboxCard.locator('.quick-chip').filter({ hasText: '今天' }).click()
  await page.waitForTimeout(250)
  if (await page.locator('.inbox-view .task-card', { hasText: '收件任务' }).count()) {
    fail('Inbox quick schedule did not remove the task from inbox')
  }
  await page.locator('.tab', { hasText: '今日' }).click()
  await page.locator('.today-view').getByText('收件任务').waitFor()
  log('Quick reschedule from overdue and inbox works')

  // 6. Recently deleted view: delete one task and restore it
  // Use an open card: completed cards live in the collapsed section.
  const trashCandidate = page
    .locator('.today-view .task-card')
    .filter({ hasText: '逾期任务' })
  await trashCandidate.locator('.task-open').click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('.danger-btn').click()
  await page.locator('.toast', { hasText: '已移到最近删除' }).waitFor()
  await page.locator('.sheet').waitFor({ state: 'hidden' })

  await page.locator('.tab', { hasText: '设置' }).click()
  await page.locator('.setting-row', { hasText: '最近删除' }).click()
  await page.locator('.trash-view').waitFor()
  await page.locator('.trash-title', { hasText: '逾期任务' }).waitFor()
  await page.locator('.trash-restore').first().click()
  await page.locator('.toast', { hasText: '任务已恢复' }).waitFor()
  await page.locator('.back-btn').click()
  await page.locator('.settings-view').waitFor()
  await page.locator('.tab', { hasText: '今日' }).click()
  await page.locator('.today-view').getByText('逾期任务').waitFor()
  log('Recently deleted restore works')

  // 7. Backup reminder state and export timestamp
  await page.locator('.tab', { hasText: '设置' }).click()
  const backupStatus = page.locator('.backup-status')
  const initialBackupText = await backupStatus.innerText()
  if (!initialBackupText.includes('还没有导出过备份')) {
    fail(`Unexpected initial backup status: ${initialBackupText}`)
  }
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.setting-row', { hasText: '导出备份' }).click()
  const download = await downloadPromise
  await download.saveAs(path.join(shotsDir, 'phase1-backup.json'))
  await page.waitForTimeout(300)
  const updatedBackupText = await backupStatus.innerText()
  if (!updatedBackupText.includes('今天')) {
    fail(`Backup timestamp not updated: ${updatedBackupText}`)
  }
  await shot('phase1-settings')
  log('Backup reminder and export timestamp work')

  console.log('\nAll Phase 1 checks passed.')
} finally {
  await browser.close()
}
