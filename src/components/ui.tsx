import { Camera, type LucideIcon } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'

interface ImageUploaderProps {
  label: string
  sublabel: string
  imageUrl?: string
  onImageChange: (dataUrl: string) => void
}

export function ImageUploader({ label, sublabel, imageUrl, onImageChange }: ImageUploaderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => onImageChange(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <label className="group flex cursor-pointer flex-col overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF5F2] shadow-sm ring-1 ring-[#EAE5DF]/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[3/4] w-full">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-white/80 text-[#1A1A1A] shadow-sm transition-all duration-300 group-hover:scale-105">
              <Camera className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-[#1A1A1A]">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A]/50">{sublabel}</p>
            </div>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </label>
  )
}

interface StatNumberProps {
  value: number
  animateKey: number
}

export function StatNumber({ value, animateKey }: StatNumberProps) {
  return (
    <span key={animateKey} className="inline-block animate-count-pop font-sans text-6xl font-black tracking-tighter text-[#1A1A1A] md:text-7xl">
      {value}
    </span>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-sans text-[10px] font-black uppercase tracking-[0.24em] text-[#1A1A1A]/35">
      {children}
    </p>
  )
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/70 bg-gradient-to-br from-[#F8FBFF] to-white px-8 py-16 text-center shadow-sm ring-1 ring-[#EAE5DF]/40">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A] text-white shadow-[0_12px_30px_rgba(26,26,26,0.14)]">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-bold text-[#1A1A1A]/70">{title}</p>
      <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#1A1A1A]/40">{description}</p>
    </div>
  )
}

export function SymptomBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/70 bg-[#F2F7FF] px-3 py-1 text-xs font-bold text-[#35688F] shadow-sm">
      {label}
    </span>
  )
}
