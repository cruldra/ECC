---
name: building-interactive-tutorials
description: '在用户要求将代码仓库中的概念讲解为笔记本式交互教程页面（类似 MiniMind 中的 viz/tokenizer.html）时使用（3D 交互教程、笔记本式教程、可视化讲解、做一份像 tokenizer.html 这样的教程），或要求向此类页面添加章节、子主题、代码格子、结构图或 3D 演示时使用。页面是一个离线 HTML 文件，从上到下阅读：文字格子、输出为真实运行结果的代码格子、由真实结果计算而来的分步 three.js 演示、内嵌 SVG 结构图和卡片；esbuild 会内联脚本，Shiki 会在构建时为代码着色。涵盖如何根据 assets/viz 中的脚手架设置 viz/、页面大纲（是什么、为什么、工作原理、子主题）、将每个术语链接到官方页面并用 scripts/check_links.py 检查、3D 画面动画所用的步骤数据，以及完成前在 agent-browser 中逐步点击检查。'
locale: zh-CN
source_hash: 104415cbd13f5c82a2a9a17199814a3cb2128c0e12b1f4d21fd049c04a7416e4
translated_at: 2026-11-24T02:49:20Z
translation_model: gpt-6-luna
---

# 构建交互式教程

一个概念，一页，像 Jupyter notebook 一样从上到下阅读：文字格子、代码格子和 3D 演示格子交替出现。最终输出是一个自带脚本和样式的 HTML 文件，双击即可离线打开。两条规则贯穿整个页面：每个数字都来自运行仓库自身的代码，每个外部术语都链接到一个在加入前实际打开过的官方页面。

## 适用场景

- 用户要求制作交互式、3D 或笔记本式教程，讲解仓库中的某个概念：3D 交互教程、可视化讲解、“做一份像 tokenizer.html 这样的教程”。
- 为 `viz/` 下的现有页面添加子主题、章节、代码格子、结构图、卡片组或演示。
- 为方块画面无法展示的概念构建新的 3D 画面。

不适用于幻灯片（`frontend-slides`）、视频（`manim-video`、`remotion-video-creation`）或独立图表（`diagram-design`）。

## 工作原理

`${CLAUDE_SKILL_DIR}` 是此 SKILL.md 所在目录。当命令中的路径不是以 `/` 开头时，将 `/assets/` 或 `/scripts/` 之前的部分替换为该目录的绝对路径。

### 1. 一次性设置 viz/

如果 `viz/` 已存在，先阅读 `viz/README.md`：它是项目版的这些规则，并列出了已构建的页面。否则复制脚手架并用命令添加依赖，不指定版本：

```bash
cp -R ${CLAUDE_SKILL_DIR}/assets/viz ./viz
cd viz
pnpm init
pnpm pkg set type=module scripts.build="node build.mjs"
pnpm add three
pnpm add -D esbuild shiki
pnpm approve-builds esbuild
pnpm build
```

在 `approve-builds` 允许之前，pnpm 会拒绝运行 esbuild 的安装脚本。`pnpm build` 会生成 `example.html`，可将其作为正常工作的页面进行对照。用真实内容替换后，将 `src/topics/example/` 重命名为概念名称，并更新 `viz/README.md` 中的页面表格。

```
viz/
├── build.mjs                 src/topics/<name>/ → <name>.html，全部内联
├── README.md                 页面列表、写作规则、添加主题的方法
└── src/
    ├── notebook/             所有页面共用的外壳
    │   ├── notebook.css      格子排版、结构图和卡片样式、阶段颜色
    │   ├── player.js         演示播放器：翻页、自动播放、离开视口时暂停
    │   ├── runtime.js        挂载演示、构建两级目录、在 VS Code 中打开仓库链接
    │   └── tiles-3d.js       3D 画面：一排排方块、打分条、词表
    └── topics/example/
        ├── notebook.html     正文格子
        ├── main.js           用场景名称注册各个演示
        └── steps.js          计算每个演示步骤
```

