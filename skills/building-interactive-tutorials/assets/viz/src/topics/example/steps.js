const WORD = 'hello';

/** 数每个字母出现几次，按第一次出现的顺序排，打分条和词表都按这个顺序摆。 */
function countLetters(word) {
  const counts = new Map();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

/**
 * 拆分与合并的全部结果：字母块、每个字母的次数、出现最多且挨着的那一对，以及并好之后的块；两段演示都从这里取数，讲的是同一次计算。
 *
 * @return `letters` 字母块，`counts` 次数表，`top` 和 `times` 出现最多的字母和次数，`at` 那一对里前一个的位置，`merged` 新块，`joined` 并好后的块
 */
function splitAndMerge(word) {
  const letters = [...word].map((text, i) => ({ id: `c${i}`, text }));
  const counts = countLetters(word);
  const [top, times] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const at = letters.findIndex((t, i) => t.text === top && letters[i + 1]?.text === top);
  const merged = { id: 'merged', text: top + top };
  const joined = [...letters.slice(0, at), merged, ...letters.slice(at + 2)];
  return { letters, counts, top, times, at, merged, joined };
}

/**
 * 算出方块演示的每一步：把 `hello` 拆成字母，数出出现最多的字母，再把挨着的两个并成一块。
 *
 * 这里的数据从输入算出来，换个词演示跟着变；真实教程要从真实运行结果算，或者照真实输出写死。
 * 每一步的字段见 [createTilesView](viz/src/notebook/tiles-3d.js#createTilesView)：同一 `id` 的块换步时滑到新位置，带 `from` 的块从来源块中间长出来。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildExampleScenes() {
  const { letters, counts, top, times, at, merged, joined } = splitAndMerge(WORD);
  const pair = new Set([at, at + 1]);

  const row = (tiles) => [{ key: 'word', label: `「${WORD}」`, tiles }];
  const bars = {
    title: '每个字母出现几次',
    items: [...counts].map(([ch, n]) => ({ key: ch, label: ch, value: n, display: `${n} 次`, tag: ch === top ? 'focus' : 'base' })),
  };
  const vocab = (tag) => ({
    title: '词表',
    items: [...[...counts.keys()].map((ch) => ({ key: ch, text: ch, tag: 'base' })), { key: merged.text, text: merged.text, tag }],
  });

  const steps = [
    {
      phase: '拆分',
      title: '拆成字母',
      text: `先把 <code>${WORD}</code> 拆成 ${letters.length} 个字母，每个字母是一块。`,
      rows: row(letters.map((t) => ({ ...t, tag: 'base' }))),
    },
    {
      phase: '拆分',
      title: '数一数',
      text: `<b>${top}</b> 出现 ${times} 次，最多，而且两个挨在一起。`,
      rows: row(letters.map((t, i) => ({ ...t, tag: pair.has(i) ? 'focus' : 'base' }))),
      bars,
    },
    {
      phase: '合并',
      title: '并成一块',
      text: `把挨着的两个 <code>${top}</code> 并成 <code>${merged.text}</code>：新块从原来两块中间长出来，词表多了一项。`,
      rows: row(joined.map((t) => (t === merged ? { ...t, tag: 'new', from: letters.slice(at, at + 2).map((l) => l.id) } : { ...t, tag: 'base' }))),
      bars,
      vocab: vocab('new'),
    },
    {
      phase: '合并',
      title: '结果',
      text: `<code>${WORD}</code> 现在是 ${joined.length} 块。`,
      rows: row(joined.map((t) => ({ ...t, tag: t === merged ? 'done' : 'base' }))),
      vocab: vocab('done'),
    },
  ];
  return [{ id: 'example', name: '拆分与合并', tagline: '拆成字母，再把挨着的同一字母并成一块', steps }];
}

const CODE = 'src/topics/example/steps.js';

/**
 * 示例的组件图：上面一排是三步计算，下面一排是它们读写的数据，画的就是 [splitAndMerge] 这一次计算。
 *
 * 坐标在地面上，`x` 向右、`z` 朝读者；组件宽 3.4、深 1.7。`kind` 取 [KINDS](viz/src/notebook/graph-3d.js#KINDS) 里的种类，
 * `desc` 和 `code` 是悬停时的说明和代码位置，`dashed` 的连线画成虚线，表示引用而不是调用。
 */
export const GRAPH = {
  groups: [
    { id: 'steps', label: '计算', color: '#6aa8ff', x: 0, z: -3.5, w: 25, d: 5.2 },
    { id: 'data', label: '数据', color: '#e2b93b', x: 0, z: 3.5, w: 25, d: 5.2 },
  ],
  nodes: [
    { id: 'split', kind: 'process', label: '拆分', sub: '[...word]', x: -8.25, z: -3.5, desc: '把词拆成字母，一个字母一块。', code: CODE },
    { id: 'count', kind: 'process', label: '计数', sub: 'countLetters', x: -2.75, z: -3.5, desc: '数每个字母出现几次。', code: CODE },
    { id: 'merge', kind: 'process', label: '合并', sub: 'top + top', x: 5.5, z: -3.5, desc: '把挨着的两个最多的字母并成一块，词表加一项。', code: CODE },
    { id: 'word', kind: 'store', label: '输入', sub: 'WORD', x: -8.25, z: 3.5, desc: '要拆的词。' },
    { id: 'counts', kind: 'table', label: '次数表', sub: 'counts', x: -2.75, z: 3.5, desc: '一个字母一行，记它出现几次。' },
    { id: 'top', kind: 'ref', label: '最多的字母', sub: 'top', x: 2.75, z: 3.5, desc: '指着次数表里次数最多的那一行。' },
    { id: 'vocab', kind: 'table', label: '词表', sub: 'vocab', x: 8.25, z: 3.5, desc: '全部字母，加上合并出来的新块。' },
  ],
  edges: [
    { id: 'read', from: 'word', to: 'split', label: '读入', desc: '拆分读入要拆的词。' },
    { id: 'toCount', from: 'split', to: 'count', label: '字母块', desc: '拆出来的字母块交给计数。' },
    { id: 'write', from: 'count', to: 'counts', label: '写次数', desc: '每个字母的次数写进次数表。' },
    { id: 'point', from: 'top', to: 'counts', label: '指着', desc: '只是指着一行，不复制数据。', dashed: true },
    { id: 'toMerge', from: 'count', to: 'merge', label: '字母块', desc: '字母块原样交给合并。' },
    { id: 'pick', from: 'top', to: 'merge', label: '挑出', desc: '合并按它挑出要并的字母。' },
    { id: 'add', from: 'merge', to: 'vocab', label: '加一项', desc: '新块加进词表。' },
  ],
};

/**
 * 算出组件图演示的每一步：和方块演示是同一次拆分与合并，换成看哪个组件在干活、数据往哪儿流。
 *
 * 每一步的字段见 [createGraphView](viz/src/notebook/graph-3d.js#createGraphView)：`nodes` 点亮组件，`edges` 点亮连线，
 * `badges` 挂在名牌第三行，`details` 是悬停和点开时看到的几行数据，`focus` 是镜头要看全的组件。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildGraphScenes() {
  const { letters, counts, top, times, at, merged, joined } = splitAndMerge(WORD);
  const blocks = (list) => list.map((t) => t.text).join(' ');
  const vocab = [...counts.keys(), merged.text];

  const steps = [
    {
      phase: '拆分',
      title: '拆成字母',
      text: `「拆分」读入 <code>${WORD}</code>，拆成 ${letters.length} 块。悬停在组件上看说明，点一下看这一步的全部数据。`,
      nodes: { word: 'base', split: 'active' },
      edges: [{ id: 'read', label: `读入 ${WORD}` }],
      badges: { word: WORD, split: `${letters.length} 块` },
      details: { word: [WORD], split: letters.map((t) => `${t.id}  ${t.text}`) },
      focus: ['word', 'split', 'count', 'counts'],
    },
    {
      phase: '拆分',
      title: '数一数',
      text: `「计数」把次数写进次数表：${counts.size} 种字母里 <b>${top}</b> 出现 ${times} 次，最多。「最多的字母」只是指着那一行。`,
      nodes: { split: 'base', count: 'active', counts: 'new', top: 'new' },
      edges: [{ id: 'toCount', label: `${letters.length} 块` }, { id: 'write', tone: 'new' }, { id: 'point', tone: 'new' }],
      badges: { counts: `${counts.size} 种字母`, top: `→ ${top} · ${times} 次` },
      details: {
        counts: [...counts].map(([ch, n]) => `${ch}  ${n} 次`),
        top: [`${top}  ${times} 次`, `挨着的一对在第 ${at + 1}、${at + 2} 个字母`],
      },
      focus: ['split', 'count', 'counts', 'top'],
    },
    {
      phase: '合并',
      title: '并成一块',
      text: `「合并」按「最多的字母」挑出挨着的两个 <code>${top}</code>，并成 <code>${merged.text}</code>：${letters.length} 块变成 ${joined.length} 块，词表多了一项。`,
      nodes: { count: 'base', top: 'base', merge: 'active', vocab: 'new' },
      edges: [{ id: 'toMerge', label: `${letters.length} 块` }, { id: 'pick', label: `挑出 ${top}` }, { id: 'add', label: `+ ${merged.text}`, tone: 'new' }],
      badges: { merge: `${letters.length} 块 → ${joined.length} 块`, vocab: `${vocab.length} 项` },
      details: { merge: [`合并前  ${blocks(letters)}`, `合并后  ${blocks(joined)}`], vocab },
      focus: ['count', 'merge', 'top', 'vocab'],
    },
  ];
  return [{ id: 'example-graph', name: '组件图', tagline: '同一次拆分与合并，看哪个组件在干活、数据往哪儿流', steps }];
}
