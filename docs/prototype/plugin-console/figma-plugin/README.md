# ECC Plugin Console Design Lab

用于 Figma Desktop 的本地开发插件。运行后，在当前 Design 文件中新建一页，生成插件控制台：只读目录（Skill / Hook / Command）和顶栏把整份 ECC 装到 Claude Code / Codex。不修改业务代码，不联网。

## 导入与运行

1. 打开 Figma Desktop，并打开一个可编辑的 **Design 文件**，不能停留在首页。
2. 进入 `Plugins > Development > Import plugin from manifest…`。
3. 选择本目录的 `manifest.json`。
4. 从 `Plugins > Development` 运行 `ECC Plugin Console Design Lab`。
5. 选中 `Prototype / Skill · 双未装`，点右上角演示。流程入口名是「控制台」。

插件无需安装依赖或构建。只使用 Figma Plugin API。本地开发清单不填写发布用的插件 ID；节点元数据用 `setSharedPluginData("ecc", …)`。

### 运行条件

- Design 文件允许新增页面。达到上限时换一个有空余页名额的文件。插件不会删旧页面腾位置。
- Figma 中至少有一种可用中文字体：`PingFang SC`、`Noto Sans CJK SC`、`Noto Sans SC`、`Source Han Sans SC`，按此顺序选择。只加载 Regular 和 Medium；没有 Medium 时用 Regular。
- 若缺少中文字体，插件在创建页面之前报告错误。

## 生成内容

每次运行新建 `ECC 插件控制台 · Design Lab` 页面。已有同名则加 `2`、`3`。不覆盖旧页。

- **开始 / 设计说明**
- **组件集**（页面右侧）：
  - `Harness / Card`：`Harness=claude|codex` × `State=missing|installed|update`（6）
  - `Type / Nav`：`Kind=skill|hook|command` × `Selected=on|off`（6）
  - `Filter / Chip`：`Selected=on|off`（2）
  - `Catalog / Row`：`Kind=skill|hook|command` × `Selected=on|off`（6）
  - `Dialog / Confirm`：`Kind=install|uninstall|update`（3）
- **Prototype 画板**（15）：Skill 四态、Hook、Command、四个确认弹窗、编辑原文（无译本 / 有译本）、简体中文、简体中文已过时。

列表样例是真实 ECC 名字（grilling、SessionStart、/plan-prd 等），不是 287 条全量。分类芯片用 `install-modules` 分组名。

## 原型交互

- Skill / Hook / Command 导航在「双未装」画板之间跳转。
- Claude「安装」→ 确认 → Skill · Claude 已装。
- 再点 Codex「安装」→ 确认 → 双已装。
- Claude「卸载」→ 确认 → 双未装。
- 「可更新」画板点「更新」→ 确认 → 双已装。
- Skill 详情「编辑」→ 原版 SKILL.md。无译本时「翻译成简体中文」。有译本可切 English / 简体中文。中文只读，过时横幅 + 重新翻译。保存只写原版。译文路径 `skills/<id>/i18n/zh-CN.md`。演示入口还有「过时译本」。
- `NAVIGATE` 带 `resetInteractiveComponents`。

## 本地检查

```sh
node --check docs/prototype/plugin-console/figma-plugin/code.js
node --test docs/prototype/plugin-console/figma-plugin/test.js
```

模拟对象不具备 Figma 的真实字体测量、绘制或演示引擎。本地检查通过不代表 Figma Desktop 运行通过。
