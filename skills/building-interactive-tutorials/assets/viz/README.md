# 3D 交互教程

每个知识点一页，像 Jupyter 笔记本一样从上到下讲完：文字格子、代码格子和 3D 动画格子穿插排列。产出是一个自带全部脚本的 HTML，双击就能离线打开。

| 页面 | 知识点 |
|---|---|
| `example.html` | 示例：拆分与合并 |

## 页面结构

每页按顺序分成下面几节：

1. **xx 是什么**：一句话讲清楚，最好配一个项目里的真实例子（代码格子，In / Out 用真实运行结果）。
2. **目的和动机**：为什么需要它，不用它会怎样，取舍是什么。
3. **工作原理**：讲主流做法，配一个 3D 演示。
4. **子主题**：同一主题下的其它知识点，每个子主题单独一节。节内用三级标题分点，每点配代码格子或 3D 演示，最后可以放一个对比演示。

二级、三级标题都会进左侧目录，三级标题缩进在所属的二级标题下面。

## 写正文的规矩

- **涉及另一个知识点或外部产品的词，第一次出现时加链接**，只链官方或权威来源：
  - 机器学习概念：[Google 机器学习术语表](https://developers.google.com/machine-learning/glossary?hl=zh-cn)（中文版，锚点如 `#neural-network`）。
  - NLP 概念：[HuggingFace LLM 课程](https://huggingface.co/learn/llm-course/zh-CN/chapter1/1)中文版。
  - 库、模型、工具：官网、官方文档或官方仓库；论文链 arXiv 摘要页。
  - 不链博客、教程、问答和镜像。写进页面前先确认链接能打开、锚点存在。
  - 仓库里的文件用相对路径链接，例如 `../src/train.py`；本地打开页面时，点击会在 VS Code 里打开这个文件。
- **代码格子标上语言**：`<pre class="code-in" data-lang="python">`，打包时用 [Shiki](https://shiki.style) 上色。Out 写真实运行结果。

## 目录

```
viz/
├── build.mjs                 打包：src/topics/<名字>/ → <名字>.html
└── src/
    ├── notebook/             所有页面共用的外壳
    │   ├── notebook.css      格子排版和样式
    │   ├── player.js         演示格子的播放器：翻页、播放、滚出视野时暂停
    │   ├── runtime.js        启动页面：挂载演示，生成两级的左侧目录
    │   └── tiles-3d.js       3D 画面：一排排方块、打分条和词表
    └── topics/
        └── example/          一个知识点一个目录
            ├── notebook.html 正文：按上面四节写的格子
            ├── main.js       把演示名对应到演示内容
            └── steps.js      算出演示每一步的数据
```

## 加一个新知识点

1. 新建 `src/topics/<名字>/`，照 `example/notebook.html` 写正文。格子有三种：
   - `<section class="cell text">`：文字，`<h2>` 是一节标题，`<h3>` 是节内小标题，都会进左侧目录。
   - `<section class="cell code">`：代码，In 和 Out 各一个 `<pre>`。
   - `<section class="cell demo" data-scene="名字">`：3D 演示，`名字` 对应 `main.js` 里注册的演示。

   文字格子里还能放两种排版，样式在 `notebook.css`：
   - `<svg class="diagram">`：手写的结构图，方框用 `box`，本项目用到的加 `used`，可选的加 `optional`，连线用 `edge`。
   - `<div class="cards">`：一组并列的卡片，每张卡片里的 `<ul>` 一行一个名字加解释，本项目用的那行加 `pick`。
2. 在 `main.js` 里调用 `startNotebook({ 名字: { name, tagline, steps, createView } })`：
   - `steps`：每一步的画面数据和说明文字（`phase`、`title`、`text`）。`phase` 决定说明栏左边小标签的颜色，新阶段名要在 `notebook.css` 里配一个颜色。
   - `createView`：返回一个画面，提供 `mount(stage)`、`render(step, { reset })`、`setActive(active)` 三个方法。
3. 在 `viz` 目录运行 `pnpm build`，生成 `<名字>.html`。
