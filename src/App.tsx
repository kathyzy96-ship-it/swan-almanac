import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Inbox, Leaf, LockKeyhole, Plus, Sparkles, X } from 'lucide-react'
import { AchievementStudio } from './components/AchievementStudio'
import { ActiveGallery, SharePracticeModal, SurpriseMeCard } from './components/ActiveGallery'
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
  loadPublicPractices,
  signInAnonymouslyOrDemo,
  signInWithEmail,
  signUpWithEmail,
  signOutFromSupabase,
  syncLocalDataToCloud,
  uploadActionImage,
  upsertBodyProfile,
  upsertCheckInLog,
  upsertComment,
  upsertPractice,
} from './lib/supabaseSync'
import type { GalleryScope } from './types'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [practices, setPractices] = useState<Practice[]>([])
  const [communityPractices, setCommunityPractices] = useState<Practice[]>([])
  const [comments, setComments] = useState<Record<string, PracticeComment[]>>({})
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>([])
  const [deletedPracticeIds, setDeletedPracticeIds] = useState<string[]>([])
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>({})
  const [statAnimKey, setStatAnimKey] = useState(0)
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all')
  const [galleryScope, setGalleryScope] = useState<GalleryScope>('community')
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authEmail, setAuthEmail] = useState('demo@swan-almanac.local')
  const [authPassword, setAuthPassword] = useState('PrimaSwan2026!')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [isSignUpMode, setIsSignUpMode] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'cloud'>('local')
  const [isPendingDrawerOpen, setIsPendingDrawerOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)

  useEffect(() => {
    const boot = async () => {
      const localData = loadAppData()
      const preparedLocalData = applyAndPersistData(localData)

      try {
        await refreshPublicHall(preparedLocalData.practices)
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

  async function refreshPublicHall(fallbackPractices = practices): Promise<void> {
    try {
      const publicPractices = await loadPublicPractices()
      setCommunityPractices(publicPractices.length > 0 ? publicPractices : fallbackPractices.filter((practice) => practice.isPublic ?? true))
    } catch {
      setCommunityPractices(fallbackPractices.filter((practice) => practice.isPublic ?? true))
    }
  }

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
    setCommunityPractices((current) => (current.length > 0 ? current : nextData.practices.filter((practice) => practice.isPublic ?? true)))
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
    await refreshPublicHall(cloudData.practices.length > 0 ? cloudData.practices : localData.practices)
    setSyncStatus('cloud')
  }

  const totalCheckIns = useMemo(() => computeTotalCheckIns(checkInLogs), [checkInLogs])
  const streak = useMemo(() => computeStreak(checkInLogs), [checkInLogs])
  const isLoggedIn = Boolean(user)
  const visiblePractices = galleryScope === 'community' ? communityPractices : practices
  const filteredPractices = useMemo(
    () =>
      activeFilter === 'all'
        ? visiblePractices
        : visiblePractices.filter((practice) => practice.symptoms.includes(activeFilter)),
    [activeFilter, visiblePractices],
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

  const processPractice = async (practice: Practice, pendingId: string, imageFile?: File) => {
    let nextPractice = { ...practice, createdBy: user?.id ?? practice.createdBy, isPublic: practice.isPublic ?? true }
    if (user && imageFile) {
      try {
        nextPractice = { ...nextPractice, imageUrl: await uploadActionImage(user.id, imageFile) }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : '图片已本地预览，上传云端 Storage 失败。')
      }
    }

    const nextPractices = [nextPractice, ...practices]
    const nextPending = pendingLinks.filter((link) => link.id !== pendingId)
    const nextComments = {
      ...comments,
      [nextPractice.id]: mergeDefaultComments(comments, [nextPractice])[nextPractice.id],
    }
    setPractices(nextPractices)
    if (nextPractice.isPublic) {
      setCommunityPractices((current) => [nextPractice, ...current.filter((item) => item.id !== nextPractice.id)])
    }
    setPendingLinks(nextPending)
    setComments(nextComments)
    savePractices(nextPractices)
    savePendingLinks(nextPending)
    saveComments(nextComments)

    if (user) {
      try {
        await upsertPractice(user.id, nextPractice)
        await syncLocalDataToCloud(user.id, {
          ...currentAppData(),
          practices: nextPractices,
          pendingLinks: nextPending,
          comments: nextComments,
        })
        if (nextPractice.isPublic) await refreshPublicHall(nextPractices)
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
    const nextCommunityPractices = communityPractices.map((practice) =>
      practice.id === practiceId
        ? { ...practice, checkInCount: practice.checkInCount + 1 }
        : practice,
    )
    const nextLogs = [...checkInLogs, newLog]
    setPractices(nextPractices)
    setCommunityPractices(nextCommunityPractices)
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
    setCommunityPractices((current) => current.filter((practice) => practice.id !== practiceId))
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

  const sharePractice = async (practice: Practice, imageFile?: File) => {
    if (!user) {
      setShowAuthModal(true)
      return
    }

    setSyncStatus('syncing')
    try {
      const imageUrl = imageFile ? await uploadActionImage(user.id, imageFile) : practice.imageUrl
      const nextPractice = {
        ...practice,
        imageUrl,
        createdBy: user.id,
      }
      const nextPractices = [nextPractice, ...practices.filter((item) => item.id !== nextPractice.id)]
      setPractices(nextPractices)
      savePractices(nextPractices)
      await upsertPractice(user.id, nextPractice)
      await refreshPublicHall(nextPractices)
      setGalleryScope(nextPractice.isPublic ? 'community' : 'mine')
      setSyncStatus('cloud')
    } catch (error) {
      setSyncStatus('local')
      setAuthError(error instanceof Error ? error.message : '秘籍已保存在本地前失败，请检查 Storage 或数据库设置。')
    }
  }

  const handleEmailAuth = async () => {
    setIsAuthLoading(true)
    setAuthError(null)
    setAuthNotice(null)
    try {
      const authUser = isSignUpMode
        ? await signUpWithEmail(authEmail, authPassword)
        : await signInWithEmail(authEmail, authPassword)
      setUser(authUser)
      await syncUserData(authUser)
      if (isSignUpMode) {
        setAuthNotice('注册成功！已为您自动登录云端空间 🦢✨')
        window.setTimeout(() => {
          setShowAuthModal(false)
          setAuthNotice(null)
          setIsSignUpMode(false)
        }, 900)
      } else {
        setShowAuthModal(false)
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : isSignUpMode ? '注册失败，请稍后再试。' : '登录失败，请稍后再试。')
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

  const openShareStudio = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    setIsShareOpen(true)
  }

  return (
    <main className="min-h-screen bg-[#FBF9F6] text-[#1A1A1A]">
      <header className="relative rounded-b-[32px] bg-gradient-to-b from-[#E2EDF8] via-[#F5F8FC] to-[#FBF9F6] px-5 pb-8 pt-14 md:rounded-b-[40px] md:px-8 md:py-16">
        <div className="absolute right-5 top-5 flex items-center gap-3 md:right-8 md:top-7">
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
        <div className="mx-auto max-w-4xl text-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#35688F] shadow-sm backdrop-blur md:mb-5 md:text-xs">
                <Leaf className="h-3.5 w-3.5" strokeWidth={1.5} />
                Mindful actions for a better self
            </div>
            <h1 className="font-sans text-3xl font-black tracking-tight text-[#1A1A1A] md:text-7xl">
              天鹅体态美学指南
            </h1>
            <p className="mt-3 font-sans text-xs font-black uppercase tracking-[0.25em] text-[#1A1A1A]/45 md:mt-4 md:text-base md:tracking-[0.35em]">
              THE ELEGANT SWAN RECALIBRATION
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#1A1A1A]/60 md:mt-6 md:text-base">
              为圆肩、驼背、天鹅颈建立一个温暖、清晰、可持续的自律系统。
              从收藏链接开始，把零散灵感沉淀为每天可执行的每日天鹅体态舒展练习。
            </p>
            <div className="mt-6 md:mt-8">
              <SurpriseMeCard practices={visiblePractices} onCheckIn={checkIn} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-8 md:py-10 lg:px-10">
        <div id="workspace" className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-[28px] border border-[#EAE5DF]/50 bg-white p-4 shadow-sm md:rounded-[32px] md:p-8">
            <ActiveGallery
              practices={filteredPractices}
              comments={comments}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onCheckIn={checkIn}
              onAddComment={addComment}
              onDeletePractice={deletePractice}
              galleryScope={galleryScope}
              onGalleryScopeChange={setGalleryScope}
              isLoggedIn={isLoggedIn}
              onRequireLogin={() => setShowAuthModal(true)}
            />
          </div>

          <div className="rounded-[28px] border border-[#EAE5DF]/50 bg-white p-4 shadow-sm md:rounded-[32px] md:p-8">
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
      <section className="mx-auto max-w-[1500px] px-4 pb-8 md:px-8 lg:px-10">
        <div className="rounded-[32px] border border-[#EAE5DF]/50 bg-white/75 p-4 shadow-sm backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-sans text-[10px] font-black uppercase tracking-[0.24em] text-[#1A1A1A]/35">
                Swan Co-Creation Toolbox
              </p>
              <h2 className="mt-2 font-sans text-xl font-black tracking-tight text-[#1A1A1A]">
                白天鹅共建工具箱
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:flex">
              <button
                type="button"
                onClick={() => setIsPendingDrawerOpen(true)}
                className="relative inline-flex items-center justify-center gap-2 rounded-full border border-[#EAE5DF]/70 bg-white px-4 py-3 text-xs font-black text-[#1A1A1A] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] md:px-6"
              >
                <Inbox className="h-4 w-4" strokeWidth={1.7} />
                灵感收藏匣
                <span className="absolute -right-1 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F14C4C] px-1.5 text-[10px] font-black text-white ring-2 ring-white">
                  {pendingLinks.length}
                </span>
              </button>
              <button
                type="button"
                onClick={openShareStudio}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1A1A1A] px-4 py-3 text-xs font-black text-white shadow-[0_14px_35px_rgba(26,26,26,0.14)] transition-all hover:scale-[1.02] active:scale-[0.98] md:px-6"
              >
                <Plus className="h-4 w-4" strokeWidth={1.7} />
                分享我的天鹅秘籍
              </button>
            </div>
          </div>
        </div>
      </section>
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
              onClick={() => {
                setShowAuthModal(false)
                setAuthError(null)
                setAuthNotice(null)
              }}
              className="absolute right-5 top-5 rounded-full bg-white/80 p-2 text-[#1A1A1A]/55 transition-colors hover:text-[#1A1A1A]"
              aria-label="关闭登录提示"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] text-white shadow-[0_18px_45px_rgba(255,78,80,0.24)] transition-all hover:from-[#F7B7C8] hover:to-[#F8D7A5]">
              <LockKeyhole className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h2 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">
              {isSignUpMode ? '创建你的天鹅美学账户' : '开启云端天鹅练习图文库'}
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
            <button
              type="button"
              onClick={() => {
                setIsSignUpMode((value) => !value)
                setAuthError(null)
                setAuthNotice(null)
              }}
              className="mt-4 text-xs font-bold text-[#1A1A1A]/45 transition-colors hover:text-[#1A1A1A]"
            >
              {isSignUpMode ? '已有账号？返回登录 ↗' : '没有账号？切换到注册 ↗'}
            </button>
            {authNotice && (
              <p className="mt-4 rounded-2xl bg-[#DDFBEA] px-4 py-3 text-xs font-bold leading-relaxed text-[#117A4A]">
                {authNotice}
              </p>
            )}
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
              {isAuthLoading ? '正在同步云端...' : isSignUpMode ? '创建新账号并登录' : '邮箱登录'}
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
      {isShareOpen && (
        <SharePracticeModal
          onClose={() => setIsShareOpen(false)}
          onSubmit={sharePractice}
        />
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
              onProcess={(practice, pendingId, imageFile) => {
                processPractice(practice, pendingId, imageFile)
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
