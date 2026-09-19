/**
 * 一个主题一个文件，全部写死。客户坐在旁边说一句，你改一句，刷新就生效。
 *
 * 示例值界面上要标出来是示例。原型不证明收益 —— 不写工期、省了多少钱、
 * 回本周期、ROI、行业均值、别家案例，一律不写。
 */

/** AI 在跑的时候报给客户看的进度。用他行业的词，不写技术名词。 */
export const STEPS = [
  '示例：正在读取本期需要处理的清单…',
  '示例：正在比对历史记录，挑出需要动的那几条…',
  '示例：正在按规则生成处理方案…',
  '示例：正在分配到人并排定截止时间…',
]

export interface Option {
  id: string
  label: string
  /** peer-checked 用的强调色类名 */
  tone: string
}

/** 演示第一步：客户勾要 AI 做哪几件事，默认全勾上 */
export const OPTIONS: Option[] = [
  { id: 'o1', label: '示例选项一', tone: 'peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700' },
  { id: 'o2', label: '示例选项二', tone: 'peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700' },
  { id: 'o3', label: '示例选项三', tone: 'peer-checked:border-violet-500 peer-checked:bg-violet-50 peer-checked:text-violet-700' },
  { id: 'o4', label: '示例选项四', tone: 'peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-700' },
]

export interface ResultRow {
  id: string
  title: string
  owner: string
  due: string
  /** 这条是从哪来的，点开能追溯 */
  from: string
}

/** 演示第三步：AI 跑完之后交出来的东西 */
export const RESULT_ROWS: ResultRow[] = [
  { id: 'r1', title: '示例产出条目一', owner: '示例·张', due: '周三 18:00', from: '示例：出自第 3 条输入' },
  { id: 'r2', title: '示例产出条目二', owner: '示例·李', due: '今日 18:00', from: '示例：出自第 5 条输入' },
  { id: 'r3', title: '示例产出条目三', owner: '示例·王', due: '周四 18:00', from: '示例：出自第 7 条输入' },
]
