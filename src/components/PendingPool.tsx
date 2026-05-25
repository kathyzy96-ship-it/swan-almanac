import { ExternalLink, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ImageUploader, SectionLabel } from './ui'
import type { PendingLink, Practice, Symptom } from '../types'
import { SYMPTOM_LABELS } from '../types'
import { generateId } from '../lib/storage'

interface PendingPoolProps {
  pendingLinks: PendingLink[]
  onQuickSave: (url: string) => void
  onProcess: (practice: Practice, pendingId: string, imageFile?: File) => void
  isLoggedIn?: boolean
  onRequireLogin?: () => void
}

const ALL_SYMPTOMS: Symptom[] = ['rounded-shoulders', 'hunchback', 'forward-head']

type ProcessForm = {
  name: string
  symptoms: Symptom[]
  steps: string[]
  imageUrl?: string
  imageFile?: File
}

const emptyForm = (): ProcessForm => ({
  name: '',
  symptoms: [],
  steps: ['', '', ''],
})

export function PendingPool({
  pendingLinks,
  onQuickSave,
  onProcess,
}: PendingPoolProps) {
  const [urlInput, setUrlInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, ProcessForm>>({})

  const handleQuickSave = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    onQuickSave(trimmed)
    setUrlInput('')
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!forms[id]) {
      setForms((prev) => ({ ...prev, [id]: emptyForm() }))
    }
  }

  const updateForm = (id: string, patch: Partial<ProcessForm>) => {
    setForms((prev) => ({
      ...prev,
      [id]: { ...prev[id] ?? emptyForm(), ...patch },
    }))
  }

  const toggleSymptom = (id: string, symptom: Symptom) => {
    const form = forms[id] ?? emptyForm()
    const symptoms = form.symptoms.includes(symptom)
      ? form.symptoms.filter((s) => s !== symptom)
      : [...form.symptoms, symptom]
    updateForm(id, { symptoms })
  }

  const updateStep = (id: string, index: number, value: string) => {
    const form = forms[id] ?? emptyForm()
    const steps = [...form.steps]
    steps[index] = value
    updateForm(id, { steps })
  }

  const handleSave = (pending: PendingLink) => {
    const form = forms[pending.id] ?? emptyForm()
    if (!form.name.trim() || form.symptoms.length === 0 || form.steps.some((s) => !s.trim())) {
      return
    }

    onProcess(
      {
        id: generateId(),
        sourceUrl: pending.url,
        name: form.name.trim(),
        symptoms: form.symptoms,
        steps: form.steps.map((s) => s.trim()),
        imageUrl: form.imageUrl,
        checkInCount: 0,
        createdAt: new Date().toISOString(),
        isPublic: true,
      },
      pending.id,
      form.imageFile,
    )

    setExpandedId(null)
    setForms((prev) => {
      const next = { ...prev }
      delete next[pending.id]
      return next
    })
  }

  return (
    <section className="flex flex-col gap-8">
      <header>
        <SectionLabel>Inspiration Box · 灵感收藏匣</SectionLabel>
        <h2 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">从灵感到练习</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">
          粘贴小红书 / 微博链接，看完原帖后提炼成天鹅体态舒展练习。
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-full bg-white p-2 shadow-sm ring-1 ring-[#EAE5DF]/50 sm:flex-row">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="粘贴视频链接…"
          className="min-w-0 flex-1 rounded-full bg-white px-6 py-4 text-sm text-[#1A1A1A] outline-none placeholder:text-[#1A1A1A]/35"
          onKeyDown={(e) => e.key === 'Enter' && handleQuickSave()}
        />
        <button
          type="button"
          onClick={handleQuickSave}
          className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#1A1A1A] px-8 py-3 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          一键快存
        </button>
      </div>

      {pendingLinks.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="灵感收藏匣为空"
          description="粘贴链接后，在这里提炼成结构化练习，保存后进入天鹅练功房。"
        />
      ) : (
        <ul className="space-y-4">
          {pendingLinks.map((link) => (
            <li key={link.id} className="rounded-[28px] border border-[#EAE5DF]/50 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-[#F2F7FF] px-3 py-1.5 text-xs font-bold text-[#35688F] transition-colors hover:text-[#1A1A1A]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    原帖链接
                  </a>
                  <p className="mt-2 break-all text-xs leading-relaxed text-[#1A1A1A]/50">{link.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpand(link.id)}
                  className="shrink-0 rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] px-5 py-2.5 text-xs font-bold text-white shadow-[0_14px_35px_rgba(255,78,80,0.22),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:from-[#F7B7C8] hover:to-[#F8D7A5] active:scale-[0.98]"
                >
                  开始提炼 Practice
                </button>
              </div>

              {expandedId === link.id && (
                <div className="mt-5 animate-fade-slide-in space-y-4 border-t border-[#EAE5DF]/60 pt-5">
                  <div>
                    <label className="text-xs font-medium text-[#1A1A1A]/70">练习名称</label>
                    <input
                      type="text"
                      value={forms[link.id]?.name ?? ''}
                      onChange={(e) => updateForm(link.id, { name: e.target.value })}
                      placeholder="如：Wall Angel 靠墙天使"
                      className="mt-2 w-full rounded-full border border-[#EAE5DF]/60 bg-[#F8FAFC] px-5 py-3 text-sm outline-none transition-colors focus:border-[#FF8A5B]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#1A1A1A]/70">针对症状</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ALL_SYMPTOMS.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => toggleSymptom(link.id, sym)}
                          className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                            forms[link.id]?.symptoms.includes(sym)
                              ? 'border-[#FF8A5B]/40 bg-[#FFF0EB] text-[#F14C4C]'
                              : 'border-[#EAE5DF]/60 bg-white text-[#1A1A1A]/55 hover:border-[#FF8A5B]/30'
                          }`}
                        >
                          {SYMPTOM_LABELS[sym]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#1A1A1A]/70">舒展步骤</label>
                    <div className="mt-2 space-y-1">
                      {[0, 1, 2].map((i) => (
                        <input
                          key={i}
                          type="text"
                          value={forms[link.id]?.steps[i] ?? ''}
                          onChange={(e) => updateStep(link.id, i, e.target.value)}
                          placeholder={`步骤 ${i + 1}`}
                          className="w-full rounded-2xl border border-[#EAE5DF]/60 bg-[#F8FAFC] px-4 py-3 text-sm outline-none transition-colors focus:border-[#FF8A5B]"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#1A1A1A]/70">关键姿态图</label>
                    <div className="mt-2 max-w-xs">
                      <ImageUploader
                        label="上传姿态图"
                        sublabel="支持本地图片 / GIF"
                        imageUrl={forms[link.id]?.imageUrl}
                        onImageChange={(url) => updateForm(link.id, { imageUrl: url })}
                        onFileChange={(file) => updateForm(link.id, { imageFile: file })}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSave(link)}
                    className="w-full rounded-full bg-gradient-to-r from-[#FF4E50] to-[#F9D423] py-3.5 text-sm font-bold text-white shadow-[0_16px_35px_rgba(255,78,80,0.24),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:from-[#F7B7C8] hover:to-[#F8D7A5] active:scale-[0.98]"
                  >
                    保存至天鹅练功房
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
