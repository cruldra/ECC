import type { ReactNode } from 'react'
import { AlertTriangle, HelpCircle, Lightbulb, MapPin } from 'lucide-react'

/**
 * 每个场景一屏，四段固定：场景 → 痛点 → 解决方案 → 可点的交互演示，
 * 末尾一段「请贵司确认」。
 *
 * 写成组件而不是写成约定，是因为约定会被忘记。少一段就编译不过，
 * 客户看到的每一屏结构都一样，他跟着看不会走神。
 *
 * 四段的分工：场景让他认出这是他自己的事；痛点让他承认确实疼；
 * 解决方案让他看见东西长什么样；交互演示让他上手点，点完才会下决心。
 * 「请贵司确认」是我们没摸准的地方，摆出来当面问，不要替他猜。
 */
export function SceneShell(props: {
  index: number
  title: string
  /** 场景：谁、在什么时候、在做什么。用他行业的词。 */
  situation: ReactNode
  /** 痛点：现在这件事怎么出的问题。具体的事，不是「效率低」。 */
  pain: ReactNode
  /** 解决方案：我们打算让它变成什么样。一句话说清，不承诺任何数字。 */
  solution: ReactNode
  /** 可点的交互演示。这是这一屏的主角，占最大面积。 */
  demo: ReactNode
  /** 我们摸不准、需要甲方当面拍板的问题。一条一行。 */
  questions: string[]
}) {
  const { index, title, situation, pain, solution, demo, questions } = props
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-baseline gap-3">
          <span className="text-sm font-mono text-gray-400">
            {String(index).padStart(2, '0')}
          </span>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Band icon={<MapPin size={16} />} label="场景" tone="text-slate-600 bg-slate-50 border-slate-200">
            {situation}
          </Band>
          <Band icon={<AlertTriangle size={16} />} label="痛点" tone="text-amber-700 bg-amber-50 border-amber-200">
            {pain}
          </Band>
          <Band icon={<Lightbulb size={16} />} label="解决方案" tone="text-emerald-700 bg-emerald-50 border-emerald-200">
            {solution}
          </Band>
        </div>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 md:p-7">
          {demo}
        </section>

        <section className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <HelpCircle size={16} />
            请贵司确认
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-600 list-disc list-inside">
            {questions.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Band(props: { icon: ReactNode, label: string, tone: string, children: ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 ${props.tone}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
        {props.icon}
        {props.label}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-gray-700">{props.children}</div>
    </div>
  )
}