浏览器拒绝从 `file://` 页面加载本地 ES 模块，因此 `build.mjs` 会用 esbuild 将每个主题的脚本打包成一个内联脚本，并在构建时用 Shiki 为代码着色。将构建好的 `<name>.html` 与源文件一起提交，这样读者无需构建即可打开。

### 2. 研究代码并运行

1. 阅读实现该概念的代码路径：训练或构建它的脚本、配置、数据加载器和调用方。记录将要提及的每个文件和符号；之后要链接到它们。
2. 从仓库根目录用项目的运行器（`uv run python ...`）运行准备展示的每段代码。将输出原样粘贴到 Out 区块中。不要凭记忆编写输出，也不要手动整理。
3. 记录将要链接的库的已安装版本（`uv pip show <package>`），确保文档链接与版本匹配。
4. 页面中陈述的每项事实（数量、id、大小、范围）都必须来自这些运行结果或仓库文件。

### 3. 规划页面大纲

按以下顺序分为四个部分：

1. **是什么**（`<X> 是什么`）：先用一个简单句说明，再通过代码格子展示仓库中的真实示例。
2. **为什么**（`目的和动机`）：说明为什么需要它、没有它会出什么问题，以及其中的取舍。
3. **工作原理**（`工作原理`）：介绍主流方法，并配有 3D 演示。
4. **子主题**：每个相关要点使用一个 `<h2>`，其中每个项目使用一个 `<h3>`，每项都配有代码格子或演示。比较演示可以作为子主题的结尾。

- `<h2>` 和 `<h3>` 会进入左侧目录，`<h3>` 会缩进显示在对应的 `<h2>` 下方。为其他格子会链接到的每个标题设置 `id`；标题移动时，生成的 id 会改变。
- 关于某个库的参考资料（其组件、文件）应作为独立子主题，而不是附录。
- 标题栏应包含返回索引页的面包屑，并注明示例所属的项目。

### 4. 编写格子

```html
<section class="cell text">
  <h2 id="how">工作原理</h2>
  <p>…</p>
</section>

<section class="cell code">
  <div class="cell-gutter">In</div>
  <pre class="code-in" data-lang="python">print(tok.convert_ids_to_tokens([1]))</pre>
  <div class="cell-gutter">Out</div>
  <pre class="code-out">['&lt;|im_start|&gt;']</pre>
</section>

<section class="cell demo" data-scene="special-tokens"></section>
```

- 对两个 `<pre>` 块中的 `<`、`>` 和 `&` 进行转义。构建时会在 Shiki 着色前还原 `code-in`；`code-out` 则按原样显示。
- 文字格子也可以包含 `<table>`、`<p class="note">`，以及 `notebook.css` 中定义的两种布局：
  - `<svg class="diagram">`：手写，`viewBox` 宽度为 1000。方框使用 `box`；为项目实际使用的部分添加 `used`，可选部分添加 `optional`；输入和输出使用 `end`；连接线使用 `edge`，并带有一个页面内 id 唯一的箭头 `<marker>`；文本类为 `name`、`role`、`mono`、`lane`。将方框包在 `<a href="#card-id">` 中可跳转到对应卡片。
  - `<div class="cards">`：每个项目一个 `.card`，并设置各自的 `id`：包含带 `<small>` 代码名称的 `<h4>`、一个 `<p>`，以及一个 `<ul>`；其中的 `<li>` 包含两个子项，分别是名称和含义。`li.pick` 用于标记项目实际使用的内容。
- 仅对项目实际使用的内容添加强调样式（`used`、`pick`）。
- 使用简体中文写作：句子简短直白，每句表达一个事实。术语首次出现时，用日常语言解释。说明原因，不要只解释是什么。
- `steps.js`、`main.js` 和任何新画面中的注释遵循 `writing-code-comments`。

### 5. 将每个术语链接到官方页面

其他概念或外部产品首次出现时，应链接到官方页面：

