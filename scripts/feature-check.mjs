import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.PWA_URL || 'http://127.0.0.1:5173/'
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

async function openNewTask() {
  await page.locator('.fab').click()
  await page.locator('.sheet').waitFor({ state: 'visible' })
}

async function saveSheet() {
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
}

async function addTask(title, options = {}) {
  await openNewTask()
  await page.locator('.title-input').fill(title)
  if (options.time) await page.locator('.time-input').fill(options.time)
  if (options.duration) {
    await page.locator('.duration-custom input').fill(String(options.duration))
  }
  if (options.highPriority) {
    await page.locator('.sheet .seg-option').filter({ hasText: '高' }).click()
  }
  await saveSheet()
  await page.locator('.today-view .task-title', { hasText: title }).first().waitFor()
}

async function todayTitles() {
  return page.locator('.today-view .sortable-task .task-title').allInnerTexts()
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
    const plus3 = new Date(now)
    plus3.setDate(now.getDate() + 3)
    return {
      today: fmt(now),
      tomorrow: fmt(tomorrow),
      yesterday: fmt(yesterday),
      plus3: fmt(plus3),
    }
  })
  console.log('Dates:', dates)

  // A. Inline subtasks, notes, custom duration
  await openNewTask()
  await page.locator('.title-input').fill('写周报')
  await page.locator('.notes-input').fill('这是备注内容，应该直接显示在任务下面。')
  const subAdd = page.locator('.subtask-add input')
  await subAdd.fill('收集数据')
  await subAdd.press('Enter')
  await subAdd.fill('写初稿')
  await subAdd.press('Enter')
  await page.locator('.time-input').fill('09:00')
  await page.locator('.duration-custom input').fill('45')
  const durationTexts = await page.locator('.duration-chip').allInnerTexts()
  if (durationTexts.some((text) => text.includes('1小时'))) {
    fail(`Long duration chips still present: ${durationTexts.join(', ')}`)
  }
  await saveSheet()

  const reportCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '写周报' })
  await reportCard.waitFor()
  const notesText = await reportCard.locator('.task-notes').innerText()
  if (!notesText.includes('备注内容')) fail('Notes preview missing')
  const metaText = await reportCard.locator('.task-meta').innerText()
  if (!metaText.includes('45分钟') || !metaText.includes('09:00')) {
    fail(`Duration/time meta missing: ${metaText}`)
  }
  const subRows = reportCard.locator('.task-subtask')
  if ((await subRows.count()) !== 2) fail('Inline subtasks not rendered')
  await subRows.first().locator('.sub-check').click()
  await page.waitForTimeout(250)
  const subPressed = await subRows
    .first()
    .locator('.sub-check')
    .getAttribute('aria-pressed')
  if (subPressed !== 'true') fail('Inline subtask did not toggle')
  if (await page.locator('.sheet').isVisible()) {
    fail('Subtask click opened the edit sheet')
  }
  await shot('feature-subtasks')
  log('Inline subtasks, notes and custom duration work')

  // B. Date-range task: yesterday + today, last day today, yesterday must not roll over
  await openNewTask()
  await page.locator('.title-input').fill('晨间跑步')
  await page
    .locator('.date-mode-toggle .seg-option')
    .filter({ hasText: '日期段' })
    .click()
  const rangeInputs = page.locator('.range-date input')
  await rangeInputs.nth(0).fill(dates.yesterday)
  await rangeInputs.nth(1).fill(dates.today)
  await saveSheet()

  const runCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '晨间跑步' })
  await runCard.waitFor()
  await runCard.locator('.last-day-chip').waitFor()
  if ((await page.locator('.section-title', { hasText: '顺延' }).count()) !== 0) {
    fail('A past range instance leaked into the overdue section')
  }
  await shot('feature-range-lastday')
  log('Date-range tasks show daily and mark the last day without rollover')

  await runCard.locator('.task-open').click()
  await page.locator('.series-info').waitFor()
  const seriesText = await page.locator('.series-info').innerText()
  if (!seriesText.includes('修改只影响这一天')) {
    fail('Series edit notice missing')
  }
  if (!(await page.getByRole('button', { name: '删除这天' }).count())) {
    fail('Series delete-this-day label missing')
  }
  await page.locator('.sheet-close').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })

  // Calendar contains the past instance too
  await page.locator('.tab', { hasText: '日历' }).click()
  await page.locator(`.day-cell[data-date="${dates.yesterday}"]`).click()
  await page.waitForTimeout(180)
  const yesterdayPanel = await page.locator('.day-panel').innerText()
  if (!yesterdayPanel.includes('晨间跑步')) {
    fail('Past range instance missing from calendar')
  }
  await page.locator('.tab', { hasText: '今日' }).click()

  // Delete the whole range from the edit sheet
  await page
    .locator('.today-view .task-card')
    .filter({ hasText: '晨间跑步' })
    .locator('.task-open')
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('.series-info .danger-text').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  await page.waitForTimeout(300)
  if (
    await page
      .locator('.today-view .task-card')
      .filter({ hasText: '晨间跑步' })
      .count()
  ) {
    fail('Range series was not deleted')
  }
  log('Range series can be deleted as a whole')

  // C. Tags: create, filter from task, rename, delete
  await openNewTask()
  await page.locator('.title-input').fill('标签测试')
  const tagInput = page.locator('.tag-input')
  await tagInput.fill('工作')
  await tagInput.press('Enter')
  await tagInput.fill('重要')
  await tagInput.press('Enter')
  await saveSheet()

  const tagCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '标签测试' })
  await tagCard.waitFor()
  await tagCard.locator('.tag-pill').filter({ hasText: '工作' }).click()
  await page.locator('.tags-view').waitFor()
  if ((await page.locator('.tags-title h1').innerText()) !== '#工作') {
    fail('Tag pill did not open the filtered tag view')
  }
  await page
    .locator('.tags-view .task-card')
    .filter({ hasText: '标签测试' })
    .waitFor()
  await shot('feature-tags-filtered')
  await page.locator('.back-btn').click()
  await page.locator('.tag-manager-list').waitFor()

  await page.getByRole('button', { name: '重命名标签 工作' }).click()
  await page.locator('.tag-rename-input').fill('办公')
  await page.locator('.tag-rename-input').press('Enter')
  await page.waitForTimeout(350)
  const tagNamesAfterRename = await page.locator('.tag-name').allInnerTexts()
  if (!tagNamesAfterRename.includes('办公') || tagNamesAfterRename.includes('工作')) {
    fail(`Tag rename failed: ${tagNamesAfterRename.join(', ')}`)
  }

  await page.locator('.tag-row-main').filter({ hasText: '办公' }).click()
  await page
    .locator('.tags-view .task-card')
    .filter({ hasText: '标签测试' })
    .locator('.tag-pill')
    .filter({ hasText: '办公' })
    .waitFor()
  await page.locator('.back-btn').click()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '删除标签 重要' }).click()
  await page.waitForTimeout(400)
  const tagNamesAfterDelete = await page.locator('.tag-name').allInnerTexts()
  if (tagNamesAfterDelete.includes('重要')) fail('Tag delete failed')
  await shot('feature-tags-manager')
  await page.locator('.back-btn').click()
  await page.locator('.tabbar').waitFor()

  await page.locator('.tab', { hasText: '设置' }).click()
  await page
    .locator('.setting-row', { hasText: '标签管理' })
    .click()
  await page.locator('.tags-view').waitFor()
  await page.locator('.back-btn').click()
  await page.locator('.settings-view').waitFor()
  log('Tag filter, rename and delete work; Settings entry works')

  // D. Calendar expand / collapse
  await page.locator('.tab', { hasText: '日历' }).click()
  const todayButton = page.locator('.today-btn')
  if (await todayButton.isEnabled()) await todayButton.click()
  await page.locator('.cal-expand').click()
  await page.locator('.month-grid').waitFor()
  await shot('feature-calendar-expanded')
  await page.locator(`.month-cell[data-date="${dates.plus3}"]`).click()
  await page.waitForTimeout(150)
  const pressed = await page
    .locator(`.month-cell[data-date="${dates.plus3}"]`)
    .getAttribute('aria-pressed')
  if (pressed !== 'true') fail('Month date selection failed')
  await page.locator('.cal-expand').click()
  await page.locator('.week-strip').waitFor()
  if (await page.locator('.month-grid').count()) {
    fail('Month grid did not collapse')
  }
  log('Calendar expands to a month and collapses back')

  // E. Drag within the same priority
  await page.locator('.tab', { hasText: '今日' }).click()
  await addTask('拖动A')
  await addTask('拖动B')
  await addTask('拖动高', { highPriority: true })
  await page.waitForTimeout(300)

  const before = await todayTitles()
  const highIndex = before.indexOf('拖动高')
  const aIndex = before.indexOf('拖动A')
  const bIndex = before.indexOf('拖动B')
  if (highIndex < 0 || aIndex < 0 || bIndex < 0) {
    fail(`Missing drag tasks: ${before.join(', ')}`)
  }
  if (!(highIndex < aIndex && aIndex < bIndex)) {
    fail(`Unexpected initial order: ${before.join(', ')}`)
  }

  const sourceTitle = page
    .locator('.today-view .sortable-task')
    .filter({ hasText: '拖动B' })
    .locator('.task-title')
  const targetTitle = page
    .locator('.today-view .sortable-task')
    .filter({ hasText: '拖动A' })
    .locator('.task-title')
  await sourceTitle.scrollIntoViewIfNeeded()
  const sourceBox = await sourceTitle.boundingBox()
  const targetBox = await targetTitle.boundingBox()
  if (!sourceBox || !targetBox) fail('Drag bounding boxes unavailable')
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  )
  await page.mouse.down()
  await page.waitForTimeout(140)
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 2,
    { steps: 24 },
  )
  await page.waitForTimeout(180)
  await page.mouse.up()
  await page.waitForTimeout(600)

  const after = await todayTitles()
  const afterA = after.indexOf('拖动A')
  const afterB = after.indexOf('拖动B')
  if (!(afterB >= 0 && afterA >= 0 && afterB < afterA)) {
    fail(`Same-priority drag failed: ${after.join(', ')}`)
  }
  if (after.indexOf('拖动高') > afterB) {
    fail(`Priority ordering changed unexpectedly: ${after.join(', ')}`)
  }
  log('Same-priority drag reorders without crossing priority groups')

  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor()
  const afterReload = await todayTitles()
  if (
    !(
      afterReload.indexOf('拖动B') >= 0 &&
      afterReload.indexOf('拖动A') >= 0 &&
      afterReload.indexOf('拖动B') < afterReload.indexOf('拖动A')
    )
  ) {
    fail(`Drag order did not persist after reload: ${afterReload.join(', ')}`)
  }
  log('Manual order persists after reload')

  // F. Task focus timer
  await addTask('专注测试', { time: '08:00', duration: 1 })
  const focusCard = page
    .locator('.today-view .task-card')
    .filter({ hasText: '专注测试' })
  await focusCard.locator('.task-timer').waitFor()

  if (page.clock && typeof page.clock.install === 'function') {
    await page.clock.install()
  }
  await focusCard.locator('.task-timer').click()
  await page.locator('.focus-view').waitFor()
  const running = await page.locator('.focus-status').innerText()
  if (running !== '专注中') fail(`Focus did not start: ${running}`)
  await shot('feature-focus-running')

  await page.locator('.focus-primary').click()
  await page.locator('.focus-status', { hasText: '已暂停' }).waitFor()
  await page.locator('.focus-primary').click()
  await page.locator('.focus-status', { hasText: '专注中' }).waitFor()

  if (page.clock && typeof page.clock.fastForward === 'function') {
    await page.clock.fastForward(61_000)
    await page.locator('.focus-status', { hasText: '已完成' }).waitFor()
    await page.getByRole('button', { name: '完成任务' }).click()
    await page.locator('.focus-done-note').waitFor()
    await shot('feature-focus-done')
    await page.locator('.tab', { hasText: '今日' }).click()
    await page.locator('.done-toggle', { hasText: '已完成' }).first().click()
    await page
      .locator('.done-list .task-card')
      .filter({ hasText: '专注测试' })
      .waitFor()
    log('Task focus timer starts, pauses, completes and can mark the task done')
  } else {
    log('Focus timer start/pause/resume works (clock fast-forward unavailable)')
  }

  console.log('\nAll feature checks passed.')
} finally {
  await browser.close()
}
