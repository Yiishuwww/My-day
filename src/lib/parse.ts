import { addDays, addMonths, addYears, startOfWeek } from 'date-fns'
import { addDaysKey, toKey, todayKey } from './dates'

export interface ParsedInput {
  title: string
  date?: string
  time?: string
  duration?: number
  tags: string[]
}

const CN_NUM: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
}

const WEEKDAY_INDEX: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 0,
}

function cnNumber(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value)
  return CN_NUM[value]
}

function futureWeekday(weekday: number, weekOffset: number): string {
  const now = new Date()
  const today = todayKey()
  const monday = startOfWeek(now, { weekStartsOn: 1 })
  const index = weekday === 0 ? 6 : weekday - 1
  let target = addDays(monday, weekOffset * 7 + index)
  while (toKey(target) < today) target = addDays(target, 7)
  return toKey(target)
}

/**
 * Lightweight Chinese quick-add parser.
 * Example: "明天下午3点和张三开会 30分钟 #工作"
 */
export function parseQuickAdd(raw: string): ParsedInput {
  let rest = raw
  const tags: string[] = []
  let duration: number | undefined
  let date: string | undefined
  let time: string | undefined
  let evening = false

  rest = rest.replace(/#([^\s#]+)/g, (_match, tag: string) => {
    if (!tags.includes(tag)) tags.push(tag)
    return ' '
  })

  const addDuration = (minutes: number): void => {
    duration = (duration ?? 0) + minutes
  }

  rest = rest.replace(/(\d+)\s*个?\s*半\s*小时/g, (_match, amount: string) => {
    addDuration(Number(amount) * 60 + 30)
    return ' '
  })
  rest = rest.replace(
    /([一二两三四五六七八九十]+)\s*个?\s*半\s*小时/g,
    (_match, amount: string) => {
      const value = CN_NUM[amount]
      if (value !== undefined) addDuration(value * 60 + 30)
      return ' '
    },
  )
  rest = rest.replace(
    /(\d+(?:\.\d+)?)\s*个?\s*小时/g,
    (_match, amount: string) => {
      addDuration(Math.round(Number(amount) * 60))
      return ' '
    },
  )
  rest = rest.replace(
    /([一二两三四五六七八九十]+)\s*个?\s*小时/g,
    (_match, amount: string) => {
      const value = CN_NUM[amount]
      if (value !== undefined) addDuration(value * 60)
      return ' '
    },
  )
  rest = rest.replace(/半\s*个?\s*小时/g, () => {
    addDuration(30)
    return ' '
  })
  rest = rest.replace(/(\d+)\s*分钟/g, (_match, amount: string) => {
    addDuration(Number(amount))
    return ' '
  })
  rest = rest.replace(
    /([一二两三四五六七八九十]+)\s*分钟/g,
    (_match, amount: string) => {
      const value = CN_NUM[amount]
      if (value !== undefined) addDuration(value)
      return ' '
    },
  )

  const eveningWords: Array<{ pattern: RegExp; days: number }> = [
    { pattern: /大后天(?:晚上|晚)/, days: 3 },
    { pattern: /后天(?:晚上|晚)|后晚/, days: 2 },
    { pattern: /明天(?:晚上|晚)|明晚/, days: 1 },
    { pattern: /今天(?:晚上|晚)|今晚/, days: 0 },
  ]
  for (const { pattern, days } of eveningWords) {
    if (pattern.test(rest)) {
      date = addDaysKey(todayKey(), days)
      evening = true
      rest = rest.replace(pattern, ' ')
      break
    }
  }

  const dayWords: Array<{ pattern: RegExp; days: number }> = [
    { pattern: /大后天/, days: 3 },
    { pattern: /后天/, days: 2 },
    { pattern: /明天|明日|明儿/, days: 1 },
    { pattern: /今天|今日/, days: 0 },
  ]
  for (const { pattern, days } of dayWords) {
    if (pattern.test(rest)) {
      if (!date) date = addDaysKey(todayKey(), days)
      rest = rest.replace(pattern, ' ')
      break
    }
  }

  const nextWeekMatch = rest.match(
    /下(?:个)?(?:周|星期|礼拜)\s*([一二三四五六日天1-7])/,
  )
  const thisWeekMatch = rest.match(
    /(?:本|这|这个)?(?:周|星期|礼拜)\s*([一二三四五六日天1-7])/,
  )

  if (nextWeekMatch && !date) {
    const weekday = WEEKDAY_INDEX[nextWeekMatch[1]]
    if (weekday !== undefined) {
      date = futureWeekday(weekday, 1)
      rest = rest.replace(nextWeekMatch[0], ' ')
    }
  } else if (thisWeekMatch && !date) {
    const weekday = WEEKDAY_INDEX[thisWeekMatch[1]]
    if (weekday !== undefined) {
      date = futureWeekday(weekday, 0)
      rest = rest.replace(thisWeekMatch[0], ' ')
    }
  }

  if (!date) {
    const monthDayMatch = rest.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/)
    if (monthDayMatch) {
      const month = Number(monthDayMatch[1])
      const day = Number(monthDayMatch[2])
      const now = new Date()
      let target = new Date(now.getFullYear(), month - 1, day)
      const valid =
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31 &&
        target.getMonth() === month - 1 &&
        target.getDate() === day
      if (valid) {
        if (toKey(target) < todayKey()) target = addYears(target, 1)
        date = toKey(target)
        rest = rest.replace(monthDayMatch[0], ' ')
      }
    }
  }

  if (!date) {
    const dayMatch = rest.match(/第?(\d{1,2})\s*[日号]/)
    if (dayMatch) {
      const day = Number(dayMatch[1])
      const now = new Date()
      let target = new Date(now.getFullYear(), now.getMonth(), day)
      const valid = day >= 1 && day <= 31 && target.getDate() === day
      if (valid) {
        if (toKey(target) < todayKey()) target = addMonths(target, 1)
        date = toKey(target)
        rest = rest.replace(dayMatch[0], ' ')
      }
    }
  }

  const timeMatch = rest.match(
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?\s*((?:\d{1,2})|十[一二]?|[零一二两三四五六七八九])\s*[点時时:：]\s*(半|\d{1,2})?\s*分?/,
  )
  if (timeMatch) {
    const period = timeMatch[1]
    const hourValue = cnNumber(timeMatch[2] ?? '')
    const minuteValue = timeMatch[3]
    if (hourValue !== undefined && hourValue >= 0 && hourValue <= 24) {
      let hour = hourValue
      if (period) {
        if (['下午', '傍晚', '晚上', '夜里'].includes(period) && hour < 12) {
          hour += 12
        }
        if (['晚上', '夜里'].includes(period) && hour === 12) hour = 0
        if (period === '中午' && hour < 11) hour += 12
        if (
          ['凌晨', '早上', '早晨'].includes(period) &&
          hour === 12
        ) {
          hour = 0
        }
      } else if (evening) {
        if (hour < 12) hour += 12
        if (hour === 12) hour = 0
      } else if (hour >= 1 && hour <= 6) {
        hour += 12
      }

      let minutes = 0
      if (minuteValue === '半') minutes = 30
      else if (minuteValue) minutes = Number(minuteValue)

      if (minutes >= 0 && minutes < 60) {
        hour %= 24
        time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        rest = rest.replace(timeMatch[0], ' ')
        if (!date) date = todayKey()
      }
    }
  }

  const title = rest
    .replace(/\s+/g, ' ')
    .replace(/^[\s,，、。;；:：\-—–·]+/, '')
    .replace(/[\s,，、。;；:：\-—–·]+$/, '')
    .trim()

  return {
    title,
    date,
    time,
    duration: duration && duration > 0 ? duration : undefined,
    tags: Array.from(new Set(tags)),
  }
}
