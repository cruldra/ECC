# 3D 交互教程

一个主题一页，产出是一个自带全部脚本的 HTML，双击就能离线打开。页面分两种：

- **学习页**：想搞清楚一个项目（多半是开源项目）某一块的内部逻辑。像 Jupyter 笔记本一样从上到下讲完：文字格子、代码格子和 3D 动画格子穿插排列，带子主题。
- **改造页**：要在现有代码上修问题或做优化，现有机制可能被换掉。只有两节：现状、解决方案，各一段说明加一段 3D 演示。

| 页面 | 种类 | 主题 |
|---|---|---|
| `example.html` | 学习页 | 示例：拆分与合并 |
| `example-change.html` | 改造页 | 示例：次数表更新 |

## 页面结构

**学习页**按顺序分成下面几节：

1. **xx 是什么**：一句话讲清楚，最好配一个项目里的真实例子（代码格子，In / Out 用真实运行结果）。
2. **目的和动机**：为什么需要它，不用它会怎样，取舍是什么。
3. **工作原理**：讲主流做法，配一个 3D 演示。
4. **子主题**：同一主题下的其它知识点，每个子主题单独一节。节内用三级标题分点，每点配代码格子或 3D 演示，最后可以放一个对比演示。

二级、三级标题都会进左侧目录，三级标题缩进在所属的二级标题下面。

**改造页**只有两节，不放代码格子、表格、卡片和子主题：

1. **现状**（`<h2 id="now">`）：一段话说现在怎么运作、哪里出问题，再放一段组件图演示，数据取自一次真实运行，问题标成 `gap`。
2. **解决方案**（`<h2 id="next">`）：一段话说改了什么、为什么能解决，再放一段组件图演示，数据取自设计文档。

两段演示各用一张图（`GRAPH_NOW`、`GRAPH_NEXT`）：两张图里都有的组件 `id` 和位置一样，去掉的组件不放进方案图，新的或改过的用 `new`。方案的步骤尽量和现状一步对一步。细节（命令、数据行、提交号）放进 `details`，读者点开看，说明文字一两句。

## 写正文的规矩

