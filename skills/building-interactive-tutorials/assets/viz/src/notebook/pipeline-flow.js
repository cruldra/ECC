const GAP_X = 2.6;
const ROW_Z = 1.4;
const COLORS = ['#4fd1c5', '#e2b93b', '#a78bfa', '#6aa8ff', '#f08a59'];

/**
 * 一条直线流水线的布局：几块平台从左到右排开，相邻两块之间一个箭头，数据从左往右一站站变形。
 *
 * 每块平台上的行以平台中线为准上下排开，slot 名是 `平台 id + 行号`，如 `bytes0`；第一行离平台后沿留出放标题的位置。
 * 箭头 id 是 `平台 id → 平台 id` 的写法 `from>to`。
 *
 * @param stages 平台，从左到右：`{ id, label, w, rows, color }`，`rows` 缺省用参数 `rows`，`color` 缺省按顺序取一组颜色
 * @param rows 每块平台默认几行
 * @param arrows 相邻两块平台之间箭头上的字，比 `stages` 少一项
 * @param labels 某块平台各行的名字 `{ 平台 id: ['行名', …] }`，名字排在那一行的左边
 * @return 交给 [createFlowView](viz/src/notebook/flow-3d.js#createFlowView) 的布局
 */
export function pipelineFlow({ stages, rows = 1, arrows, labels = {} }) {
  const rowsOf = (s) => s.rows ?? rows;
  const most = Math.max(...stages.map(rowsOf));
  const d = most * ROW_Z + 2.4;
  // 行整体往前挪一点，后沿多空出放平台标题的地方。
  const zOf = (count, i) => (i - (count - 1) / 2) * ROW_Z + 0.5;
  const total = stages.reduce((sum, s) => sum + s.w, 0) + GAP_X * (stages.length - 1);
  let left = -total / 2;
  const plates = stages.map((s, k) => {
    const plate = { id: s.id, label: s.label, color: s.color ?? COLORS[k % COLORS.length], x: left + s.w / 2, z: 0, w: s.w, d };
    left += s.w + GAP_X;
    return plate;
  });
  const slots = {};
  for (const p of plates) {
    const count = rowsOf(stages.find((s) => s.id === p.id));
    for (let i = 0; i < count; i++) slots[`${p.id}${i}`] = { x: p.x, z: zOf(count, i), label: labels[p.id]?.[i] };
  }
  return {
    plates,
    slots,
    arrows: plates.slice(1).map((p, k) => ({ id: `${plates[k].id}>${p.id}`, from: plates[k].id, to: p.id, z: 0.5, label: arrows[k] })),
  };
}
