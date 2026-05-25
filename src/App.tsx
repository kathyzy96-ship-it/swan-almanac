import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { CheckCircle2, Inbox, Leaf, LockKeyhole, Sparkles, X } from 'lucide-react'
import { AchievementStudio } from './components/AchievementStudio'
import { ActiveGallery } from './components/ActiveGallery'
import { PendingPool } from './components/PendingPool'
import { mergeDefaultComments, mergeSeedPractices } from './data/seed'
import type { AppData, BodyProfile, CategoryFilter, CheckInLog, PendingLink, Practice, PracticeComment } from './types'
import {
  computeStreak,
  computeTotalCheckIns,
  generateId,
  loadAppData,
  saveBodyProfile,
  saveCheckInLogs,
  saveComments,
  saveDeletedPracticeIds,
  savePendingLinks,
  savePractices,
} from './lib/storage'
import {
  deletePracticeFromCloud,
  getCurrentUser,
  loadCloudData,
  signInAnonymouslyOrDemo,
  signInOrSignUp,
  signOutFromSupabase,
  syncLocalDataToCloud,
  upsertBodyProfile,
  upsertCheckInLog,
  upsertComment,
  upsertPractice,
} from './lib/supabaseSync'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [practices, setPractices] = useState<Practice[]>([])
  const [comments, setComments] = useState<Record<string, PracticeComment[]>>({})
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>([])
  const [deletedPracticeIds, setDeletedPracticeIds] = useState<string[]>([])
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>({})
  const [statAnimKey, setStatAnimKey] = useState(0)
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all')
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authEmail, setAuthEmail] = useState('demo@swan-almanac.local')
  const [authPassword, setAuthPassword] = useState('PrimaSwan2026!')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'cloud'>('local')
  const [isPendingDrawerOpen, setIsPendingDrawerOpen] = useState(false)

  useEffect(() => {
    const boot = async () => {
      const localData = loadAppData()
      const preparedLocalData = applyAndPersistData(localData)

      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)
        await syncUserData(currentUser, preparedLocalData)
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : '云端同步暂时不可用，已继续使用本地数据。')
      }
    }

    void boot()
  }, [])

  function applyAndPersistData(data: AppData): AppData {
    const seededPractices = mergeSeedPractices(data.practices, data.deletedPracticeIds)
    const seededComments = mergeDefaultComments(data.comments, seededPractices)
    const seededPracticeIds = new Set(seededPractices.map((practice) => practice.id))
    const syncedCheckInLogs = data.checkInLogs.filter((log) => seededPracticeIds.has(log.practiceId))
    const nextData = {
      ...data,
      practices: seededPractices,
      comments: seededComments,
      checkInLogs: syncedCheckInLogs,
    }

    setPendingLinks(nextData.pendingLinks)
    setPractices(nextData.practices)
    setComments(nextData.comments)
    setCheckInLogs(nextData.checkInLogs)
    setDeletedPracticeIds(nextData.deletedPracticeIds)
    setBodyProfile(nextData.bodyProfile)
    savePractices(nextData.practices)
    saveComments(nextData.comments)
    saveCheckInLogs(nextData.checkInLogs)
    saveBodyProfile(nextData.bodyProfile)
    return nextData
  }

  function currentAppData(): AppData {
    return {
      pendingLinks,
      practices,
      comments,
      checkInLogs,
      deletedPracticeIds,
      bodyProfile,
    }
  }

  async function syncUserData(currentUser: User, localData = currentAppData()): Promise<void> {
    setSyncStatus('syncing')
    await syncLocalDataToCloud(currentUser.id, localData)
    const cloudData = await loadCloudData(currentUser.id)
    applyAndPersistData({
      ...localData,
      practices: cloudData.practices.length > 0 ? cloudData.practices : localData.practices,
      comments: { ...localData.comments, ...cloudData.comments },
      checkInLogs: cloudData.checkInLogs.length > 0 ? cloudData.checkInLogs : localData.checkInLogs,
      bodyProfile:
        cloudData.bodyProfile.beforeImage || cloudData.bodyProfile.afterImage
          ? cloudData.bodyProfile
          : localData.bodyProfile,
    })
    setSyncStatus('cloud')
  }

  const totalCheckIns = useMemo(() => computeTotalCheckIns(checkInLogs), [checkInLogs])
  const streak = useMemo(() => computeStreak(checkInLogs), [checkInLogs])
  const isLoggedIn = Boolean(user)
  const filteredPractices = useMemo(
    () =>
      activeFilter === 'all'
        ? practices
        : practices.filter((practice) => practice.symptoms.includes(activeFilter)),
    [activeFilter, practices],
  )

  const addPendingLink = (url: string) => {
    const next = [
      {
        id: generateId(),
        url,
        createdAt: new Date().toISOString(),
      },
      ...pendingLinks,
    ]
    setPendingLinks(next)
    savePendingLinks(next)
  }

  const processPractice = async (practice: Practice, pendingId: string) => {
    const nextPractices = [practice, ...practices]
    const nextPending = pendingLinks.filter((link) => link.id !== pendingId)
    const nextComments = {
      ...comments,
      [practice.id]: mergeDefaultComments(comments, [practice])[practice.id],
    }
    setPractices(nextPractices)
    setPendingLinks(nextPending)
    setComments(nextComments)
    savePractices(nextPractices)
    savePendingLinks(nextPending)
    saveComments(nextComments)

    if (user) {
      try {
        await upsertPractice(user.id, practice)
        await syncLocalDataToCloud(user.id, {
          ...currentAppData(),
          practices: nextPractices,
          pendingLinks: nextPending,
          comments: nextComments,
        })
        setSyncStatus('cloud')
      } catch (error) {
        setSyncStatus('local')
        setAuthError(error instanceof Error ? error.message : '动作已保存在本地，云端同步失败。')
      }
    }
  }

  const checkIn = async (practiceId: string) => {
    const newLog = {
      id: generateId(),
      practiceId,
      date: todayKey(),
      timestamp: new Date().toISOString(),
    }
    const nextPractices = practices.map((practice) =>
      practice.id === practiceId
        ? { ...practice, checkInCount: practice.checkInCount + 1 }
        : practice,
    )
    const nextLogs = [...checkInLogs, newLog]
    setPractices(nextPractices)
    setCheckInLogs(nextLogs)
    setStatAnimKey((key) => key + 1)
    savePractices(nextPractices)
    saveCheckInLogs(nextLogs)

    if (user) {
      try {
        const updatedPractice = nextPractices.find((practice) => practice.id === practiceId)
        if (updatedPractice) await upsertPractice(user.id, updatedPractice)
        await upsertCheckInLog(user.id, newLog)
        setSyncStatus('cloud')
      } catch (error) {
        setSyncStatus('local')
        setAuthError(error instanceof Error ? error.message : '练习记录已保存在本地，云端同步失败。')
      }
    }
  }

  const addComment = async (practiceId: string, body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return
    const newComment = {
      id: generateId(),
      practiceId,
      userName: user?.email ?? '当前用户',
      relativeTime: '刚刚',
      body: trimmed,
      avatarTone: 'from-[#DDFBEA] to-[#E2EDF8]',
      createdAt: new Date().toISOString(),
    }

    const nextComments = {
      ...comments,
      [practiceId]: [
        ...(comments[practiceId] ?? []),
        newComment,
      ],
    }
    setComments(nextComments)
    saveComments(nextComments)

    if (user) {
      try {
        await upsertComment(user.id, newComment)
        setSyncStatus('cloud')
      } catch (error) {
        setSyncStatus('local')
        setAuthError(error instanceof Error ? error.message : '日记已保存在本地，云端同步失败。')
      }
    }
  }

  const deletePractice = async (practiceId: string) => {
    const nextPractices = practices.filter((practice) => practice.id !== practiceId)
    const nextLogs = checkInLogs.filter((log) => log.practiceId !== practiceId)
    const nextComments = { ...comments }
    const nextDeletedIds = Array.from(new Set([...deletedPracticeIds, practiceId]))

    delete nextComments[practiceId]
    setPractices(nextPractices)
    setCheckInLogs(nextLogs)
    setComments(nextComments)
    setDeletedPracticeIds(nextDeletedIds)
    savePractices(nextPractices)
    saveCheckInLogs(nextLogs)
    saveComments(nextComments)
    saveDeletedPracticeIds(nextDeletedIds)

    if (user) {
      try {
        await deletePracticeFromCloud(user.id, practiceId)
        setSyncStatus('cloud')
      } catch (error) {
        setSyncStatus('local')
        setAuthError(error instanceof Error ? error.message : '本地已删除，云端删除失败。')
      }
    }
  }

  const updateBodyProfile = async (profile: BodyProfile) => {
    setBodyProfile(profile)
    saveBodyProfile(profile)

    if (user) {
      try {
        await upsertBodyProfile(user.id, profile)
        setSyncStatus('cloud')
      } catch (error) {
        setSyncStatus('local')
        setAuthError(error instanceof Error ? error.message : '体态照片已保存在本地，云端同步失败。')
      }
    }
  }

  const handleEmailAuth = async () => {
    setIsAuthLoading(true)
    setAuthError(null)
    try {
      const authUser = await signInOrSignUp(authEmail, authPassword)
      setUser(authUser)
      await syncUserData(authUser)
      setShowAuthModal(false)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败，请稍后再试。')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleDemoAuth = async () => {
    setIsAuthLoading(true)
    setAuthError(null)
    try {
      const authUser = await signInAnonymouslyOrDemo()
      setUser(authUser)
      await syncUserData(authUser)
      setShowAuthModal(false)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '体验账号登录失败，请检查 Supabase Auth 设置。')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleAuthButtonClick = async () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }

    try {
      await signOutFromSupabase()
      setUser(null)
      setSyncStatus('local')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '退出登录失败。')
    }
  }

  return (
    <main className="min-h-screen bg-[#FBF9F6] text-[#1A1A1A]">
      <header className="relative rounded-b-[40px] bg-gradient-to-b from-[#E2EDF8] via-[#F5F8FC] to-[#FBF9F6] px-8 py-16">
        <div className="absolute right-8 top-7 flex items-center gap-3">
          {user && (
            <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#1A1A1A]/40">
              {syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'cloud' ? 'Cloud' : 'Local'}
            </span>
          )}
          <button
            type="button"
            onClick={handleAuthButtonClick}
            className="text-sm font-bold text-[#1A1A1A]/45 transition-colors hover:text-[#1A1A1A]"
          >
            {user ? 'Logout' : 'Login / Register'}
          </button>
        </div>
        <div className="mx-auto grid max-w-[1500px] items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#35688F] shadow-sm backdrop-blur">
                <Leaf className="h-3.5 w-3.5" strokeWidth={1.5} />
                Mindful actions for a better self
            </div>
            <h1 className="font-sans text-5xl font-black tracking-tight text-[#1A1A1A] md:text-7xl">
              天鹅体态美学指南
            </h1>
            <p className="mt-4 font-sans text-sm font-black uppercase tracking-[0.35em] text-[#1A1A1A]/45 md:text-base">
              THE ELEGANT SWAN RECALIBRATION
            </p>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#1A1A1A]/60">
              为圆肩、驼背、天鹅颈建立一个温暖、清晰、可持续的自律系统。
              从收藏链接开始，把零散灵感沉淀为每天可执行的每日天鹅体态舒展练习。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsPendingDrawerOpen(true)}
                className="relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] px-9 py-4 text-sm font-bold text-white shadow-[0_20px_45px_rgba(255,78,80,0.26),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:from-[#F7B7C8] hover:to-[#F8D7A5] active:scale-[0.98]"
              >
                <Inbox className="h-4 w-4" strokeWidth={1.7} />
                开启蜕变 📥 灵感收藏匣
                <span className="absolute -right-1 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F14C4C] px-2 text-[11px] font-black text-white shadow-[0_8px_20px_rgba(255,78,80,0.26)] ring-2 ring-white/80">
                  {pendingLinks.length}
                </span>
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <img
              src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=85"
              alt="Modern posture training"
              className="aspect-[4/5] w-full rounded-[32px] object-cover shadow-[0_30px_90px_rgba(53,104,143,0.18)]"
            />
            <div className="absolute -right-3 bottom-10 max-w-[310px] rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(255,78,80,0.16)] backdrop-blur-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#DDFBEA] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#117A4A]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Swan glow +1
              </div>
              <p className="text-sm font-bold leading-relaxed text-[#1A1A1A]">
                今天圆肩舒展练习完成！感觉肩膀松开了。
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:px-10">
        <div id="workspace" className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-[32px] border border-[#EAE5DF]/50 bg-white p-8 shadow-sm">
            <ActiveGallery
              practices={filteredPractices}
              allPractices={practices}
              comments={comments}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onCheckIn={checkIn}
              onAddComment={addComment}
              onDeletePractice={deletePractice}
            />
          </div>

          <div className="rounded-[32px] border border-[#EAE5DF]/50 bg-white p-8 shadow-sm">
            <AchievementStudio
              totalCheckIns={totalCheckIns}
              streak={streak}
              bodyProfile={bodyProfile}
              onBodyProfileChange={updateBodyProfile}
              statAnimKey={statAnimKey}
            />
          </div>
        </div>
      </div>
      <footer className="mt-10 rounded-t-[40px] bg-[#1A1A1A] px-8 py-10 text-white md:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-[#F9D423]" />
              Fluid Swan Wellness
            </div>
            <p className="font-sans text-2xl font-black tracking-tight">天鹅体态美学指南</p>
          </div>
          <p className="max-w-md text-right font-sans text-2xl font-black tracking-tight text-white/50">
            Prima.Swan.Almanac
          </p>
        </div>
      </footer>
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/25 px-5 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[32px] border border-white/70 bg-white/85 p-7 shadow-[0_30px_90px_rgba(26,26,26,0.18)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute right-5 top-5 rounded-full bg-white/80 p-2 text-[#1A1A1A]/55 transition-colors hover:text-[#1A1A1A]"
              aria-label="关闭登录提示"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] text-white shadow-[0_18px_45px_rgba(255,78,80,0.24)] transition-all hover:from-[#F7B7C8] hover:to-[#F8D7A5]">
              <LockKeyhole className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h2 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">
              开启云端天鹅练习图文库
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/60">
              登录后自动上传本地练习、优雅记录与体态照片，并在电脑和手机间保持同步。
            </p>
            <div className="mt-6 space-y-3">
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-full border border-[#EAE5DF]/70 bg-white/80 px-5 py-3 text-sm outline-none transition-colors focus:border-[#F7B7C8]"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-full border border-[#EAE5DF]/70 bg-white/80 px-5 py-3 text-sm outline-none transition-colors focus:border-[#F7B7C8]"
              />
            </div>
            {authError && (
              <p className="mt-4 rounded-2xl bg-[#FFF0EB] px-4 py-3 text-xs font-bold leading-relaxed text-[#D95745]">
                {authError}
              </p>
            )}
            <button
              type="button"
              onClick={handleEmailAuth}
              disabled={isAuthLoading}
              className="mt-7 w-full rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] py-3.5 text-sm font-bold text-white shadow-[0_18px_45px_rgba(255,78,80,0.24),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:from-[#F7B7C8] hover:to-[#F8D7A5] active:scale-[0.98]"
            >
              {isAuthLoading ? '正在同步云端...' : '邮箱登录 / 注册'}
            </button>
            <button
              type="button"
              onClick={handleDemoAuth}
              disabled={isAuthLoading}
              className="mt-3 w-full rounded-full bg-[#1A1A1A] py-3 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              匿名体验账号登录
            </button>
          </div>
        </div>
      )}
      {isPendingDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-[#1A1A1A]/25 backdrop-blur-sm" onClick={() => setIsPendingDrawerOpen(false)}>
          <aside
            className="ml-auto flex h-full w-full max-w-xl animate-drawer-slide-in flex-col overflow-y-auto rounded-l-[40px] border-l border-white/70 bg-white/85 p-6 shadow-[0_30px_90px_rgba(26,26,26,0.22)] backdrop-blur-xl md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                  <Inbox className="h-3.5 w-3.5" />
                  Inspiration Box
                </div>
                <h2 className="font-sans text-3xl font-black tracking-tight text-[#1A1A1A]">灵感收藏匣</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/55">
                  快存灵感链接，在这里提炼成你的私人天鹅体态练习库。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPendingDrawerOpen(false)}
                className="rounded-full bg-white p-3 text-[#1A1A1A]/55 shadow-sm transition-colors hover:text-[#1A1A1A]"
                aria-label="关闭灵感收藏匣"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <PendingPool
              pendingLinks={pendingLinks}
              onQuickSave={addPendingLink}
              onProcess={(practice, pendingId) => {
                processPractice(practice, pendingId)
                setIsPendingDrawerOpen(false)
              }}
              isLoggedIn={isLoggedIn}
            />
          </aside>
        </div>
      )}
    </main>
  )
}
