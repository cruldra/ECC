import { useState } from 'react'
import { CheckCircle2, RefreshCcw, Send, Sparkles } from 'lucide-react'
import { SceneShell } from '../../shell/SceneShell'
import { useGeneration } from '../../shell/useGeneration'
import { OPTIONS, RESULT_ROWS, STEPS } from '../../data/scene1'

/**
 * 场景模板。照着改：换掉抬头三句、现状与解决方案各三条、演示里的三段。
 *
 * 演示固定三段：填条件 → 一步步跑 → 交出东西。
 * 客户点一下、看着它跑完、看见成果落在纸面上，他才相信这事能做成。
 * 静态图只会让他点头，回去继续不下决心。
 */
export default function Scene1() {
  const gen = useGeneration(STEPS)
  const [sent, setSent] = useState<string[]>([])

  const send = (id: string) => setSent((prev) => (prev.includes(id) ? prev : [...prev, id]))
  const sendAll = () => setSent(RESULT_ROWS.map((r) => r.id))

  const restart = () => { gen.reset(); setSent([]) }

  return (
    <SceneShell
      index={1}
      accent="blue"
      title="场景标题：用甲方自己的话"
      subtitle="一句话说清这屏解决什么，让他一眼认出这是他自己的事。"
      aside={<>本期范围：<span className="rounded bg-gray-200 px-2 py-1 font-mono">示例标注</span></>}
      pains={[
        { tag: '耗时', text: '现在这件事要花多久、卡在哪一步。写具体的事。' },
        { tag: '靠人盯', text: '现在靠谁盯着才不出错，他一忙就掉链子。' },
        { tag: '说不清', text: '出了问题之后查不出是在哪一环停的。' },
      ]}
      gains={[
        { tag: '当场出', text: '跟上面第一条对上：同一件事变成什么样。' },
        { tag: '自动跑', text: '跟上面第二条对上：不用人盯着也会往下走。' },
        { tag: '有据可查', text: '跟上面第三条对上：每一步谁做的、留下什么，翻得到。' },
      ]}
      demoTitle="交互演示工作区"
      demo={(
        <div className="mx-auto max-w-3xl">
          {!gen.done ? (
            <>
              <div className="mb-8">
                <label htmlFor="scene1-input" className="mb-2 block text-sm font-bold text-gray-700">
                  1. 填入这次要处理的内容
                </label>
                <input
                  id="scene1-input"
                  defaultValue="示例：这里预填一条甲方一眼认得出的真实内容"
                  className="block w-full rounded-xl border border-gray-300 bg-gray-50 p-4 text-lg text-gray-900 transition-all focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="mb-8">
                <span className="mb-3 block text-sm font-bold text-gray-700">2. 选择要 AI 做的事</span>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {OPTIONS.map((o) => (
                    <label key={o.id} htmlFor={o.id} className="cursor-pointer">
                      <input id={o.id} type="checkbox" className="peer sr-only" defaultChecked />
                      <div className={`rounded-xl border border-gray-200 p-4 text-center transition-all hover:bg-gray-50 ${o.tone}`}>
                        <div className="text-sm font-bold">{o.label}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={gen.start}
                disabled={gen.running}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:bg-blue-400"
              >
                {gen.running ? (
                  <><RefreshCcw className="animate-spin" size={24} />{gen.label}</>
                ) : (
                  <><Sparkles size={24} />立即执行</>
                )}
              </button>
            </>
          ) : (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-500 p-1"><CheckCircle2 className="text-white" size={24} /></div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-800">执行完毕</h3>
                    <p className="text-sm text-emerald-600">
                      示例：共产出 {RESULT_ROWS.length} 条，已分配到人并带截止时间。
                    </p>
                  </div>
                </div>
                <button
                  onClick={restart}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
                >
                  重新执行
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
                  <h4 className="font-bold text-gray-800">本次产出</h4>
                  <button
                    onClick={sendAll}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                  >
                    <Send size={12} />全部下发
                  </button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {RESULT_ROWS.map((r) => {
                    const isSent = sent.includes(r.id)
                    return (
                      <li key={r.id} className={`flex flex-wrap items-center gap-3 p-4 transition-colors ${isSent ? 'bg-emerald-50' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">{r.title}</div>
                          <div className="mt-0.5 text-xs text-gray-400">{r.from}</div>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{r.owner}</span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{r.due}</span>
                        <button
                          onClick={() => send(r.id)}
                          disabled={isSent}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-500 disabled:opacity-40"
                        >
                          {isSent ? '已下发' : '下发'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    />
  )
}
