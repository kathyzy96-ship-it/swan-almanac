import { ImageUploader, SectionLabel, StatNumber } from './ui'
import type { BodyProfile } from '../types'

interface AchievementStudioProps {
  totalCheckIns: number
  streak: number
  bodyProfile: BodyProfile
  onBodyProfileChange: (profile: BodyProfile) => void
  statAnimKey: number
}

export function AchievementStudio({
  totalCheckIns,
  streak,
  bodyProfile,
  onBodyProfileChange,
  statAnimKey,
}: AchievementStudioProps) {
  return (
    <section className="flex flex-col gap-10">
      <header>
        <SectionLabel>Achievement Studio · 个人成就区</SectionLabel>
        <h2 className="font-sans text-2xl font-black tracking-tight text-[#1A1A1A]">正向数据墙</h2>
      </header>

      <div className="space-y-8 rounded-[32px] border border-[#EAE5DF]/50 bg-gradient-to-br from-[#FFF4C8] via-[#FFFDF4] to-white p-8 shadow-sm">
        <div>
          <p className="text-sm leading-relaxed text-[#1A1A1A]/60">您已累计优雅舒展</p>
          <p className="mt-2 flex items-baseline gap-2">
            <StatNumber value={totalCheckIns} animateKey={statAnimKey} />
            <span className="text-lg font-semibold text-[#1A1A1A]/40">次</span>
          </p>
        </div>

        <div className="h-px bg-[#EAE5DF]/70" />

        <div>
          <p className="text-sm leading-relaxed text-[#1A1A1A]/60">连续坚持</p>
          <p className="mt-2 flex items-baseline gap-2">
            <StatNumber value={streak} animateKey={statAnimKey + 1} />
            <span className="text-lg font-semibold text-[#1A1A1A]/40">天</span>
          </p>
        </div>
      </div>

      <div>
        <SectionLabel>Before & After Mirror · 身材对比镜</SectionLabel>
        <p className="mb-6 text-sm leading-relaxed text-[#1A1A1A]/60">
          上传侧面体态照，记录每一次微小的蜕变。
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative rounded-[32px] bg-white/70 p-2 shadow-sm ring-1 ring-[#EAE5DF]/50">
            <span className="absolute left-5 top-5 z-10 rounded-full bg-[#FFE5DF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#D95745]">
              Before
            </span>
            <ImageUploader
              label="初始体态"
              sublabel="侧面照，记录起点"
              imageUrl={bodyProfile.beforeImage}
              onImageChange={(url) => onBodyProfileChange({ ...bodyProfile, beforeImage: url })}
            />
          </div>
          <div className="relative rounded-[32px] bg-white/70 p-2 shadow-sm ring-1 ring-[#EAE5DF]/50">
            <span className="absolute left-5 top-5 z-10 rounded-full bg-[#DDFBEA] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#117A4A]">
              After
            </span>
            <ImageUploader
              label="最新蜕变"
              sublabel="侧面照，看见变化"
              imageUrl={bodyProfile.afterImage}
              onImageChange={(url) => onBodyProfileChange({ ...bodyProfile, afterImage: url })}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
