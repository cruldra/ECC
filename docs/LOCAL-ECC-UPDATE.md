# 本机 ECC 更新

安装来源：`~/Sources/ECC`。远程 `origin` 指向 `https://github.com/cruldra/ECC.git`，本地分支为 `local/chw`。

运行脚本需要仓库现有的依赖。当前已安装；重新克隆时执行 `npm ci --ignore-scripts`，按仓库的 `package-lock.json` 安装。

自定义命令和 Claude 技能直接保存在原文件中。三个代理配置保存在 `.codex/agents/`。三端的 ECC 技能统一以 `skills/` 为源：Claude Code 和 Codex 通过各自的 ECC 插件加载，Pi 通过本地 ECC 包加载。Codex 不再额外复制技能，也不再用 `.codex/skills/` 覆盖通用技能。

修改后先提交到本地 Git，再更新本机安装：

```sh
cd ~/Sources/ECC
git add <修改的文件>
git commit -m '🔧 chore(local): 更新本地定制'
node scripts/local-ecc-update.js
```

拉取上游并更新安装（必须先把 `origin/main` **merge 进 `local/chw`**，再安装；不要切到 `main` 装，不要把 marketplace 改成 GitHub 或临时目录）：

```sh
cd ~/Sources/ECC
git checkout local/chw
git fetch origin main
git merge origin/main
node scripts/local-ecc-update.js
```

有冲突时先在 `local/chw` 上解决并做完 merge，再执行 `node scripts/local-ecc-update.js`。脚本不会覆盖未提交的工作区；更新前先提交本机定制。

不要用 `node scripts/local-ecc-update.js --pull` 代替上面的 merge。`--pull` 当前是 `git rebase origin/main`，和本机「merge 进 local/chw 再安装」的约定不一致。

安装通过两边自带的插件管理命令完成。Codex 安装器只同步技能以外的托管文件。原有的全局及项目启用开关会保留；已不存在的项目目录跳过，其登记不删除。

## 技能只保留一个入口

- ECC 技能：只编辑本仓库的 `skills/`，仍用 `node scripts/local-ecc-update.js` 一次更新三端。
- 个人技能、模型和公共指令：继续在 Magpie 管理。
- Magpie Library 保留 ECC 技能，但不再将它们投放给 Claude Code、Codex 和 Pi。其他代理的投放选择保留。
- Pi 从 `../../Sources/ECC` 直接读取 ECC 技能，不能再给这个包设置 `skills: []`。
- 后续完整更新自动执行去重，避免重新安装普通入口和 `ecc:` 入口两份技能。

仅检查去重范围：

```sh
node scripts/local-ecc-update.js --dedupe-skills --dry-run
```

仅执行去重，不拉取上游、不重装插件，也不要求清空当前工作区：

```sh
node scripts/local-ecc-update.js --dedupe-skills
```

该操作要求 Claude Code 的用户级 ECC 插件和 Codex 的 ECC 插件已启用。它通过 Magpie 自带命令调整投放，恢复 Pi 的本地包技能，并把旧安装器登记的 Codex 技能移到 `~/.local/state/ecc-upgrade/skill-sources-*/`。文件内容与安装记录不同、夹带个人文件或链接时，清理会停止。备份中保留原技能、安装记录、Magpie 投放设置和 Pi 设置。重复运行没有变化。

修改 Magpie 个人技能后，使用 `magpie library sync` 重新分发；不要手工把 ECC 技能再复制进各端技能目录。

只查看更新范围：

```sh
node scripts/local-ecc-update.js --dry-run
```

完成后在 Claude Code 执行 `/reload-plugins`；Codex 新开会话。

首次迁移备份：`~/.local/state/ecc-upgrade/20261001-204932`。
