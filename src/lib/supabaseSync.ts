import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import type { AppData, BodyProfile, CheckInLog, Practice, PracticeComment } from '../types'

type PracticeRow = {
  id: string
  user_id: string
  source_url: string
  name: string
  symptoms: string[]
  steps: string[]
  image_url: string | null
  check_in_count: number
  created_at: string
  is_public: boolean
  created_by: string | null
}

type CheckInRow = {
  id: string
  user_id: string
  practice_id: string
  date: string
  timestamp: string
}

type CommentRow = {
  id: string
  user_id: string
  practice_id: string
  user_name: string
  relative_time: string
  body: string
  avatar_tone: string
  created_at: string
}

type ProfileRow = {
  user_id: string
  before_image: string | null
  after_image: string | null
  updated_at: string
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function signInOrSignUp(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase()
  const signInResult = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

  if (signInResult.data.user) return signInResult.data.user

  const signUpResult = await supabase.auth.signUp({ email: normalizedEmail, password })
  if (signUpResult.error) throw signUpResult.error
  if (!signUpResult.data.user) throw new Error('登录失败，请检查邮箱或密码。')

  return signUpResult.data.user
}

export async function signInAnonymouslyOrDemo(): Promise<User> {
  const anonymousResult = await supabase.auth.signInAnonymously()
  if (anonymousResult.data.user) return anonymousResult.data.user

  return signInOrSignUp('demo@swan-almanac.local', 'PrimaSwan2026!')
}

export async function signOutFromSupabase(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function loadCloudData(userId: string): Promise<Pick<AppData, 'practices' | 'checkInLogs' | 'comments' | 'bodyProfile'>> {
  const [{ data: practiceRows, error: practicesError }, { data: logRows, error: logsError }] = await Promise.all([
    supabase.from('practices').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('checkin_logs').select('*').eq('user_id', userId).order('timestamp', { ascending: true }),
  ])

  if (practicesError) throw practicesError
  if (logsError) throw logsError

  const [{ data: commentRows }, { data: profileRows }] = await Promise.all([
    supabase.from('practice_comments').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('user_profiles').select('*').eq('user_id', userId).limit(1),
  ])

  return {
    practices: ((practiceRows ?? []) as PracticeRow[]).map(fromPracticeRow),
    checkInLogs: ((logRows ?? []) as CheckInRow[]).map(fromCheckInRow),
    comments: groupComments((commentRows ?? []) as CommentRow[]),
    bodyProfile: fromProfileRow((profileRows?.[0] as ProfileRow | undefined) ?? undefined),
  }
}

export async function loadPublicPractices(): Promise<Practice[]> {
  const { data, error } = await supabase
    .from('practices')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as PracticeRow[]).map(fromPracticeRow)
}

export async function uploadActionImage(userId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() || 'png'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('action-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from('action-images').getPublicUrl(path)
  return data.publicUrl
}

export async function syncLocalDataToCloud(userId: string, data: AppData): Promise<void> {
  await Promise.all([
    upsertPractices(userId, data.practices),
    upsertCheckInLogs(userId, data.checkInLogs),
    upsertComments(userId, data.comments),
    upsertBodyProfile(userId, data.bodyProfile),
  ])
}

export async function upsertPractices(userId: string, practices: Practice[]): Promise<void> {
  if (practices.length === 0) return
  const { error } = await supabase.from('practices').upsert(practices.map((practice) => toPracticeRow(userId, practice)))
  if (error) throw error
}

export async function upsertPractice(userId: string, practice: Practice): Promise<void> {
  await upsertPractices(userId, [practice])
}

export async function upsertCheckInLogs(userId: string, logs: CheckInLog[]): Promise<void> {
  if (logs.length === 0) return
  const { error } = await supabase.from('checkin_logs').upsert(logs.map((log) => toCheckInRow(userId, log)))
  if (error) throw error
}

export async function upsertCheckInLog(userId: string, log: CheckInLog): Promise<void> {
  await upsertCheckInLogs(userId, [log])
}

export async function upsertComments(userId: string, comments: Record<string, PracticeComment[]>): Promise<void> {
  const rows = Object.values(comments).flat().map((comment) => toCommentRow(userId, comment))
  if (rows.length === 0) return
  const { error } = await supabase.from('practice_comments').upsert(rows)
  if (error) throw error
}

export async function upsertComment(userId: string, comment: PracticeComment): Promise<void> {
  const { error } = await supabase.from('practice_comments').upsert(toCommentRow(userId, comment))
  if (error) throw error
}

export async function upsertBodyProfile(userId: string, bodyProfile: BodyProfile): Promise<void> {
  const { error } = await supabase.from('user_profiles').upsert({
    user_id: userId,
    before_image: bodyProfile.beforeImage ?? null,
    after_image: bodyProfile.afterImage ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deletePracticeFromCloud(userId: string, practiceId: string): Promise<void> {
  await Promise.all([
    supabase.from('practice_comments').delete().eq('user_id', userId).eq('practice_id', practiceId),
    supabase.from('checkin_logs').delete().eq('user_id', userId).eq('practice_id', practiceId),
    supabase.from('practices').delete().eq('user_id', userId).eq('id', practiceId),
  ])
}

function toPracticeRow(userId: string, practice: Practice): PracticeRow {
  return {
    id: practice.id,
    user_id: userId,
    source_url: practice.sourceUrl,
    name: practice.name,
    symptoms: practice.symptoms,
    steps: practice.steps,
    image_url: practice.imageUrl ?? null,
    check_in_count: practice.checkInCount,
    created_at: practice.createdAt,
    is_public: practice.isPublic ?? true,
    created_by: practice.createdBy ?? userId,
  }
}

function fromPracticeRow(row: PracticeRow): Practice {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    name: row.name,
    symptoms: row.symptoms as Practice['symptoms'],
    steps: row.steps as Practice['steps'],
    imageUrl: row.image_url ?? undefined,
    checkInCount: row.check_in_count,
    createdAt: row.created_at,
    isPublic: row.is_public ?? true,
    createdBy: row.created_by ?? row.user_id,
  }
}

function toCheckInRow(userId: string, log: CheckInLog): CheckInRow {
  return {
    id: log.id,
    user_id: userId,
    practice_id: log.practiceId,
    date: log.date,
    timestamp: log.timestamp,
  }
}

function fromCheckInRow(row: CheckInRow): CheckInLog {
  return {
    id: row.id,
    practiceId: row.practice_id,
    date: row.date,
    timestamp: row.timestamp,
  }
}

function toCommentRow(userId: string, comment: PracticeComment): CommentRow {
  return {
    id: comment.id,
    user_id: userId,
    practice_id: comment.practiceId,
    user_name: comment.userName,
    relative_time: comment.relativeTime,
    body: comment.body,
    avatar_tone: comment.avatarTone,
    created_at: comment.createdAt ?? new Date().toISOString(),
  }
}

function fromCommentRow(row: CommentRow): PracticeComment {
  return {
    id: row.id,
    practiceId: row.practice_id,
    userName: row.user_name,
    relativeTime: row.relative_time,
    body: row.body,
    avatarTone: row.avatar_tone,
    createdAt: row.created_at,
  }
}

function groupComments(rows: CommentRow[]): Record<string, PracticeComment[]> {
  return rows.reduce<Record<string, PracticeComment[]>>((acc, row) => {
    const comment = fromCommentRow(row)
    acc[comment.practiceId] = [...(acc[comment.practiceId] ?? []), comment]
    return acc
  }, {})
}

function fromProfileRow(row?: ProfileRow): BodyProfile {
  return {
    beforeImage: row?.before_image ?? undefined,
    afterImage: row?.after_image ?? undefined,
  }
}
