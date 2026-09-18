import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { SceneShell } from '../../shell/SceneShell'
import { SAMPLE_ROWS, STATUS_LABEL, type Row } from '../../data/scene1'

/**
 * 场景模板。照着改：换掉四段文案、换掉 demo 里的交互、换掉 data 里的数据。
 *
 * demo 必须真的能点。客户点一下有反应，他才相信这事能做成；
 * 看一张静态图，他只会点头，然后回去继续不下决心。
 */
export default function Scene1() {
  const [rows, setRows] = useState<Row[]>(SAMPLE_ROWS)

  const advance = (id: string) => {
    setRows((prev) => prev.map((row) => row.id === id
      ? { ...row, status: row.status === 'todo' ? 'doing' : 'done' }
      : row))
  }

  return (
    <SceneShell
      index={1}
      title="场景标题：用甲方自己的话"
      situation={<>谁、在什么时候、在做什么。用他行业的词，不要用「用户」「系统」。</>}
      pain={<>现在这件事怎么出的问题。写具体发生过的事，不写「效率低」「不规范」。</>}
      solution={<>我们打算让它变成什么样。一句话。不写工期、不写省多少钱、不写回本。</>}
      demo={(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">可点的交互演示</h2>
              <p className="text-xs text-gray-400 mt-0.5">下列数据均为示例，等甲方提供真实字段后替换</p>
            </div>
            <button
              onClick={() => setRows(SAMPLE_ROWS)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              <RotateCcw size={14} />
              重置
            </button>
          </div>

          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-4 p-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{row.name}</div>
                  <div className="text-xs text-gray-400">{row.note}</div>
                </div>
                <span className="text-xs rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                  {STATUS_LABEL[row.status]}
                </span>
                <button
                  onClick={() => advance(row.id)}
                  disabled={row.status === 'done'}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-400 disabled:opacity-40"
                >
                  <Check size={12} />
                  推进一步
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      questions={[
        '这一步现在是谁在做？一天做几次？',
        '这里该出现哪些字段？我们先按示例摆的。',
        '做完之后要通知谁？怎么通知？',
      ]}
    />
  )
}
