# 本机 ECC 更新

安装来源：`~/Projects/ECC`。远程 `origin` 指向 `https://github.com/cruldra/ECC.git`，本地分支为 `local/chw`。

运行脚本需要仓库现有的依赖。当前已安装；重新克隆时执行 `npm ci --ignore-scripts`，按仓库的 `package-lock.json` 安装。

自定义命令和 Claude 技能直接保存在原文件中。Codex 独有的 grilling 技能保存在 `.codex/skills/grilling/SKILL.md`；三个代理配置保存在 `.codex/agents/`。

修改后先提交到本地 Git，再更新本机安装：

```sh
cd ~/Projects/ECC
git add <修改的文件>
git commit -m '🔧 chore(local): 更新本地定制'
node scripts/local-ecc-update.js
```

拉取上游并更新安装：

```sh
cd ~/Projects/ECC
node scripts/local-ecc-update.js --pull
```

脚本先合并 `origin/main`，再更新子仓库。有冲突时会停止，不会覆盖安装。解决冲突后执行 `git rebase --continue`，再执行 `node scripts/local-ecc-update.js`。

安装通过两边自带的插件管理命令完成。Codex 的独立安装使用 ECC 安装器，并优先采用 `.codex/skills/` 下的对应文件。原有的全局及项目启用开关会保留；已不存在的项目目录跳过，其登记不删除。

只查看更新范围：

```sh
node scripts/local-ecc-update.js --dry-run
```

完成后在 Claude Code 执行 `/reload-plugins`；Codex 新开会话。

首次迁移备份：`~/.local/state/ecc-upgrade/20261001-204932`。
