# 业务信息收集表

客户点一条链接，在手机上三步填完公司情况；内部一个列表页看提交。
配套 Figma 原型在 `docs/prototype/intake-form/`。

## 跑起来

```bash
uv sync
cp .env.example .env
uv run python main.py
```

- 客户填的表：<http://localhost:8000/>
- 内部看提交：<http://localhost:8000/admin>

## 收什么

| 步骤 | 内容 |
|---|---|
| 第 1 步 · 企业信息 | 公司名称（必填）、所在城市、主营业务、行业、企业规模 |
| 第 2 步 · 关键岗位与流程 | 预置两张卡（岗位名称 + 日常工作流程），可增删 |
| 第 3 步 · 期望 AI 赋能的场景 | 预置两张卡（场景名称 + 现状 + 预期），可增删 |

只有公司名称必填。**其余留空是有效信息** —— 空着的地方当面问，别逼客户编。
整张卡都没填的，提交时自动丢掉，不进库。

题目全是通用的：这一步发生在还不知道客户是哪一行的时候，所以每一道都问他张口就能答的事实。
输入框里不写引导语，客户读起来像在被套信息。

## 接口

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/submissions` | 提交，返回 `{"id": n}` |
| GET | `/api/submissions` | 全部提交，按时间倒序 |
| GET | `/api/submissions/{id}` | 单份 |
| GET | `/health` | 健康检查 |

## 数据

SQLite，落在 `storage/intake.db`。岗位和场景条数不定，按 JSON 列存；
公司、行业、时间单独成列，方便筛。一年几十份提交，SQLite 够用，不要上 PostgreSQL。

## 前端

一个 Lit 组件 `static/js/components/intake-form.js`，渲染进 light DOM 而不是 shadow DOM
—— Tailwind 的样式表进不了 shadow root。草稿存 localStorage，对应首页那句
「填写内容自动保存，可中断后继续」。

## 部署

```bash
S=~/.agents/skills/deploying-to-dify-host/dify-deploy.sh
$S deploy client-intake intake 8000 .
```

一条命令跑完 DNS → frpc → Caddy 证书 → 公网 HTTPS。给客户的只有一条链接。

## 后台鉴权

`/admin` 和 `GET /api/submissions*` 走 HTTP Basic，账号密码从环境变量来：

写在 `.env` 里的 `ADMIN_USER` 和 `ADMIN_PASSWORD` 两项。

**密码不进仓库** —— 这个仓库是公开的。`.env` 在 `.gitignore` 里，`.env.example` 只有空位。
**没设 `ADMIN_PASSWORD` 就把后台整个关掉（503）**，不会默认敞开。

`POST /api/submissions` 不需要凭据，客户要能提交。
