import { pipelineFlow } from '../../notebook/pipeline-flow.js';

const WORD = 'hello';
/** 训练时没见过的词，用来演示按规则编码。 */
const SAMPLE = 'hell';

/** 数每个字母出现几次，按第一次出现的顺序排，打分条和词表都按这个顺序摆。 */
function countLetters(word) {
  const counts = new Map();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

/**
 * 拆分与合并的全部结果：字母块、每个字母的次数、出现最多且挨着的那一对、并好之后的块、记下的合并规则，以及词表。
 *
 * 只算不画：每段演示都从这里取数，各自画成自己的步骤，讲的是同一次计算。
 *
 * @return `letters` 字母块，`counts` 次数表，`top` 和 `times` 出现最多的字母和次数，`at` 那一对里前一个的位置，`merged` 新块，`joined` 并好后的块，
 *   `rules` 合并规则 `{ left, right, joined }`，按记下的先后排；`again` 并完之后还有没有挨着的同一字母，没有就不再训练下一轮；
 *   `vocab` 词表：全部字母按第一次出现的顺序排，最后是新块，一项的位置就是它的编号
 */
function splitAndMerge(word) {
  const letters = [...word].map((text, i) => ({ id: `c${i}`, text }));
  const counts = countLetters(word);
  const [top, times] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const at = letters.findIndex((t, i) => t.text === top && letters[i + 1]?.text === top);
  const merged = { id: 'merged', text: top + top };
  const joined = [...letters.slice(0, at), merged, ...letters.slice(at + 2)];
  const rules = [{ left: top, right: top, joined: merged.text }];
  const again = joined.some((t, i) => joined[i + 1]?.text === t.text);
  const vocab = [...counts.keys(), merged.text];
  return { letters, counts, top, times, at, merged, joined, rules, again, vocab };
}

/**
 * 按合并规则的先后给一个词编码：先拆成单字，每条规则把所有挨着的「左 + 右」并成一块。只算不画。
 *
 * @return `start` 拆好的单字块；`trace` 每条规则一项：`rule`、`applied`（这次用上没有）、`pieces`（套完之后的块，新块的 `from` 是并掉的两块）
 */
function encodeByRules(rules, word) {
  const start = [...word].map((text, i) => ({ id: `c${i}`, text }));
  let pieces = start;
  const trace = rules.map((rule, k) => {
    const next = [];
    for (let i = 0; i < pieces.length; i++) {
      const [a, b] = [pieces[i], pieces[i + 1]];
      if (b && a.text === rule.left && b.text === rule.right) {
        next.push({ id: `r${k}:${a.id}`, text: rule.joined, from: [a.id, b.id] });
        i++;
      } else {
        next.push(a);
      }
    }
    const applied = next.length < pieces.length;
    pieces = next;
    return { rule, applied, pieces };
  });
  return { start, trace };
}

/**
 * 按空格把一句话切成块，再把每块拆成字母，只算不画：预分词这类「一串变成另一串」的记录。
 *
 * @return `chunks` 切出的块；`letters` 每块拆出的字母，一块一组，字母的 `from` 是它所在的块
 */
function preSplit(text) {
  const chunks = text.split(' ').map((part, i) => ({ id: `k${i}`, text: part }));
  const letters = chunks.map((chunk) => [...chunk.text].map((ch, j) => ({ id: `${chunk.id}:${j}`, text: ch, from: [chunk.id] })));
  return { chunks, letters };
}

/** 「预分词」一章演示的那句话，由 [WORD] 和 [SAMPLE] 拼成。 */
const SENTENCE = `${WORD} ${SAMPLE}`;

/**
 * 「预分词」一章的布局：原文 → 切块 → 字母三站排成一条直线，字母一站每块占一行。字段见 [pipelineFlow](viz/src/notebook/pipeline-flow.js#pipelineFlow)。
 */
export const PRE_SPLIT_FLOW = (() => {
  const { chunks } = preSplit(SENTENCE);
  return pipelineFlow({
    stages: [
      { id: 'text', label: '原文', w: 5.5 },
      { id: 'chunks', label: '切块', w: 6 },
      { id: 'letters', label: '字母', w: 11, rows: chunks.length },
    ],
    arrows: ['按空格切', '拆字母'],
    labels: { letters: chunks.map((c) => `「${c.text}」`) },
  });
})();

/**
 * 算出「预分词」演示的每一步：一句话先按空格切块，每块再拆成字母。
 *
 * 数据从 [preSplit] 算出来；真实教程要从真实运行结果算，或者照真实输出写死。前面站点的方块一直留着，后一站的方块从它们长出来。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildPreSplitScenes() {
  const { chunks, letters } = preSplit(SENTENCE);
  const text = (tag = 'base') => ({ id: 'p:s', text: SENTENCE, tag, at: 'text0' });
  const chunkBlocks = (tag, withFrom) => chunks.map((c) => ({ id: `p:${c.id}`, text: c.text, tag, at: 'chunks0', from: withFrom ? ['p:s'] : undefined }));
  const steps = [
    {
      phase: '预分词',
      title: '一句话',
      text: `输入是一句话「${SENTENCE}」，还没切开。`,
      plates: ['text'],
      blocks: [text('focus')],
    },
    {
      phase: '预分词',
      title: '按空格切块',
      text: `按空格切成 ${chunks.length} 块：${chunks.map((c) => `<code>${c.text}</code>`).join('、')}，空格本身不留。`,
      plates: ['chunks'],
      arrows: ['text>chunks'],
      blocks: [text(), ...chunkBlocks('new', true)],
    },
    {
      phase: '拆分',
      title: '每块拆成字母',
      text: `每块各自拆成字母，一块一行：${chunks.map((c, i) => `<code>${c.text}</code> ${letters[i].length} 个`).join('，')}。`,
      plates: ['letters'],
      arrows: ['chunks>letters'],
      blocks: [
        text(),
        ...chunkBlocks('base', false),
        ...letters.flatMap((row, i) => row.map((t) => ({ id: `p:${t.id}`, text: t.text, tag: 'new', at: `letters${i}`, from: t.from.map((f) => `p:${f}`) }))),
      ],
    },
  ];
  return [{ id: 'example-pre-split', name: '按空格切块', tagline: '原文 → 切块 → 字母', steps }];
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
    { id: 'steps', label: '计算', color: '#6aa8ff', x: 0, z: -3.9, w: 25, d: 5.2 },
    { id: 'data', label: '数据', color: '#e2b93b', x: 0, z: 3.1, w: 25, d: 5.2 },
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
  const { letters, counts, top, times, at, merged, joined, vocab } = splitAndMerge(WORD);
  const blocks = (list) => list.map((t) => t.text).join(' ');

  const steps = [
    {
      phase: '拆分',
      title: '拆成字母',
      text: `「拆分」读入 <code>${WORD}</code>，拆成 ${letters.length} 块。`,
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

/** 拆块走后排，换编号走前排，词表夹在中间；三排的深度 `z`。 */
const LANE = { pieces: -1.6, vocab: 0.6, ids: 2.8 };

/**
 * 数据流转图的布局：文字、拆分与合并、编号三块平台从左往右排开，平台之间的箭头走各自那一排。
 *
 * `slots` 是方块排队的位置：`pieces` 和 `ids` 写了 `alignWith: 'vocab'`，块数和词表那排一样多时逐块对齐，一个块查到哪一行一眼看得出。
 * 字段见 [createFlowView](viz/src/notebook/flow-3d.js#createFlowView)；镜头按平台范围自动取景，不用写坐标。
 */
export const FLOW = {
  plates: [
    { id: 'text', label: '文字', color: '#4fd1c5', x: -10.5, z: LANE.vocab, w: 5, d: 8.4 },
    { id: 'tok', label: '拆分与合并', color: '#6aa8ff', x: 0, z: LANE.vocab, w: 10.5, d: 8.4 },
    { id: 'ids', label: '编号', color: '#a78bfa', x: 11, z: LANE.vocab, w: 6, d: 8.4 },
  ],
  slots: {
    word: { x: -10.5, z: LANE.pieces },
    pieces: { x: 0, z: LANE.pieces, alignWith: 'vocab' },
    vocab: { x: 0.6, z: LANE.vocab, label: '词表' },
    ids: { x: 0, z: LANE.ids, alignWith: 'vocab' },
    out: { x: 11, z: LANE.ids },
  },
  arrows: [
    { id: 'in', from: 'text', to: 'tok', z: LANE.pieces, label: '输入' },
    { id: 'out', from: 'tok', to: 'ids', z: LANE.ids, label: '输出' },
  ],
};

/**
 * 算出数据流转图演示的每一步：同一次拆分与合并，换成看 `hello` 这份数据走过哪几个环节、每一步变成了什么。
 *
 * 词表只画这次用到的几行，按块的顺序排，所以合并之后块和行一一对齐。每一步的字段见 [createFlowView](viz/src/notebook/flow-3d.js#createFlowView)：
 * `blocks` 是这一步的方块（`at` 是 slot 名），`plates` 和 `arrows` 是点亮的平台和箭头。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildFlowScenes() {
  const { letters, at, merged, joined, vocab } = splitAndMerge(WORD);
  const used = joined.map((t) => ({ ...t, num: vocab.indexOf(t.text) }));
  const rows = (tag = 'base') => used.map((t, i) => ({ id: `f:v${i}`, text: `${t.num} ${t.text}`, tag, at: 'vocab' }));
  const nums = (slot, prefix, tag, fromOf) => used.map((t, i) => ({ id: `f:${prefix}${i}`, text: String(t.num), tag, at: slot, from: fromOf?.(i) }));
  const word = (tag = 'base') => ({ id: 'f:word', text: WORD, tag, at: 'word' });
  const pieces = (tagOf = () => 'base') => joined.map((t) => ({ id: `f:${t.id}`, text: t.text, tag: tagOf(t), at: 'pieces' }));
  const pair = letters.slice(at, at + 2).map((t) => `f:${t.id}`);

  // 前面站点的方块一直留着，后一站的方块从它们长出来；只有真正并掉的两个字母飞进新块。
  const steps = [
    {
      phase: '拆分',
      title: '一个词',
      text: `<code>${WORD}</code> 要变成一串编号。中间那排是词表，${vocab.length} 项里只画出这次用到的 ${used.length} 项，每项前面是它的编号。`,
      plates: ['text'],
      blocks: [word('focus'), ...rows()],
    },
    {
      phase: '拆分',
      title: '拆成字母',
      text: `先拆成 ${letters.length} 个字母。块数和词表对不上，还没法逐块查表。`,
      plates: ['tok'],
      arrows: ['in'],
      blocks: [word(), ...letters.map((t) => ({ id: `f:${t.id}`, text: t.text, tag: 'new', at: 'pieces', from: ['f:word'] })), ...rows()],
    },
    {
      phase: '合并',
      title: '并成一块',
      text: `词表里有 <code>${merged.text}</code>，挨着的两个 <code>${merged.text[0]}</code> 并成一块。现在 ${joined.length} 块正好对上词表的 ${used.length} 行。`,
      plates: ['tok'],
      blocks: [word(), ...pieces((t) => (t === merged ? 'new' : 'base')).map((b) => (b.id === `f:${merged.id}` ? { ...b, from: pair } : b)), ...rows()],
    },
    {
      phase: '查表',
      title: '查词表换编号',
      text: `每块在词表里找到自己那一行，换成那一行的编号：${used.map((t) => `${t.text} → ${t.num}`).join('，')}。`,
      plates: ['tok'],
      blocks: [word(), ...pieces(), ...nums('ids', 'n', 'new', (i) => [`f:${used[i].id}`, `f:v${i}`]), ...rows('focus')],
    },
    {
      phase: '查表',
      title: '交出编号',
      text: `最后交出 ${used.map((t) => t.num).join('、')} 这 ${used.length} 个数。按编号反查同一张词表，能原样拼回 <code>${WORD}</code>。`,
      plates: ['ids'],
      arrows: ['out'],
      blocks: [word(), ...pieces(), ...nums('ids', 'n', 'base'), ...nums('out', 'o', 'done', (i) => [`f:n${i}`]), ...rows()],
    },
  ];
  return [{ id: 'example-flow', name: '数据流转', tagline: `${WORD} → 字母 → 块 → 编号`, steps }];
}

/**
 * 「核心概念」一节的概念图：学这个示例要接触的六个概念，分成「使用」和「词表从哪来」两块，连线写明谁产出谁、谁用到谁。
 *
 * 名牌上的数字取自 [splitAndMerge] 和 [preSplit] 这一次计算；每个概念的 `href` 指向讲它的那一章，点开面板就能跳过去。
 * 输入的词和输出的编号由简介讲，其余每个概念各有一章；新增一章时，这里和 [buildConceptScenes] 要一起补上。
 * 画法同 [GRAPH]，字段见 [createGraphView](viz/src/notebook/graph-3d.js#createGraphView)。
 */
export const CONCEPTS = (() => {
  const { counts, vocab, joined } = splitAndMerge(WORD);
  const { chunks } = preSplit(SENTENCE);
  const ids = joined.map((t) => vocab.indexOf(t.text));
  return {
    groups: [
      { id: 'use', label: '使用', color: '#6aa8ff', x: 0, z: -3.9, w: 22, d: 5.2 },
      { id: 'build', label: '词表从哪来', color: '#e2b93b', x: 0, z: 3.1, w: 22, d: 5.2 },
    ],
    nodes: [
      { id: 'word', kind: 'store', label: '词', sub: WORD, x: -7.7, z: -3.5, href: '#intro', desc: '要换成编号的一段文字。' },
      { id: 'pretok', kind: 'process', label: '预分词', sub: `${chunks.length} 块`, x: -2.55, z: -3.5, href: '#pre-split', desc: '合并之前先按空格把一句话切成块。' },
      { id: 'split', kind: 'process', label: '拆分与合并', sub: `${joined.length} 块`, x: 2.55, z: -3.5, href: '#split-merge', desc: '先拆成字母，再把词表里有的相邻两块并成一块。' },
      { id: 'ids', kind: 'store', label: '编号', sub: `[${ids.join(', ')}]`, x: 7.7, z: -3.5, href: '#intro', desc: '每块在词表里的位置，后面的程序只认它。' },
      { id: 'counts', kind: 'table', label: '次数表', sub: `${counts.size} 种字母`, x: -2.75, z: 3.5, href: '#split-merge', desc: '每个字母出现几次，挑出最多又挨着的一对。' },
      { id: 'vocab', kind: 'table', label: '词表', sub: `${vocab.length} 项`, x: 2.75, z: 3.5, href: '#split-merge', desc: '全部字母加上合并出来的新块，一项的位置就是它的编号。' },
    ],
    edges: [
      { id: 'cut', from: 'word', to: 'pretok', label: '切块', desc: '一句话先交给预分词。' },
      { id: 'chunk', from: 'pretok', to: 'split', label: '块', desc: '切好的块交给拆分与合并。' },
      { id: 'encode', from: 'split', to: 'ids', label: '编码', desc: '每块换成编号。' },
      { id: 'lookup', from: 'split', to: 'vocab', label: '查编号', desc: '按块查词表里的位置。', dashed: true },
      { id: 'count', from: 'split', to: 'counts', label: '数次数', desc: '统计每个字母出现几次。' },
      { id: 'add', from: 'counts', to: 'vocab', label: '最多的一对加一项', desc: '出现最多又挨着的一对并成新块，加进词表。' },
    ],
  };
})();

/**
 * 算出概念图演示的每一步：第 1 步看全貌，之后按页面章节的顺序一块块点亮，每步说明末尾链到讲它的那一节。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildConceptScenes() {
  const { counts, vocab, top, merged } = splitAndMerge(WORD);
  const all = CONCEPTS.nodes.map((n) => n.id);
  const go = (href, name) => ` → <a href="${href}">${name}</a>`;
  const steps = [
    {
      phase: '总览',
      title: `${all.length} 个概念，两块`,
      text: `学这个示例要接触的概念就这 ${all.length} 个：<b>使用</b>时把词切块、拆开合并、查词表换成编号；<b>词表</b>来自统计次数。`,
      nodes: Object.fromEntries(all.map((id) => [id, 'base'])),
      focus: all,
    },
    {
      phase: '查表',
      title: '词换成编号',
      text: `词拆开、合并之后，每块查词表换成编号；后面的程序只认编号。${go('#intro', '简介')}`,
      nodes: { word: 'active', pretok: 'base', split: 'active', ids: 'new', vocab: 'active' },
      edges: [{ id: 'cut' }, { id: 'chunk' }, { id: 'lookup' }, { id: 'encode', tone: 'new' }],
      focus: ['word', 'pretok', 'split', 'ids', 'vocab'],
    },
    {
      phase: '预分词',
      title: '先切块',
      text: `合并之前，一句话先按空格切成块，每块再拆成字母。${go('#pre-split', '预分词')}`,
      nodes: { word: 'active', pretok: 'active', split: 'base' },
      edges: [{ id: 'cut' }, { id: 'chunk' }],
      focus: ['word', 'pretok', 'split'],
    },
    {
      phase: '合并',
      title: '词表从哪来',
      text: `${counts.size} 种字母里 <code>${top}</code> 出现最多又挨着，并成 <code>${merged.text}</code> 加进词表，词表就有了 ${vocab.length} 项。${go('#split-merge', '拆分与合并')}`,
      nodes: { split: 'base', counts: 'active', vocab: 'new' },
      edges: [{ id: 'count' }, { id: 'add', tone: 'new' }],
      focus: ['split', 'counts', 'vocab'],
    },
  ];
  return [{ id: 'example-concepts', name: '核心概念', tagline: '使用 → 预分词 → 拆分与合并', steps }];
}

/** 拆分与合并演示的两排：后排训练，前排编码。 */
const STAGE = { train: -2.2, encode: 2.8 };

/**
 * 「拆分与合并」一节的数据流转图：后排是训练，语料 → 字母次数 → 训练结果；前排是编码，训练结果里的规则按顺序套到新词上。
 *
 * 「训练结果」一块平台跨两排，放合并规则和词表：训练往里写，编码从里面读。每排第一行方块离平台后沿留出标题的位置。
 * 字段见 [createFlowView](viz/src/notebook/flow-3d.js#createFlowView)。
 */
export const MERGE_FLOW = {
  plates: [
    { id: 'corpus', label: '语料', color: '#4fd1c5', x: -12, z: STAGE.train, w: 7, d: 3.6 },
    { id: 'counts', label: '字母次数', color: '#e2b93b', x: -2.5, z: STAGE.train, w: 8.5, d: 3.6 },
    { id: 'result', label: '训练结果', color: '#a78bfa', x: 9.5, z: 0.3, w: 9, d: 8.6 },
    { id: 'input', label: '编码新词', color: '#6aa8ff', x: -12, z: STAGE.encode, w: 7, d: 3.2 },
  ],
  slots: {
    word: { x: -12, z: STAGE.train },
    counts: { x: -2.5, z: STAGE.train },
    rules: { x: 9.5, z: STAGE.train, label: '规则' },
    v0: { x: 9.8, z: 0.4, label: '词表' },
    v1: { x: 9.8, z: 1.8 },
    input: { x: -12, z: STAGE.encode },
  },
  arrows: [
    { id: 'count', from: 'corpus', to: 'counts', z: STAGE.train, label: '数次数' },
    { id: 'merge', from: 'counts', to: 'result', z: STAGE.train, label: '最多的合并' },
    { id: 'apply', from: 'result', to: 'input', z: STAGE.encode, label: '按顺序套用' },
  ],
};

/**
 * 算出拆分与合并演示的每一步：训练一轮（数次数、合并并记成规则），再给训练时没见过的词编码，规则按顺序一条条套。
 *
 * 训练的数取自 [splitAndMerge]，编码的数取自 [encodeByRules]，和方块演示、组件图读的是同一份记录。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildMergeScenes() {
  const { letters, counts, top, times, at, merged, joined, rules, again } = splitAndMerge(WORD);
  const word = (list, tagOf) => list.map((t, i) => ({ id: `m:${t.id}`, text: t.text, tag: tagOf(t, i), at: 'word', from: t.from }));
  const tally = (skip) => [...counts].filter(([ch]) => ch !== skip).map(([ch, n]) => ({ id: `m:n:${ch}`, text: `${ch} ${n} 次`, tag: ch === top ? 'focus' : 'base', at: 'counts' }));
  const ruleBlocks = (tagOf = () => 'base') => rules.map((r, k) => ({ id: `m:rule${k}`, text: `#${k + 1}  ${r.left} + ${r.right} → ${r.joined}`, tag: tagOf(k), at: 'rules' }));
  const vocab = (tagOf = () => 'base') => [
    ...[...counts.keys()].map((ch) => ({ id: `m:v:${ch}`, text: ch, tag: 'base', at: 'v0' })),
    ...rules.map((r, k) => ({ id: `m:v:${r.joined}`, text: r.joined, tag: tagOf(r.joined), at: 'v1', from: [`m:rule${k}`] })),
  ];
  const initialVocab = vocab().filter((b) => b.at === 'v0');
  const pieceBlocks = (list, tagOf) => list.map((p) => ({ id: `m:e:${p.id}`, text: p.text, tag: tagOf(p), at: 'input', from: p.from?.map((f) => `m:e:${f}`) }));

  const train = [
    {
      phase: '训练',
      title: '数次数',
      text: `训练从单字开始：「${WORD}」拆成 ${letters.length} 个字母，数每个字母出现几次。示例把 BPE 简化成只数单个字母：<b>${top}</b> ${times} 次，最多，而且两个挨在一起。`,
      plates: ['corpus', 'counts'],
      arrows: ['count'],
      blocks: [...word(letters, (t, i) => (i === at || i === at + 1 ? 'focus' : 'base')), ...tally(), ...initialVocab],
    },
    {
      phase: '训练',
      title: '合并 #1',
      text: `语料里挨着的两个「${top}」并成「${merged.text}」，记成合并规则 #1，「${merged.text}」加进词表。${again ? '' : '并完再看，没有挨着的同一字母了，训练结束。'}`,
      plates: ['counts', 'result'],
      arrows: ['merge'],
      blocks: [
        ...word(joined.map((t) => (t === merged ? { ...t, from: letters.slice(at, at + 2).map((l) => `m:${l.id}`) } : t)), (t) => (t === merged ? 'new' : 'base')),
        ...tally(top).map((b) => ({ ...b, tag: 'base' })),
        ...ruleBlocks(() => 'new').map((b) => ({ ...b, from: [`m:n:${top}`] })),
        ...vocab((t) => (t === merged.text ? 'new' : 'base')),
      ],
    },
  ];

  const enc = encodeByRules(rules, SAMPLE);
  // 编码时训练那一排的方块都留着，变暗：语料、剩下的次数都还在，看得出规则是从哪来的。
  const trained = [...word(joined, () => 'muted'), ...tally(top).map((b) => ({ ...b, tag: 'muted' }))];
  const ruleState = (current) => (k) => (k === current ? 'focus' : k > current ? 'base' : enc.trace[k].applied ? 'done' : 'muted');
  const last = enc.trace.at(-1).pieces;
  const encode = [
    {
      phase: '编码',
      title: '拆字',
      text: `编码训练时没见过的「${SAMPLE}」：先拆成单字，再按规则的先后一条条套。`,
      plates: ['input'],
      blocks: [...trained, ...ruleBlocks(), ...vocab(), ...pieceBlocks(enc.start, () => 'base')],
    },
    ...enc.trace.map((t, k) => {
      const rule = `规则 #${k + 1}「${t.rule.left} + ${t.rule.right}」`;
      const done = k === enc.trace.length - 1 ? `「${SAMPLE}」编码成 ${last.map((p) => p.text).join(' / ')}，共 ${last.length} 块。` : '';
      return {
        phase: '编码',
        title: `规则 #${k + 1}`,
        text: `${t.applied ? `${rule}：有这一对，并成「${t.rule.joined}」。` : `${rule}：没有这一对，跳过。`}${done}`,
        plates: ['result', 'input'],
        arrows: ['apply'],
        blocks: [
          ...trained,
          ...ruleBlocks(ruleState(k)),
          ...vocab((j) => (t.applied && j === t.rule.joined ? 'focus' : 'base')),
          ...pieceBlocks(t.pieces, (p) => (p.from ? 'new' : 'base')),
        ],
      };
    }),
  ];
  return [{ id: 'example-merge', name: '拆分与合并', tagline: '训练记下规则，编码按顺序套用', steps: [...train, ...encode] }];
}
