import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const baseURL = 'http://127.0.0.1:5173/'
const shotsDir = path.resolve('shots')
await mkdir(shotsDir, { recursive: true })

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
const shot = async (name) => {
  await page.screenshot({
    path: path.join(shotsDir, `${name}.png`),
    animations: 'disabled',
  })
}

async function openNewTask() {
  await page.locator('.fab').click()
  await page.locator('.sheet').waitFor({ state: 'visible' })
}

async function saveSheet() {
  await page.locator('.primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
}

async function parseHintFor(title) {
  await openNewTask()
  await page.locator('.title-input').fill(title)
  await page.waitForTimeout(120)
  const hint = page.locator('.parse-hint')
  const text = (await hint.count()) ? await hint.innerText() : ''
  await page.locator('.sheet-close').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  return text.replace(/\s+/g, ' ')
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor({ state: 'visible' })
  const dates = await page.evaluate(() => {
    const fmt = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    return {
      today: fmt(now),
      tomorrow: fmt(tomorrow),
      yesterday: fmt(yesterday),
    }
  })
  console.log('Dates:', dates)
  await shot('01-today-empty')
  log('Today view renders empty state')

  // Hero theme toggle
  const themeToggle = page.locator('.theme-toggle')
  await themeToggle.click()
  const darkAfterToggle = await page.locator('html').getAttribute('data-theme')
  if (darkAfterToggle !== 'dark') {
    throw new Error(`Theme toggle did not switch to dark: ${darkAfterToggle}`)
  }
  await themeToggle.click()
  const lightAfterToggle = await page.locator('html').getAttribute('data-theme')
  if (lightAfterToggle !== 'light') {
    throw new Error(`Theme toggle did not switch to light: ${lightAfterToggle}`)
  }
  log('Hero theme toggle switches light/dark')

  // Parser coverage
  const parserCases = [
    { title: '周五交报告', includes: ['交报告'] },
    { title: '今晚8点健身', includes: ['20:00', '健身'] },
    { title: '11月20日体检上午9点', includes: ['11月20日', '09:00', '体检'] },
    { title: '下周一 10:00 组会 1小时', includes: ['10:00', '1小时', '组会'] },
    { title: '3点半开会', includes: ['15:30', '开会'] },
    { title: '半小时冥想', includes: ['30分钟', '冥想'] },
  ]
  for (const testCase of parserCases) {
    const text = await parseHintFor(testCase.title)
    for (const expected of testCase.includes) {
      if (!text.includes(expected)) {
        throw new Error(`Parser case "${testCase.title}" missing "${expected}" in: ${text}`)
      }
    }
  }
  const plainHint = await parseHintFor('买牛奶')
  if (plainHint !== '') throw new Error('Plain title should not show a parse hint')
  log(`Parser cases passed (${parserCases.length})`)

  // Picking a time without a date should imply today
  await openNewTask()
  await page.locator('.title-input').fill('测试时间')
  await page.locator('.sheet .chip', { hasText: '无日期' }).click()
  const dateBeforeTime = await page.locator('.date-chip input').inputValue()
  if (dateBeforeTime) throw new Error('Clearing the date failed')
  await page.locator('.time-input').fill('14:00')
  const autoDate = await page.locator('.date-chip input').inputValue()
  if (autoDate !== dates.today) {
    throw new Error(`Time did not auto-select today: ${autoDate}`)
  }
  await page.locator('.sheet-close').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  log('Setting a time auto-selects today')

  // A recurring task must have a date
  await openNewTask()
  await page.locator('.title-input').fill('测试重复')
  await page.locator('.sheet .chip', { hasText: '每天' }).click()
  await page.locator('.sheet .chip', { hasText: '无日期' }).click()
  await page.locator('.primary-btn').click()
  await page.locator('.form-error').waitFor({ state: 'visible' })
  const recurrenceError = await page.locator('.form-error').innerText()
  if (!recurrenceError.includes('日期')) {
    throw new Error(`Unexpected recurrence validation: ${recurrenceError}`)
  }
  await page.locator('.sheet-close').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  log('Recurrence without a date is rejected')

  // Quick-add with natural language
  await openNewTask()
  await page
    .locator('.title-input')
    .fill('今天下午3点和张三开会 30分钟 #工作')
  await page.locator('.parse-hint').waitFor({ state: 'visible' })
  const hint = await page.locator('.parse-hint').innerText()
  if (!hint.includes('15:00') || !hint.includes('30分钟') || !hint.includes('#工作')) {
    throw new Error(`Parse hint missing fields: ${hint}`)
  }
  await shot('02-sheet-parsed')
  log('Natural-language parse hint: ' + hint.replace(/\s+/g, ' '))
  await saveSheet()
  await page.getByText('和张三开会').first().waitFor({ state: 'visible' })
  await shot('03-today-with-task')
  log('Task created from parsed input')

  // Second task, tomorrow
  await openNewTask()
  await page.locator('.title-input').fill('明天上午10点买菜 1小时 #生活')
  await saveSheet()

  // Calendar
  await page.locator('.tab', { hasText: '日历' }).click()
  await page.locator('.week-strip').waitFor({ state: 'visible' })
  const selectedDayText = await page.locator('.day-panel').innerText()
  if (!selectedDayText.includes('和张三开会')) {
    throw new Error('Today task missing from calendar day panel')
  }
  await page.locator(`.day-cell[data-date="${dates.tomorrow}"]`).click()
  await page.waitForTimeout(150)
  const tomorrowPanel = await page.locator('.day-panel').innerText()
  if (!tomorrowPanel.includes('买菜')) {
    throw new Error('Tomorrow task missing from calendar day panel')
  }
  await shot('04-calendar')
  log('Calendar shows today + tomorrow tasks')

  // Complete today's task
  await page.locator('.tab', { hasText: '今日' }).click()
  const meetingCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '和张三开会' })
  await meetingCard.locator('.task-check').click()
  await page.locator('.done-toggle', { hasText: '已完成 1' }).waitFor()
  await shot('05-today-completed')
  log('Completing a task moves it to the completed group')

  // Overdue + bulk move
  await openNewTask()
  await page.locator('.title-input').fill('补交材料')
  await page.locator('.date-chip input').fill(dates.yesterday)
  await saveSheet()
  await page.locator('.section-title', { hasText: '顺延' }).waitFor()
  await shot('06-overdue')
  log('Overdue task lands in the rollover section')
  await page.getByRole('button', { name: '全部移到今天' }).click()
  await page.locator('.section-title', { hasText: '顺延' }).waitFor({ state: 'hidden' })
  await page.getByText('补交材料').first().waitFor({ state: 'visible' })
  log('Bulk move to today works')

  // Recurring task
  await openNewTask()
  await page.locator('.title-input').fill('背单词 30分钟')
  await page.locator('.sheet .chip', { hasText: '每天' }).click()
  await saveSheet()
  const vocabCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '背单词' })
  await vocabCard.locator('.task-check').click()
  const nextToast = page.locator('.toast').filter({ hasText: '下一次' })
  await nextToast.waitFor({ state: 'visible', timeout: 8000 })
  const toastText = await nextToast.innerText()
  log('Recurring task spawned next occurrence: ' + toastText)
  await page.locator('.tab', { hasText: '日历' }).click()
  await page.locator(`.day-cell[data-date="${dates.tomorrow}"]`).click()
  await page.waitForTimeout(150)
  const recurPanel = await page.locator('.day-panel').innerText()
  if (!recurPanel.includes('背单词')) {
    throw new Error('Spawned recurring task not on tomorrow')
  }
  log('Next recurring occurrence is scheduled tomorrow')

  // Inbox
  await page.locator('.tab', { hasText: '收件箱' }).click()
  await openNewTask()
  const sheetDate = await page.locator('.date-chip input').inputValue()
  if (sheetDate) throw new Error('Inbox quick add should default to no date')
  await page.locator('.title-input').fill('查快递')
  await saveSheet()
  await page.locator('.inbox-view').getByText('查快递').waitFor()
  await shot('07-inbox')
  log('Inbox captures an undated task')

  // Schedule the inbox task for today
  await page
    .locator('.inbox-view .task-card')
    .filter({ hasText: '查快递' })
    .locator('.task-main')
    .click()
  await page.locator('.sheet .chip', { hasText: '今天' }).first().click()
  await saveSheet()
  await page.locator('.tab', { hasText: '今日' }).click()
  await page.getByText('查快递').first().waitFor({ state: 'visible' })
  log('Inbox task can be scheduled for today')

  // Completed task still visible after expanding
  await page.locator('.done-toggle', { hasText: '已完成' }).first().click()
  await page.locator('.done-list').getByText('和张三开会').waitFor()
  log('Completed group expands correctly')

  // Settings + theme
  await page.locator('.tab', { hasText: '设置' }).click()
  await page.locator('.settings-view').waitFor()
  await page.locator('.seg-option', { hasText: '深色' }).click()
  const theme = await page.locator('html').getAttribute('data-theme')
  if (theme !== 'dark') throw new Error(`Theme not applied: ${theme}`)
  await shot('08-settings-dark')
  log('Dark theme applies immediately')

  await page.locator('.tab', { hasText: '今日' }).click()
  await shot('09-today-dark')
  log('Dark today view rendered')

  // Exports
  await page.locator('.tab', { hasText: '设置' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.setting-row', { hasText: '导出备份' }).click()
  const backupDownload = await downloadPromise
  const backupPath = path.join(shotsDir, 'backup.json')
  await backupDownload.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  if (!Array.isArray(backup.tasks) || backup.tasks.length < 3) {
    throw new Error('Backup export did not contain tasks')
  }
  log(`JSON backup exported with ${backup.tasks.length} tasks`)

  const icsDownloadPromise = page.waitForEvent('download')
  await page.locator('.setting-row', { hasText: '导出日历' }).click()
  const icsDownload = await icsDownloadPromise
  const icsPath = path.join(shotsDir, 'calendar.ics')
  await icsDownload.saveAs(icsPath)
  const ics = await readFile(icsPath, 'utf8')
  if (!ics.startsWith('BEGIN:VCALENDAR') || !ics.includes('BEGIN:VEVENT')) {
    throw new Error('ICS export looks invalid')
  }
  log('ICS calendar exported')

  // Clear and restore from the backup
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('.setting-row', { hasText: '清空数据' }).click()
  await page.locator('.toast').filter({ hasText: '已清空' }).waitFor({ timeout: 8000 })
  await page.waitForTimeout(200)
  const countAfterClear = await page
    .locator('.stat-cell')
    .first()
    .locator('strong')
    .innerText()
  if (countAfterClear !== '0') {
    throw new Error(`Clear did not empty data: ${countAfterClear}`)
  }
  log('Clear data works')

  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type=file]').setInputFiles(backupPath)
  await page.locator('.toast').filter({ hasText: '已导入' }).waitFor({ timeout: 8000 })
  const countAfterImport = await page
    .locator('.stat-cell')
    .first()
    .locator('strong')
    .innerText()
  if (countAfterImport !== String(backup.tasks.length)) {
    throw new Error(
      `Import restored ${countAfterImport} instead of ${backup.tasks.length}`,
    )
  }
  log('Backup import restored all tasks')

  // Switch back to light and take the final shot
  await page.locator('.seg-option', { hasText: '浅色' }).click()
  await page.locator('.tab', { hasText: '今日' }).click()
  await page.waitForTimeout(200)
  await shot('10-today-final')

  console.log('\nAll UI checks passed.')
} finally {
  await browser.close()
}
