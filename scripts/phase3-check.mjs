import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
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

async function addHabit(name, schedule = null, customDays = null) {
  await page
    .locator('.review-section-head .text-btn')
    .filter({ hasText: '添加' })
    .click()
  await page
    .locator('.sheet-head h2', { hasText: '添加习惯' })
    .waitFor()
  await page.locator('.sheet .title-input').fill(name)
  if (schedule) {
    await page
      .locator('.sheet .seg-option')
      .filter({ hasText: schedule })
      .click()
  }
  if (customDays) {
    for (const [label, active] of Object.entries(customDays)) {
      const button = page.locator('.habit-weekday').filter({ hasText: label })
      const current = await button.getAttribute('aria-pressed')
      if (Boolean(active) !== (current === 'true')) await button.click()
    }
  }
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  await page.locator('.habit-row').filter({ hasText: name }).waitFor()
}

async function completeTodayTask(title) {
  await page.locator('.fab').click()
  await page.locator('.title-input').fill(title)
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  const card = page.locator('.today-view .task-card').filter({ hasText: title })
  await card.waitFor()
  await card.locator('.task-check').click()
  await page.waitForTimeout(250)
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.today-view').waitFor()
  const dateKeys = await page.evaluate(() => {
    const fmt = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`
    return { today: fmt(new Date()) }
  })

  // Open review from the empty habits card
  await page.locator('.habit-empty-card').click()
  await page.locator('.review-view').waitFor()
  log('Review opens from Today')

  await addHabit('喝水')
  await addHabit('背单词', '工作日')
  await addHabit('跑步', '自定义', {
    一: false,
    二: false,
    三: true,
    四: false,
    五: false,
    六: false,
    日: false,
  })
  if ((await page.locator('.habit-row').count()) !== 3) {
    fail('Habits were not created')
  }

  // Check all three habits in Review
  for (const name of ['喝水', '背单词', '跑步']) {
    const row = page.locator('.habit-row').filter({ hasText: name })
    await row.locator('.habit-row-check').click()
    await row.locator('.habit-row-check.checked').waitFor()
  }
  const habitStat = page
    .locator('.weekly-metric')
    .filter({ hasText: '习惯完成' })
    .locator('strong')
  await page.waitForTimeout(250)
  if ((await habitStat.innerText()) !== '100%') {
    fail(`Habit summary wrong: ${await habitStat.innerText()}`)
  }
  const waterMeta = await page
    .locator('.habit-row')
    .filter({ hasText: '喝水' })
    .locator('.habit-row-meta')
    .innerText()
  if (!waterMeta.includes('连续 1 天')) {
    fail(`Habit streak missing: ${waterMeta}`)
  }
  await shot('phase3-review')
  log('Habit creation, custom schedule and check-ins work')

  // Today section reflects due habits
  await page.locator('.back-btn').click()
  await page.locator('.today-view').waitFor()
  const habitCount = await page
    .locator('.habits-section .count-pill')
    .innerText()
  if (habitCount !== '3/3') fail(`Today habit count wrong: ${habitCount}`)
  if ((await page.locator('.habit-today-row').count()) !== 3) {
    fail('Today habit list missing rows')
  }
  log('Today habit section reflects check-ins')

  // Complete a task, then check review stats and heatmap
  await completeTodayTask('统计任务')
  await page
    .locator('.habits-section .text-btn')
    .filter({ hasText: '回顾' })
    .click()
  await page.locator('.review-view').waitFor()
  const completedStat = page
    .locator('.weekly-metric')
    .filter({ hasText: '完成任务' })
    .locator('strong')
  if ((await completedStat.innerText()) !== '1') {
    fail(`Completed stat wrong: ${await completedStat.innerText()}`)
  }
  const taskHeat = await page
    .locator(`.heat-cell[data-date="${dateKeys.today}"]`)
    .getAttribute('class')
  if (!taskHeat?.includes('level-1')) {
    fail(`Task heatmap cell wrong: ${taskHeat}`)
  }
  await page
    .locator('.heatmap-metric')
    .filter({ hasText: '习惯' })
    .click()
  await page.waitForTimeout(100)
  const habitHeat = await page
    .locator(`.heat-cell[data-date="${dateKeys.today}"]`)
    .getAttribute('class')
  if (!habitHeat?.includes('level-3')) {
    fail(`Habit heatmap cell wrong: ${habitHeat}`)
  }
  await shot('phase3-heatmap')
  log('Completion stats and heatmap metrics work')

  // Edit a habit; check-in must survive
  await page.getByRole('button', { name: '编辑习惯 喝水' }).click()
  await page.locator('.sheet-head h2', { hasText: '编辑习惯' }).waitFor()
  await page.locator('.sheet .title-input').fill('喝水2')
  await page
    .locator('.sheet .seg-option')
    .filter({ hasText: '工作日' })
    .click()
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  const renamedHabit = page.locator('.habit-row').filter({ hasText: '喝水2' })
  await renamedHabit.waitFor()
  await renamedHabit.locator('.habit-row-check.checked').waitFor()
  const renamedMeta = await renamedHabit.locator('.habit-row-meta').innerText()
  if (!renamedMeta.includes('工作日')) {
    fail(`Habit edit did not update schedule: ${renamedMeta}`)
  }

  // Delete a habit
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '删除习惯 跑步' }).click()
  await page.waitForTimeout(300)
  if ((await page.locator('.habit-row').filter({ hasText: '跑步' }).count()) !== 0) {
    fail('Habit delete failed')
  }
  log('Habit edit preserves check-ins; delete works')

  // Back to Today; due habits are now two and both checked
  await page.locator('.back-btn').click()
  await page.locator('.today-view').waitFor()
  const todayHabitRows = page.locator('.habit-today-row')
  if ((await todayHabitRows.count()) !== 2) {
    fail(`Expected 2 due habits, got ${await todayHabitRows.count()}`)
  }
  for (const row of await todayHabitRows.all()) {
    if (!(await row.locator('.habit-today-check').innerHTML()).includes('svg')) {
      fail('Habit check state lost on Today')
    }
  }

  // Focus history logging and focus heatmap metric
  await page.locator('.fab').click()
  await page.locator('.title-input').fill('专注统计')
  await page.locator('.time-input').fill('08:00')
  await page.locator('.duration-custom input').fill('1')
  await page.locator('.sheet .primary-btn').click()
  await page.locator('.sheet').waitFor({ state: 'hidden' })
  const focusTask = page
    .locator('.today-view .task-card')
    .filter({ hasText: '专注统计' })
  await focusTask.waitFor()
  if (page.clock && typeof page.clock.install === 'function') {
    await page.clock.install()
  }
  await focusTask.locator('.task-timer').click()
  await page.locator('.focus-view').waitFor()
  if (page.clock && typeof page.clock.fastForward === 'function') {
    await page.clock.fastForward(61_000)
    await page.locator('.focus-status', { hasText: '已完成' }).waitFor()
  } else {
    fail('Playwright clock unavailable')
  }
  await page.locator('.tab', { hasText: '今日' }).click()
  await page
    .locator('.habits-section .text-btn')
    .filter({ hasText: '回顾' })
    .click()
  await page.locator('.review-view').waitFor()
  const focusStat = page
    .locator('.weekly-metric')
    .filter({ hasText: '专注分钟' })
    .locator('strong')
  await page.waitForTimeout(300)
  if (Number(await focusStat.innerText()) < 1) {
    fail(`Focus minutes not logged: ${await focusStat.innerText()}`)
  }
  await page
    .locator('.heatmap-metric')
    .filter({ hasText: '专注' })
    .click()
  await page.waitForTimeout(100)
  const focusHeat = await page
    .locator(`.heat-cell[data-date="${dateKeys.today}"]`)
    .getAttribute('class')
  if (!focusHeat?.includes('level-1')) {
    fail(`Focus heatmap cell wrong: ${focusHeat}`)
  }
  log('Focus history is logged and shown in stats')

  // Backup includes habits and focus history
  await page.locator('.back-btn').click()
  await page.locator('.today-view').waitFor()
  await page.locator('.tab', { hasText: '设置' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.setting-row', { hasText: '导出备份' }).click()
  const download = await downloadPromise
  const backupPath = path.join(shotsDir, 'phase3-backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  if (backup.habits.length !== 2 || backup.focusSessions.length < 1) {
    fail(
      `Backup habits/focus missing: ${backup.habits?.length}/${backup.focusSessions?.length}`,
    )
  }
  log('Backup includes habits and focus history')

  console.log('\nAll Phase 3 checks passed.')
} finally {
  await browser.close()
}
