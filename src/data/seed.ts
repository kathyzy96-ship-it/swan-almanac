import type { Practice, PracticeComment } from '../types'

export const SEED_PRACTICES: Practice[] = [
  {
    id: 'seed-wall-w-stretch',
    sourceUrl: 'https://www.xiaohongshu.com/explore/wall-w-swan-shoulders',
    name: '直角肩 · 墙面W字舒展',
    symptoms: ['rounded-shoulders'],
    steps: [
      '背部紧贴墙壁，双臂呈W字',
      '呼气时向下压实肩膀，肩胛骨靠拢',
      '持续30秒',
    ],
    imageUrl: 'https://media.giphy.com/media/kwRehVjkmKyde0TxdQ/giphy.gif',
    checkInCount: 0,
    createdAt: '2026-05-01T00:00:01.000Z',
  },
]

const DEPRECATED_SEED_PRACTICE_IDS = new Set([
  'seed-wall-chin-tuck',
  'seed-kneeling-thoracic-opener',
])

const DEFAULT_COMMENT_BODY = [
  {
    id: 'factory-worker',
    userName: '久坐大厂搬砖工',
    relativeTime: '3天前',
    body: '跟着做完第 2 步，听到后背骨头咔哒响了一声，沉重的肩膀瞬间轻松了！亲测有效！',
    avatarTone: 'from-[#E2EDF8] to-[#F9D423]',
  },
  {
    id: 'selina',
    userName: '圆肩少女Selina',
    relativeTime: '5天前',
    body: '这个靠墙W字真的绝了，每天办公室摸鱼时做 3 组，一周后同事说我体态变挺拔了。',
    avatarTone: 'from-[#FF4E50] to-[#F9D423]',
  },
]

export function createDefaultComments(practiceId: string): PracticeComment[] {
  return DEFAULT_COMMENT_BODY.map((comment) => ({
    ...comment,
    id: `${practiceId}-${comment.id}`,
    practiceId,
  }))
}

export function mergeSeedPractices(practices: Practice[], deletedPracticeIds: string[] = []): Practice[] {
  const seedById = new Map(SEED_PRACTICES.map((practice) => [practice.id, practice]))
  const deletedIds = new Set(deletedPracticeIds)
  const refreshedPractices = practices.flatMap((practice) => {
    if (DEPRECATED_SEED_PRACTICE_IDS.has(practice.id)) return []

    const seedPractice = seedById.get(practice.id)
    if (!seedPractice || deletedIds.has(practice.id)) return [practice]

    return [{
      ...seedPractice,
      checkInCount: practice.checkInCount,
      createdAt: practice.createdAt,
    }]
  })
  const existingIds = new Set(refreshedPractices.map((practice) => practice.id))
  const missingSeeds = SEED_PRACTICES.filter(
    (practice) => !existingIds.has(practice.id) && !deletedIds.has(practice.id),
  )
  return [...missingSeeds, ...refreshedPractices]
}

export function mergeDefaultComments(
  comments: Record<string, PracticeComment[]>,
  practices: Practice[],
): Record<string, PracticeComment[]> {
  return practices.reduce<Record<string, PracticeComment[]>>((next, practice) => {
    next[practice.id] = comments[practice.id]?.length
      ? comments[practice.id]
      : createDefaultComments(practice.id)
    return next
  }, {})
}
