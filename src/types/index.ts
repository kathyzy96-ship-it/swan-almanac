export type Symptom = 'rounded-shoulders' | 'hunchback' | 'forward-head'
export type CategoryFilter = Symptom | 'all'

export interface PendingLink {
  id: string
  url: string
  createdAt: string
}

export interface Practice {
  id: string
  sourceUrl: string
  name: string
  symptoms: Symptom[]
  steps: [string, string, string]
  imageUrl?: string
  checkInCount: number
  createdAt: string
}

export interface PracticeComment {
  id: string
  practiceId: string
  userName: string
  relativeTime: string
  body: string
  avatarTone: string
}

export interface CheckInLog {
  id: string
  practiceId: string
  date: string
  timestamp: string
}

export interface BodyProfile {
  beforeImage?: string
  afterImage?: string
}

export interface AppData {
  pendingLinks: PendingLink[]
  practices: Practice[]
  comments: Record<string, PracticeComment[]>
  checkInLogs: CheckInLog[]
  deletedPracticeIds: string[]
  bodyProfile: BodyProfile
}

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  'rounded-shoulders': '圆肩舒展',
  hunchback: '驼背改善',
  'forward-head': '天鹅颈塑造',
}
