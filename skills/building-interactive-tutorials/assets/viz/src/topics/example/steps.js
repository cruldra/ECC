const WORD = 'hello';

/** 数每个字母出现几次，按第一次出现的顺序排，打分条和词表都按这个顺序摆。 */
function countLetters(word) {
  const counts = new Map();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

/**
 * 算出示例演示的每一步：把 `hello` 拆成字母，数出出现最多的字母，再把挨着的两个并成一块。
 *
 * 这里的数据从输入算出来，换个词演示跟着变；真实教程要从真实运行结果算，或者照真实输出写死。
 * 每一步的字段见 [createTilesView](viz/src/notebook/tiles-3d.js#createTilesView)：同一 `id` 的块换步时滑到新位置，带 `from` 的块从来源块中间长出来。
 *
 * @return 演示列表，每项是 `{ id, name, tagline, steps }`，`id` 对应正文里格子的 `data-scene`
 */
export function buildExampleScenes() {
  const letters = [...WORD].map((text, i) => ({ id: `c${i}`, text }));
  const counts = countLetters(WORD);
  const [top, times] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const at = letters.findIndex((t, i) => t.text === top && letters[i + 1]?.text === top);
  const pair = new Set([at, at + 1]);
  const merged = { id: 'merged', text: top + top };
  const joined = [...letters.slice(0, at), merged, ...letters.slice(at + 2)];

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