- **涉及另一个知识点或外部产品的词，第一次出现时加链接**，只链官方或权威来源：
  - 机器学习概念：[Google 机器学习术语表](https://developers.google.com/machine-learning/glossary?hl=zh-cn)（中文版，锚点如 `#neural-network`）。
  - NLP 概念：[HuggingFace LLM 课程](https://huggingface.co/learn/llm-course/zh-CN/chapter1/1)中文版。
  - 库、模型、工具：官网、官方文档或官方仓库；论文链 arXiv 摘要页。
  - 不链博客、教程、问答和镜像。写进页面前先确认链接能打开、锚点存在。
  - 仓库里的文件用相对路径链接，例如 `../src/train.py`；本地打开页面时，点击会在 VS Code 里打开这个文件。
- **代码格子标上语言**：`<pre class="code-in" data-lang="python">`，打包时用 [Shiki](https://shiki.style) 上色。Out 写真实运行结果。
- **输出是一张表时不贴对齐好的文本**：命令行按字符数补空格对齐列，浏览器里一个汉字占两格，列就歪了；值里有换行会把一行拆散，长值会冲出右边。让命令打印 JSON（`--json`、`-o json`、`--format json`），没有这个选项就让格子的脚本通过命令背后的接口或库取同样的行打印成 JSON；Out 写成 `<div class="code-out out-table"><table>`，一个值一格，原样转义，值里的换行保留。

## 目录

```
viz/
├── build.mjs                 打包：src/topics/<名字>/ → <名字>.html
└── src/
    ├── notebook/             所有页面共用的外壳
    │   ├── graph-3d.js       3D 组件图：分组平台、组件方块和圆柱、带箭头的连线；悬停看说明，点击看这一步的数据
    │   ├── notebook.css      格子排版和样式
    │   ├── player.js         演示格子的播放器：翻页、播放、滚出视野时暂停
    │   ├── runtime.js        启动页面：挂载演示，生成两级的左侧目录
    │   └── tiles-3d.js       3D 画面：一排排方块、打分条和词表
    └── topics/
        ├── example/          学习页示例，一个主题一个目录
        │   ├── notebook.html 正文：按上面四节写的格子
        │   ├── main.js       把演示名对应到演示内容，给每段演示配上画面
        │   └── steps.js      算出两段演示每一步的数据，以及组件图的定义（GRAPH）
        └── example-change/   改造页示例
            ├── notebook.html 正文：现状、解决方案各一段话加一段演示
            ├── main.js       现状演示配现状的图，方案演示配方案的图
            └── steps.js      两张图（GRAPH_NOW、GRAPH_NEXT）和两段演示的步骤
```

## 加一个新知识点

1. 新建 `src/topics/<名字>/`，学习页照 `example/notebook.html`、改造页照 `example-change/notebook.html` 写正文。格子有三种：
   - `<section class="cell text">`：文字，`<h2>` 是一节标题，`<h3>` 是节内小标题，都会进左侧目录。
   - `<section class="cell code">`：代码，In 和 Out 各一个 `<pre>`；输出是一张表时 Out 换成 `<div class="code-out out-table"><table>`。
   - `<section class="cell demo" data-scene="名字">`：3D 演示，`名字` 对应 `main.js` 里注册的演示。

   文字格子里还能放两种排版，样式在 `notebook.css`：
   - `<svg class="diagram">`：手写的结构图，方框用 `box`，本项目用到的加 `used`，可选的加 `optional`，连线用 `edge`。
   - `<div class="cards">`：一组并列的卡片，每张卡片里的 `<ul>` 一行一个名字加解释，本项目用的那行加 `pick`。
2. 在 `main.js` 里调用 `startNotebook({ 名字: { name, tagline, steps, createView } })`：
   - `steps`：每一步的画面数据和说明文字（`phase`、`title`、`text`）。`phase` 决定说明栏左边小标签的颜色，新阶段名要在 `notebook.css` 里配一个颜色。
   - `createView`：返回一个画面，提供 `mount(stage)`、`render(step, { reset })`、`setActive(active)` 三个方法。现成的有两种，见下一节。
3. 在 `viz` 目录运行 `pnpm build`，生成 `<名字>.html`。

## 两种 3D 画面

- **方块画面** `createTilesView`（`tiles-3d.js`）：讲一串东西怎么变成另一串，比如文字拆成块、块合并、块换成编号。每一步给 `rows`，可选 `bars`、`vocab`。
- **组件图** `createGraphView(GRAPH)`（`graph-3d.js`）：讲一个系统里几个组件怎么互相调用、读写、引用，而且每一步动的组件不同。`GRAPH` 是整页共用的一张图，`groups` 是地面上的平台，`nodes` 是组件（`kind` 取 `process`、`store`、`table`、`ref`，要别的种类在 `GRAPH.kinds` 里补），`edges` 是连线（`dashed` 画成虚线，表示引用）。每一步给：
  - `nodes`：点亮哪些组件，状态是 `active`、`new`、`gap`、`base`、`off`，没列出的变暗；
  - `edges`：点亮哪些连线，可带 `label` 和 `tone`，点亮的连线上有点在流动；
  - `badges`：名牌第三行挂的数据；`details`：悬停和点开时看到的几行数据；
  - `focus`：镜头要看全的组件。

  悬停组件看说明和前四行数据，点击固定一个面板看全部，双击把镜头拉回这一步。组件图的名牌多，演示格子写成 `<section class="cell demo" data-scene="名字" style="--stage-height: 560px">` 加高画面。

示例页 `example.html` 两种都有，同一次拆分与合并各演示一遍。

## 真实运行录制

讲的是一个系统随操作变化的状态时（同步进程、Git 服务器、数据库），录一次真实运行，代码格子的 Out、正文里的数字和 3D 演示都从这一次运行里取，三者不会对不上：

```
runs/
├── demo.py             演示环境：包装被测代码执行命令用的执行器（沙箱类、subprocess.run），
│                       把每条命令和输出记进日志；frame(名字) 把那一刻的系统状态和这段时间的命令存成一帧
├── c*.py               每个代码格子的 In，按 run_all.sh 里的顺序接着跑
├── run_all.sh          按顺序重跑全部格子，把输出和帧拷进 out/
├── out/                每格的真实输出、全部帧、运行时存下的值
├── notebook.tpl.html   正文模板：代码格子写成 <!--CELL:名字-->，运行得出的值写成 {{sha:名字}}
└── fill_cells.py       In、Out 原文只做 HTML 转义填进模板，Out 是 JSON 行时排成表格，生成 notebook.html；帧写成 trace.js 给 steps.js 用
```

改正文改模板，不要手改生成的 `notebook.html` 和 `trace.js`。重跑依次是 `sh runs/run_all.sh`、`python3 runs/fill_cells.py`、`pnpm build`，提交号之类的值全部跟着换新。
