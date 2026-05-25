import type { AppData, BodyProfile, CheckInLog, PendingLink, Practice, PracticeComment } from '../types'

const STORAGE_KEY = 'tech-neck-almanac'

const DEFAULT_DATA: AppData = {
  pendingLinks: [],
  practices: [],
  comments: {},
  checkInLogs: [],
  deletedPracticeIds: [],
  bodyProfile: {},
}

function readRaw(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_DATA }
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      pendingLinks: parsed.pendingLinks ?? [],
      practices: parsed.practices ?? [],
      comments: parsed.comments ?? {},
      checkInLogs: parsed.checkInLogs ?? [],
      deletedPracticeIds: parsed.deletedPracticeIds ?? [],
      bodyProfile: parsed.bodyProfile ?? {},
    }
  } catch {
    return { ...DEFAULT_DATA }
  }
}

function write(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadAppData(): AppData {
  return readRaw()
}

export function savePendingLinks(pendingLinks: PendingLink[]): void {
  const data = readRaw()
  data.pendingLinks = pendingLinks
  write(data)
}

export function savePractices(practices: Practice[]): void {
  const data = readRaw()
  data.practices = practices
  write(data)
}

export function saveComments(comments: Record<string, PracticeComment[]>): void {
  const data = readRaw()
  data.comments = comments
  write(data)
}

export function saveCheckInLogs(checkInLogs: CheckInLog[]): void {
  const data = readRaw()
  data.checkInLogs = checkInLogs
  write(data)
}

export function saveDeletedPracticeIds(deletedPracticeIds: string[]): void {
  const data = readRaw()
  data.deletedPracticeIds = deletedPracticeIds
  write(data)
}

export function saveBodyProfile(bodyProfile: BodyProfile): void {
  const data = readRaw()
  data.bodyProfile = bodyProfile
  write(data)
}

export function computeTotalCheckIns(logs: CheckInLog[]): number {
  return logs.length
}

export function computeStreak(logs: CheckInLog[]): number {
  if (logs.length === 0) return 0

  const uniqueDates = [...new Set(logs.map((log) => log.date))].sort().reverse()
  const today = formatDate(new Date())
  const yesterday = formatDate(addDays(new Date(), -1))

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return 0
  }

  let streak = 0
  let cursor = uniqueDates[0] === today ? new Date() : addDays(new Date(), -1)

  while (uniqueDates.includes(formatDate(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
