---
name: bugsink
locale: zh-CN
description: 通过随附的 bugsink-cli 分析自托管 Bugsink 实例的错误。当用户粘贴 Bugsink URL(例如 bugsink.ailoveworld.cn/issues/...)、说 /bugsink,或询问 查 bugsink / 看看这个报错 / 哪些是真 bug 时使用。绝不为 Bugsink 打开浏览器 —— CLI 能回答一切。
source_hash: 47328887f692eb7d885b07457c449601ba10b32195ce006084f97c2ec7fc460e
translated_at: 2026-09-17T01:17:09Z
model: glm-5.3-flash
---

# Bugsink

把 Bugsink 链接变成一份根因解读：哪些 issue 是真实的、在哪里出错、该改什么。

CLI 以 git 子模块的形式随本技能一起提供，位于 `bugsink-cli/`(Go)。它与 Bugsink REST API 通信并输出 JSON,唯独 `events stacktrace` 输出 Markdown。

## 安装

`bugsink-cli` 必须在 `PATH` 上。如果没有：

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/bugsink/bugsink-cli" && go build -o ~/.local/bin/bugsink-cli .
```

凭据来自环境变量，绝不要来自你输入到对话记录中的参数：

- `BUGSINK_URL` —— 实例的基础 URL
- `BUGSINK_TOKEN` —— bearer 令牌

如果 CLI 返回 `请通过 --token 或 BUGSINK_TOKEN 环境变量提供认证令牌`,说明启动 Claude 的 shell 中缺少令牌。告知用户即可；不要让他们粘贴，也绝不要回显其值。

## URL → id

有两种链接形态。先去掉查询字符串，再匹配路径：

| 路径 | 含义 | 首个命令 |
|---|---|---|
| `/issues/<N>/` | 项目 `N` | `bugsink-cli issues list --project N --sort last_seen --order desc` |
| `/issues/issue/<UUID>/...` | 单个 issue | `bugsink-cli events list --issue UUID --order desc` |

`/api/canonical/...` 链接是原始 API URL;从中提取同样的 id。`/accounts/login/?next=...` 链接是重定向外壳 —— 解码 `next` 并使用它。

## 操作流程

### 项目链接

1. 执行 `issues list --project N --sort last_seen --order desc`。输出包含 `results[]`;仅当用户要求查看首页之外的内容时，才用 `next` 中的 `--cursor` 翻页。
2. 除非用户询问历史，否则丢弃 `is_resolved` 为 `True` 或 `is_muted` 为 `True` 的行。
3. 将剩余条目按 `calculated_type` + `calculated_value` 分组。先按 `digested_event_count` 排名，再按 `last_seen`。
4. 对于排名靠前的 issue(默认 3–5 个，除非另有说明)，各获取一份堆栈跟踪 —— 见下文。
5. 汇报。

### Issue 链接

1. 执行 `events list --issue UUID --order desc`。取第一行的 `id`(内部 id,**不是** `event_id` —— `event_id` 是客户端侧 id,对它调用 `stacktrace` 会 404)。
2. 执行 `events stacktrace <id>`。
3. 汇报。

### 解读堆栈跟踪

`events stacktrace` 在第 1 行打印异常类型，接着是消息，然后是各帧。带 `[in-app]` 标记的帧是项目自身的代码；没有该标记的帧是依赖。

- 根因是做出错误调用的最深的 `[in-app]` 帧，而不是最外层。
- 以 `function` 中 `path:line` 的形式引用它。
- 提及上下文窗口、已取消任务、上游 4xx 或 ASGI 提前返回的消息，往往是调用方决策导致的症状 —— 应如此说明，而不是把它们当作 bug 本身。

## 汇报

每个 issue 一块，事件数多的在前：

```
<calculated_type> — <count> events, first <first_seen>, last <last_seen>
Issue: <UUID>
Where: <file>:<line> in <function>
Why:   <one or two sentences on the mechanism>
Fix:   <the concrete change, or "not a bug: <reason>">
```

最后用一行总结：哪些 issue 是真实的，哪些是噪音，哪些需要更多数据。

用用户的语言撰写汇报。

## 禁止事项

- 除非用户明确要求，否则不要运行 `issues resolve`、`issues delete` 或 `issues clear`。`clear` 不可逆且作用于整个项目。
- 不要打开 Bugsink 的 Web UI。以上一切都可以通过 CLI 获得答案。
- 默认不要翻遍整个项目；按 `last_seen` 排序的首页就是有效信号。