import { Dumbbell, ExternalLink, MessageCircle, Send, SlidersHorizontal, Sparkles, Target, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState, SectionLabel, SymptomBadge } from './ui'
import type { CategoryFilter, Practice, PracticeComment } from '../types'
import { SYMPTOM_LABELS } from '../types'

interface ActiveGalleryProps {
  practices: Practice[]
  allPractices: Practice[]
  comments: Record<string, PracticeComment[]>
  activeFilter: CategoryFilter
  onFilterChange: (filter: CategoryFilter) => void
  onCheckIn: (practiceId: string) => void
  onAddComment: (practiceId: string, body: string) => void
  onDeletePractice: (practiceId: string) => void
}

const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: '全部练功房' },
  { value: 'rounded-shoulders', label: SYMPTOM_LABELS['rounded-shoulders'] },
  { value: 'hunchback', label: SYMPTOM_LABELS.hunchback },
  { value: 'forward-head', label: SYMPTOM_LABELS['forward-head'] },
]

interface PracticeCardProps {
  practice: Practice
  comments: PracticeComment[]
  onCheckIn: (practiceId: string) => void
  onAddComment: (practiceId: string, body: string) => void
  onDeletePractice: (practiceId: string) => void
}

type TimerStatus = 'idle' | 'running' | 'done'

function TimerDial({ status, remaining }: { status: TimerStatus; remaining: number }) {
  if (status === 'idle') return null

  const progress = ((60 - remaining) / 60) * 100

  return (
    <div className="animate-fade-slide-in rounded-[28px] border border-[#DDEADF]/80 bg-gradient-to-br from-[#F3FAF5] to-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#6B8E7D ${progress}%, rgba(107,142,125,0.14) ${progress}% 100%)`,
          }}
        >
          <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-white text-sm font-black text-[#1A1A1A] shadow-inner">
            {status === 'done' ? 'OK' : `${remaining}s`}
          </div>
        </div>
        <div>
          <p className="text-sm font-black tracking-tight text-[#1A1A1A]">
            {status === 'done' ? '优雅值 +1 🦢✨' : '正在优雅延伸中...'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#1A1A1A]/55">
            {status === 'done' ? '这次练习已写入今日优雅记录。' : '请像芭蕾舞者一样保持呼吸 🦢'}
          </p>
        </div>
      </div>
    </div>
  )
}

function useMindfulTimer(onComplete: () => void) {
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [remaining, setRemaining] = useState(60)

  useEffect(() => {
    if (status !== 'running') return

    const timerId = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timerId)
          setStatus('done')
          onComplete()
          return 0
        }

        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [onComplete, status])

  const start = () => {
    if (status === 'running') return
    setRemaining(60)
    setStatus('running')
  }

  const reset = () => {
    setRemaining(60)
    setStatus('idle')
  }

  return { status, remaining, start, reset }
}

function SurpriseMeCard({
  practices,
  onCheckIn,
}: {
  practices: Practice[]
  onCheckIn: (practiceId: string) => void
}) {
  const [selected, setSelected] = useState<Practice | null>(null)
  const [revealKey, setRevealKey] = useState(0)
  const timer = useMindfulTimer(() => {
    if (selected) {
      onCheckIn(selected.id)
    }
  })

  const revealPractice = () => {
    if (practices.length === 0) return
    const next = practices[Math.floor(Math.random() * practices.length)]
    setSelected(next)
    timer.reset()
    setRevealKey((key) => key + 1)
  }

  return (
    <section className="rounded-[32px] border border-[#EAE5DF]/50 bg-gradient-to-br from-[#E7F0E9] via-[#F5F3EA] to-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#6B8E7D] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Surprise Recovery
          </div>
          <h3 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">
            今日天鹅盲盒练习 🎯
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">
            今天练什么？点击让 AI 为您随机抽取一门芭蕾级体态微操，一起变成优雅白天鹅。
          </p>
        </div>
        <button
          type="button"
          onClick={revealPractice}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1A1A1A] px-7 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(26,26,26,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:scale-[1.02] hover:bg-[#2A2024] active:scale-[0.98]"
        >
          <Target className="h-4 w-4" />
          Surprise me 🩰
        </button>
      </div>

      {selected && (
        <div key={revealKey} className="mt-5 animate-fade-slide-in rounded-[28px] bg-white/75 p-5 shadow-sm ring-1 ring-white/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {selected.symptoms.map((symptom) => (
                  <SymptomBadge key={symptom} label={SYMPTOM_LABELS[symptom]} />
                ))}
              </div>
              <p className="font-sans text-xl font-black tracking-tight text-[#1A1A1A]">{selected.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/55">{selected.steps[0]}</p>
            </div>
            <button
              type="button"
              onClick={timer.start}
              className="rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] px-6 py-3 text-sm font-bold text-white shadow-[0_18px_45px_rgba(255,78,80,0.24),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:from-[#F7B7C8] hover:to-[#F8D7A5] active:scale-[0.98]"
            >
              盲盒优雅练习
            </button>
          </div>
          <div className="mt-4">
            <TimerDial status={timer.status} remaining={timer.remaining} />
          </div>
        </div>
      )}
    </section>
  )
}

