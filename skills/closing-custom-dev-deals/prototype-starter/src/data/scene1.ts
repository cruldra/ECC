/**
 * 一个主题一个文件，全部写死。客户坐在旁边说一句，你改一句，刷新就生效。
 *
 * 所有数字都是示例，界面上必须带「示例」二字。原型不证明收益，
 * 不写工期、省了多少钱、回本周期、ROI、行业均值、别家案例 —— 一律不写。
 */

export interface Row {
  id: string
  name: string
  /** 示例值，界面上要标出来是示例 */
  note: string
  status: 'todo' | 'doing' | 'done'
}

export const SAMPLE_ROWS: Row[] = [
  { id: 'r1', name: '示例条目一', note: '示例：等甲方提供真实字段', status: 'todo' },
  { id: 'r2', name: '示例条目二', note: '示例：等甲方提供真实字段', status: 'doing' },
  { id: 'r3', name: '示例条目三', note: '示例：等甲方提供真实字段', status: 'done' },
]

export const STATUS_LABEL: Record<Row['status'], string> = {
  todo: '待处理',
  doing: '处理中',
  done: '已完成',
}
