import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Sparkles, XCircle } from 'lucide-react'

/**
 * 一屏一个场景，固定三段：抬头 → 痛点对照理想状态 → 交互演示工作区。
 *
 * 写成组件而不是写成约定，是因为约定会被忘记。少一段就编译不过，
 * 客户看到的每一屏结构都一样，他跟着看不会走神。
 *
 * 这一屏的气质是「方案已经定好了，你看一眼是不是这个意思」，
 * 不是「我们还在摸你的需求」。所以这里没有提问区 —— 要问的当面问，
 * 别摆在屏幕上，客户看见一堆问号会觉得我们还没想清楚。
 */

export interface PainPoint {
  /** 两到三个字的标签：耗时 / 靠人盯 / 说不清 */
  tag: string
  text: string
}

export interface Accent {
  /** 抬头胶囊与演示区图标的主色，写成 Tailwind 类 */
  chip: string
  icon: string
}

export const ACCENTS: Record<string, Accent> = {
  blue: { chip: 'bg-blue-100 text-blue-700', icon: 'text-blue-400' },
  emerald: { chip: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-400' },
  amber: { chip: 'bg-amber-100 text-amber-700', icon: 'text-amber-400' },
  violet: { chip: 'bg-violet-100 text-violet-700', icon: 'text-violet-400' },
  slate: { chip: 'bg-slate-200 text-slate-700', icon: 'text-slate-400' },
}

export function SceneShell(props: {
  index: number
  /** 场景名，四到八个字，用甲方自己的话 */
  title: string
  /** 一句话说清这屏解决什么，句号结尾 */
  subtitle: string
  /** 右上角的参考坐标：对标产品、技术路线，或者本期范围标注 */
  aside?: ReactNode
  accent?: keyof typeof ACCENTS
  /** 现在怎么出问题的。具体的事，不写「效率低」。三条最好。 */
  pains: PainPoint[]
  /** 做完之后是什么样。跟痛点一一对上。 */
  gains: PainPoint[]
  /** 演示区标题，写成甲方看得懂的工作区名字 */
  demoTitle: string
  /** 可点的交互演示。这是这一屏的主角。 */
  demo: ReactNode
}) {
  const { index, title, subtitle, aside, pains, gains, demoTitle, demo } = props
  const accent = ACCENTS[props.accent ?? 'blue']

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800 md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">

        <header className="mb-10 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end">
          <div>
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${accent.chip}`}>
              <Sparkles size={16} />场景演示 {String(index).padStart(2, '0')}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance text-gray-900 md:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-lg text-gray-500">{subtitle}</p>
          </div>
          {aside && <div className="flex items-center gap-2 text-sm text-gray-500">{aside}</div>}
        </header>

        <div className="relative grid gap-6 md:grid-cols-2">
          <div className="absolute top-1/2 left-1/2 z-10 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-100 bg-white shadow-lg md:flex">
            <ArrowRight className="text-gray-400" />
          </div>

          <div className="rounded-2xl border-l-4 border-l-red-500 bg-white p-6 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-red-600">
              <XCircle size={20} />现在是这样
            </h3>
            <ul className="space-y-3 text-gray-600">
              {pains.map((p) => (
                <li key={p.tag} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs text-red-600">{p.tag}</span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-2xl border-l-4 border-l-emerald-500 bg-white p-6 shadow-sm">
            <div className="absolute -right-4 -bottom-4 opacity-5"><Sparkles size={120} /></div>
            <h3 className="relative z-10 mb-3 flex items-center gap-2 text-lg font-bold text-emerald-600">
              <CheckCircle2 size={20} />做完之后
            </h3>
            <ul className="relative z-10 space-y-3 text-gray-600">
              {gains.map((g) => (
                <li key={g.tag} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{g.tag}</span>
                  {g.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg">
          <div className="flex items-center justify-between bg-gray-900 px-6 py-4">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <Sparkles size={20} className={accent.icon} />{demoTitle}
            </h2>
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
          </div>
          <div className="p-6 md:p-8">{demo}</div>
        </section>

      </div>
    </div>
  )
}