function PracticeCard({ practice, comments, onCheckIn, onAddComment, onDeletePractice }: PracticeCardProps) {
  const [animKey, setAnimKey] = useState(0)
  const [commentInput, setCommentInput] = useState('')
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const timer = useMindfulTimer(() => {
    onCheckIn(practice.id)
    setAnimKey((key) => key + 1)
  })

  const handleSendComment = () => {
    if (!commentInput.trim()) return
    onAddComment(practice.id, commentInput)
    setCommentInput('')
  }

  const handleDelete = () => {
    if (window.confirm(`确认删除「${practice.name}」吗？相关日记和练习记录也会同步清理。`)) {
      onDeletePractice(practice.id)
    }
  }

  return (
    <article className="flex flex-col gap-6 rounded-[32px] border border-[#EAE5DF]/50 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(26,26,26,0.08)]">
      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {practice.symptoms.map((symptom) => (
                <SymptomBadge key={symptom} label={SYMPTOM_LABELS[symptom]} />
              ))}
            </div>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0EB] px-3 py-1.5 text-xs font-black text-[#D95745] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              删除
            </button>
          </div>
          <div>
            <h3 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">
              {practice.name}
            </h3>
            <a
              href={practice.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#F2F7FF] px-3 py-1.5 text-xs font-bold text-[#35688F] transition-colors hover:text-[#1A1A1A]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              原贴链接 ↗
            </a>
          </div>
          <ol className="space-y-3">
            {practice.steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed text-[#1A1A1A]/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-xs font-bold text-white shadow-sm">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {practice.imageUrl && (
          <img
            src={practice.imageUrl}
            alt={practice.name}
            className="h-full min-h-[220px] w-full rounded-[24px] border border-[#EAE5DF]/50 object-cover shadow-sm"
          />
        )}
      </div>

      <button
        type="button"
        onClick={timer.start}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] py-3.5 text-sm font-bold text-white shadow-[0_18px_45px_rgba(255,78,80,0.24),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:from-[#F7B7C8] hover:to-[#F8D7A5] active:scale-[0.98]"
      >
        今日优雅舒展 Swan Extension
        <span
          key={animKey}
          className="inline-flex min-w-[1.5rem] animate-count-pop items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold"
        >
          {practice.checkInCount}
        </span>
      </button>

      <TimerDial status={timer.status} remaining={timer.remaining} />

      <button
        type="button"
        onClick={() => setIsCommentsOpen((value) => !value)}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F2F7FF] px-4 py-2 text-xs font-black text-[#35688F] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        💬 {comments.length}条天鹅女孩互助日记
      </button>

      {isCommentsOpen && (
        <section className="animate-fade-slide-in rounded-[28px] border border-white/70 bg-gradient-to-br from-[#F8FBFF]/90 to-white/70 p-5 shadow-sm ring-1 ring-[#EAE5DF]/40 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A1A] text-white shadow-sm">
              <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
            </span>
            <div>
              <p className="text-sm font-black tracking-tight text-[#1A1A1A]">天鹅女孩互助日记</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A]/35">
                Comments
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {comments.map((comment) => (
              <article key={comment.id} className="rounded-[22px] bg-white/75 p-4 shadow-sm ring-1 ring-[#EAE5DF]/35">
                <div className="flex gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${comment.avatarTone} text-sm font-black text-white shadow-sm`}
                  >
                    {comment.userName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black text-[#1A1A1A]">{comment.userName}</p>
                      <span className="text-[11px] font-bold text-[#1A1A1A]/35">{comment.relativeTime}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A]/65">{comment.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 flex gap-2 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-[#EAE5DF]/45">
            <input
              type="text"
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSendComment()}
              placeholder="分享你的天鹅体态练习感受…"
              className="min-w-0 flex-1 rounded-full px-4 py-2 text-xs text-[#1A1A1A] outline-none placeholder:text-[#1A1A1A]/35"
            />
            <button
              type="button"
              onClick={handleSendComment}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-white transition-all hover:scale-[1.04] active:scale-[0.96]"
              aria-label="发送评论"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </section>
      )}
    </article>
  )
}

export function ActiveGallery({
  practices,
  allPractices,
  comments,
  activeFilter,
  onFilterChange,
  onCheckIn,
  onAddComment,
  onDeletePractice,
}: ActiveGalleryProps) {
  const filterLabel = activeFilter === 'all' ? '全部练功房' : SYMPTOM_LABELS[activeFilter]

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <SectionLabel>Active Gallery · 天鹅练功房</SectionLabel>
          <h2 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">你的天鹅体态练习库</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">
            当前筛选：{filterLabel}。已提炼的舒展卡片，随时练习，持续雕刻优雅体态。
          </p>
        </div>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[#EAE5DF]/50 bg-white/80 p-1.5 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F7FF] text-[#35688F] shadow-sm">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.7} />
          </span>
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
                activeFilter === option.value
                  ? 'bg-[#1A1A1A] text-white shadow-[0_10px_24px_rgba(26,26,26,0.14)]'
                  : 'text-[#1A1A1A]/55 hover:bg-[#F8FAFC] hover:text-[#1A1A1A]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <SurpriseMeCard practices={allPractices} onCheckIn={onCheckIn} />

      {practices.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="暂无练习"
          description="切换筛选条件，或在灵感收藏匣提炼新的天鹅体态练习。"
        />
      ) : (
        <div className="grid gap-6">
          {practices.map((practice) => (
            <PracticeCard
              key={practice.id}
              practice={practice}
              comments={comments[practice.id] ?? []}
              onCheckIn={onCheckIn}
              onAddComment={onAddComment}
              onDeletePractice={onDeletePractice}
            />
          ))}
        </div>
      )}
    </section>
  )
}