| 术语 | 链接到 |
| --- | --- |
| 机器学习概念 | 中文版 [Google ML 术语表](https://developers.google.com/machine-learning/glossary?hl=zh-cn)，并带上相应锚点，例如 `#token` |
| NLP 概念 | 中文版 [Hugging Face LLM 课程](https://huggingface.co/learn/llm-course/zh-CN/chapter1/1) |
| 库、模型、工具 | 其官方文档、网站或代码仓库；使用与已安装版本匹配的文档 |
| 论文 | arXiv 摘要页 |
| 仓库中的文件 | 相对于构建页面的路径，例如 `../trainer/train_tokenizer.py`；从 `file://` 打开时，运行时会将其转换为 `vscode://` 链接 |

不要链接博客、教程、问答答案或镜像。当已安装版本没有文档（返回 404）时，使用最接近的已发布版本，并对同一文档中的所有链接保持一致。当锚点不存在时，改为链接到附近存在的锚点，或链接到页面本身。

每次构建后，检查构建页面中的所有链接：

```bash
uv run ${CLAUDE_SKILL_DIR}/scripts/check_links.py viz/<name>.html
```

它会获取每个外部页面一次，并检查其状态及页面上用到的每个锚点；同时检查仓库路径是否存在，以及每个 `#id` 是否位于当前页面上。每个失效链接都会打印一行 `FAIL`；只要存在失效链接就以状态码 1 退出。`--offline` 会跳过网络检查。

### 6. 根据真实结果计算演示

演示由一系列步骤组成，每个步骤展示一项变化。方块画面读取以下字段：

```js
{
  phase: '合并',                       // 说明栏的阶段标签；新阶段需要在 notebook.css 中设置颜色
  title: '并成一块',
  text: '把挨着的两个 <code>l</code> 并成 <code>ll</code>。',  // HTML，一到三句话
  rowsTitle: '输入',                    // 可选的行标题
  rows: [{ key: 'word', label: '「hello」', tiles: [
    { id: 'c0', text: 'h', tag: 'base' },
    { id: 'merged', text: 'll', tag: 'new', from: ['c2', 'c3'] },
  ] }],
  bars: { title: '每个字母出现几次', items: [{ key: 'l', label: 'l', value: 2, display: '2 次', tag: 'focus' }] },  // 可选
  vocab: { title: '词表', items: [{ key: 'll', text: 'll', tag: 'new' }] },  // 可选
}
```

- 方块的 `id` 在各步骤间保持不变，因此会滑到新的位置。带有 `from` 的新方块会从这些方块生成；消失且出现在 `from` 中的方块会飞入新方块；其他消失的方块会下沉消失。
- 标签：`base` 普通，`focus` 当前步骤关注对象，`new` 刚生成，`done` 已完成，`muted` 未涉及，`unk` 未知，`removed` 即将移除。
- 根据步骤 2 的输出，在数据模块（`steps.js`，或每个子主题一个模块）中计算步骤：要么用 JavaScript 重写小型算法并与库的输出核对，要么将真实 id 和片段复制到常量中，并用注释说明来源。
- 在 `main.js` 中通过 `startNotebook({ [id]: { name, tagline, steps, createView } })` 注册每个场景；演示格子的 `data-scene` 就是对应的 `id`。
- 当方块画面无法展示该概念时，另写一个画面，使其返回 `mount(stage)`、`render(step, { reset })` 和 `setActive(active)`，并保留播放器。

### 7. 构建并逐步点击检查

```bash
pnpm build
```

在 `viz/` 中运行，然后用 `agent-browser`（参见对应技能）在单独的 `--session` 中检查构建页面：

1. 打开 `file://<absolute path>/viz/<name>.html`。`agent-browser errors` 和 `agent-browser console` 不应打印任何内容。
2. 对每个演示：滚动到可见区域，逐步检查，并确认计数器到达最后一步，且每个说明文字都与场景相符。演示只有滚动进入视口后才会创建 3D 画面。
3. 给每个新结构图、卡片组和表格截图；所有文字都应位于框内。
4. 目录应列出每个新增的 `<h2>` 和 `<h3>`，滚动时高亮项应随之更新。

页面设置了 `scroll-behavior: smooth`，因此跳转后立即截图会捕捉到页面滚动过程中的画面。先立即跳转：

```bash
agent-browser --session tutorial eval "document.getElementById('how').scrollIntoView({ behavior: 'instant' })"
```

### 8. 更新索引

- `viz/README.md`：更新页面表格、新数据模块的目录树，以及任何新增的格子写法。
- 任何链接到这些教程的索引页（路线图、文档首页）：添加新页面或子主题。

## 示例

**完整页面。** MiniMind 分词器页面的大纲：

```
分词器是什么      code: 对两个句子进行编码，展示真实 ids 和片段
目的和动机
工作原理          demo: BPE 训练，然后编码
算法              每种算法（WordPiece、Unigram、WordLevel）各一个 h3 和演示，最后添加比较演示
预分词器          每种预分词器各一个 h3 和演示
特殊 token        h3: 每个标记对应一个 token / 三组 token 的作用 / 在训练和推理中的使用，配有演示
tokenizers        h3: 常用组件（SVG 结构图 + 卡片）、tokenizer.json（流程图 + 关键表格）
```

**子主题。** 请求：“加一个子主题讲解这几个 special tokens”。

1. 阅读 `train_tokenizer.py` 中定义 token 列表的位置，再查看它们的使用位置：数据集代码、聊天模板和推理服务器。
2. 运行三个代码片段：分成三组的 36 个新增 token、将一个已注册标记与一个未注册的相似字符串进行对比，以及通过 encode 和 decode 完成一次聊天模板往返。
3. 添加 `<h2 id="special-tokens">` 和三个 `<h3>`，每个标题下各放一个代码格子。
4. 将真实的聊天模板片段复制到 `special-tokens.js`，并据此计算包含八个步骤的演示；为新阶段 `模板` 和 `解码` 添加颜色。
5. 构建、运行 `check_links.py`、逐步检查全部八个步骤，并将该模块添加到 `viz/README.md` 的目录树中。

## 常见错误

| 错误 | 修正方法 |
| --- | --- |
| 凭记忆编写 Out 区块，或手动整理输出 | 重新运行代码片段，并原样粘贴输出 |
| 链接到博客，或链接到没有实际打开过的锚点 | 仅使用官方页面；运行 `check_links.py` |
| 已安装版本的文档返回 404 | 使用最接近的已发布版本，并在所有链接中保持一致 |
| 代码格子中 `<` 未转义，导致浏览器将其解析为标签 | 写作 `&lt;`、`&gt;`、`&amp;` |
| 新阶段名称没有对应颜色 | 在 `notebook.css` 中添加 `.demo-meta .phase[data-phase="…"]` |
| 方块 id 在各步骤间变化，导致方块跳跃而不是滑动 | 整个演示中每个片段都使用同一个 id |
| 一个步骤中包含多项变化 | 拆分；一步只包含一项变化 |
| 截图时页面仍在滚动 | 先使用 `behavior: 'instant'` 滚动 |
| 文字溢出结构图方框 | 加宽方框后重新截图 |
| 链接到没有 `id` 的标题 | 为标题添加 `id` |
| 将库参考资料列为附录 | 将其设为拥有独立 `<h2>` 的子主题 |
| 编辑构建后的 `<name>.html` | 编辑源文件并重新构建 |

## 完成前检查

- [ ] 每个 Out 区块都来自真实运行，并原样粘贴；正文中的每个数字都与运行结果或仓库内容相符。
- [ ] `check_links.py` 检查构建页面时输出 `OK`。
- [ ] 每个演示都能从第一步运行到最后一步且没有错误；每个新阶段都设置了颜色。
- [ ] 每个新增的结构图、卡片组和表格都已截图，且没有内容溢出。
- [ ] `viz/README.md` 和任何索引页都列出新页面或子主题，构建后的 HTML 也已根据源文件重新生成。

## 来源

内容提炼自为 [MiniMind](https://github.com/jingyaogong/minimind) 构建分词器教程（`viz/tokenizer.html`）的实践经验。`assets/viz` 中的脚手架是该页面的外壳，其中的分词器内容已替换为一个小型示例。
