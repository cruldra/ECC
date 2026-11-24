const WORD = 'hello';
const CODE = 'src/topics/example-change/steps.js';

/** 数每个字母出现几次，按第一次出现的顺序排。 */
function countBlocks(blocks) {
  const counts = new Map();
  for (const b of blocks) counts.set(b, (counts.get(b) ?? 0) + 1);
  return counts;
}

/**
 * 两段演示共用的一次计算：拆成字母、数一遍、把挨着的两个 `l` 并成 `ll`，再算出合并后次数表该是什么样。
 *
 * @return `letters` 字母块，`before` 合并前的次数，`joined` 合并后的块，`after` 合并后的次数，`changed` 合并后变了的几行
 */
function mergeOnce(word) {
  const letters = [...word];
  const before = countBlocks(letters);
  const [top] = [...before].sort((a, b) => b[1] - a[1])[0];
  const at = letters.findIndex((ch, i) => ch === top && letters[i + 1] === top);
  const joined = [...letters.slice(0, at), top + top, ...letters.slice(at + 2)];
  const after = countBlocks(joined);
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changed = [...keys].filter((k) => before.get(k) !== after.get(k)).map((k) => `${k}  ${before.get(k) ?? 0} → ${after.get(k) ?? 0}`);
  return { letters, before, joined, after, changed, top };
}

const rows = (counts) => [...counts].map(([k, n]) => `${k}  ${n} 次`);

/** 两张图里都有的组件：同一个 `id`、同一个位置，读者换到方案时看到的是同一处在变。 */
const SHARED_NODES = [
  { id: 'word', kind: 'store', label: '输入', sub: 'WORD', x: -8.25, z: 3.5, desc: '要处理的词。' },
  { id: 'split', kind: 'process', label: '拆分', sub: '[...word]', x: -8.25, z: -3.5, desc: '把词拆成字母，一个字母一块。', code: CODE },
  { id: 'count', kind: 'process', label: '计数', sub: 'countBlocks', x: -2.75, z: -3.5, desc: '数每一块出现几次。', code: CODE },
  { id: 'counts', kind: 'table', label: '次数表', sub: 'counts', x: -2.75, z: 3.5, desc: '一种块一行，记它出现几次。' },
  { id: 'merge', kind: 'process', label: '合并', sub: 'top + top', x: 5.5, z: -3.5, desc: '把挨着的两个最多的字母并成一块。', code: CODE },
];
const GROUPS = [
  { id: 'steps', label: '计算', color: '#6aa8ff', x: 0, z: -3.5, w: 25, d: 5.2 },
  { id: 'data', label: '数据', color: '#e2b93b', x: 0, z: 3.5, w: 25, d: 5.2 },
];
const SHARED_EDGES = [
  { id: 'read', from: 'word', to: 'split', label: '读入', desc: '拆分读入要处理的词。' },
  { id: 'toCount', from: 'split', to: 'count', label: '字母块', desc: '拆出来的块交给计数。' },
  { id: 'write', from: 'count', to: 'counts', label: '写次数', desc: '每种块的次数写进次数表。' },
  { id: 'toMerge', from: 'count', to: 'merge', label: '字母块', desc: '块原样交给合并。' },
];

/** 现状：每并一次，合并就把整串块交回计数，从头再数一遍。 */
export const GRAPH_NOW = {
  groups: GROUPS,
  nodes: SHARED_NODES,
  edges: [...SHARED_EDGES, { id: 'recount', from: 'merge', to: 'count', label: '整串重数', desc: '合并完把全部块交回计数，从头数一遍。' }],
};

/** 方案：合并直接改次数表里变了的那几行，不再整串重数；没变的组件位置不动。 */
export const GRAPH_NEXT = {
  groups: GROUPS,
  nodes: SHARED_NODES,
  edges: [...SHARED_EDGES, { id: 'update', from: 'merge', to: 'counts', label: '只改变了的行', desc: '并掉的字母减次数，新块加一行。' }],
};

/**
 * 现状和方案两段演示：前三步一样，第四步现状整串重数（缺口），方案只改变了的几行。
 *
 * 每一步的字段见 [createGraphView](viz/src/notebook/graph-3d.js#createGraphView)；方案和现状一步对一步，读者能逐步对照。
 *
 * @return `[现状, 方案]`，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildChangeScenes() {
  const { letters, before, joined, after, changed, top } = mergeOnce(WORD);
  const common = [
    {
      phase: '拆分',
      title: '拆成字母',
      text: `把 <code>${WORD}</code> 拆成 ${letters.length} 块。`,
      nodes: { word: 'base', split: 'active' },
      edges: [{ id: 'read', label: `读入 ${WORD}` }],
      badges: { split: `${letters.length} 块` },
      focus: ['word', 'split', 'count'],
    },
    {
      phase: '拆分',
      title: '数一遍',
      text: `数出 ${before.size} 种块，写进次数表。`,
      nodes: { count: 'active', counts: 'new' },
      edges: [{ id: 'toCount' }, { id: 'write', tone: 'new' }],
      badges: { counts: `${before.size} 行` },
      details: { counts: rows(before) },
      focus: ['split', 'count', 'counts'],
    },
    {
      phase: '合并',
      title: '并成一块',
      text: `把挨着的两个 <code>${top}</code> 并成 <code>${top + top}</code>，${letters.length} 块变 ${joined.length} 块。`,
      nodes: { merge: 'active' },
      edges: [{ id: 'toMerge', label: `${letters.length} 块` }],
      badges: { merge: `${letters.length} 块 → ${joined.length} 块` },
      focus: ['count', 'merge', 'counts'],
    },
  ];
  const now = [
    ...common,
    {
      phase: '缺口',
      title: '整串重数',
      text: `合并完把 ${joined.length} 块全交回计数，从头再数一遍；其实只有 ${changed.length} 行变了。`,
      nodes: { merge: 'base', count: 'gap', counts: 'gap' },
      edges: [{ id: 'recount', tone: 'gap', label: `重数 ${joined.length} 块` }, { id: 'write', tone: 'gap' }],
      badges: { count: { text: `又数 ${joined.length} 块`, tone: 'gap' } },
      details: { counts: rows(after) },
      focus: ['count', 'merge', 'counts'],
    },
  ];
  const next = [
    ...common,
    {
      phase: '方案',
      title: '只改变了的行',
      text: `合并直接改次数表里变了的 ${changed.length} 行，不再整串重数。`,
      nodes: { merge: 'active', counts: 'new' },
      edges: [{ id: 'update', tone: 'new', label: `改 ${changed.length} 行` }],
      badges: { counts: { text: `改 ${changed.length} 行`, tone: 'new' } },
      details: { counts: changed },
      focus: ['count', 'merge', 'counts'],
    },
  ];
  return [
    { id: 'change-now', name: '现状', tagline: '每并一次就整串重数', steps: now },
    { id: 'change-next', name: '方案', tagline: '合并时只改变了的几行', steps: next },
  ];
}
