---
name: agent-architecture-audit
description: 面向 Agent 与 LLM 应用的全栈诊断。审计 12 层 agent 栈，检查封装层回归、记忆污染、工具纪律失效、隐藏修复循环与渲染损坏。产出按严重程度排序的发现，并附代码优先的修复方案。对构建 Agent 应用、自主循环或任何 LLM 驱动功能的开发者必不可少。当 Agent 或 LLM 功能行为异常且故障层级未知时，或在发布 agent 栈之前使用。
locale: zh-CN
metadata:
  origin: oh-my-agent-check
tools: Read, Write, Edit, Bash, Grep, Glob
source_hash: 64f57e232c3533877403703bc95b3c75df9de23f657899a306f13c703009ff57
translated_at: 2026-09-09T04:55:29Z
model: z-ai/glm-5.3-flash
---

# Agent 架构审计

一种针对 Agent 系统的诊断工作流，这类系统的故障往往被封装层、陈旧记忆、重试循环或传输/渲染环节的篡改所掩盖。

## 何时激活

**以下情况必须使用：**
- 将任何 Agent 或 LLM 驱动的应用发布到生产环境
- 发布包含工具调用、记忆或多步骤工作流的功能
- 添加封装层后 Agent 行为退化
- 用户反馈“Agent 越用越差”或“工具时好时坏”
- 同一模型在 playground 中正常，但在你的封装层内失效
- 调试 Agent 行为超过 15 分钟仍未找到根因

**以下情况尤为关键：**
- 你新增了 prompt 层、工具定义或记忆系统
- 系统中不同 Agent 的行为不一致
- 模型昨天还好好的，今天就开始出现幻觉
- 你怀疑存在隐藏的修复/重试循环在悄悄篡改响应

**不要用于：**
- 一般性代码调试 — 请使用 `agent-introspection-debugging`
- 代码审查 — 请使用特定语言的 reviewer agent
- 安全扫描 — 请使用 `security-review` 或 `security-review/scan`
- Agent 性能基准测试 — 请使用 `agent-eval`
- 编写新功能 — 请使用相应的工作流技能

## 12 层栈

每个 Agent 系统都有这些层。任何一层都可能损坏答案：

| # | 层 | 可能出的问题 |
|---|-------|----------------|
| 1 | 系统 prompt | 指令冲突、指令膨胀 |
| 2 | 会话历史 | 前几轮对话注入的陈旧上下文 |
| 3 | 长期记忆 | 跨会话污染、旧话题混入新对话 |
| 4 | 蒸馏 | 压缩产物以伪事实形式重新进入 |
| 5 | 主动召回 | 冗余的重复摘要层浪费上下文 |
| 6 | 工具选择 | 工具路由错误、模型跳过必需工具 |
| 7 | 工具执行 | 幻觉式执行 — 声称调用了但实际没有 |
| 8 | 工具解读 | 误读或忽略工具输出 |
| 9 | 答案塑形 | 最终响应中的格式损坏 |
| 10 | 平台渲染 | 传输层篡改（UI、API、CLI 篡改有效答案） |
| 11 | 隐藏修复循环 | 静默的兜底/重试 agent 运行第二轮 LLM 处理 |
| 12 | 持久化 | 过期状态或缓存产物被当作实时证据复用 |

## 常见故障模式

### 1. 封装层回归

基础模型本身产出正确答案，但封装层使其变差。

**症状：**
- 模型在 playground 或直接 API 调用中正常，在你的 Agent 中失效
- 新增一层 prompt 后，既有行为退化
- Agent 语气自信，却自信地答错
- “上次更新之前还好好的”

### 2. 记忆污染

旧话题通过历史记录、记忆检索或蒸馏泄漏到新对话中。

**症状：**
- Agent 提出无关的过往话题
- 用户的纠正不生效（旧记忆覆盖新纠正）
- 同一会话的产物以伪事实形式重新进入
- 记忆无界增长，随时间推移降低响应质量

### 3. 工具纪律失效

工具在 prompt 中声明，但未在代码中强制执行。模型跳过工具或幻觉式执行。

**症状：**
- prompt 中写着“必须使用工具 X”，但模型不调用就作答
- 工具结果看起来正确，但实际从未执行
- 不同工具争夺同一职责
- 模型在不该用工具时用了工具，或在必须用时跳过

### 4. 渲染/传输损坏

Agent 的内部答案正确，但平台层在投递过程中篡改了它。

**症状：**
- 日志显示答案正确，用户看到的却是损坏的输出
- Markdown 渲染、JSON 解析或流式传输分片损坏有效响应
- 隐藏的兜底 agent 在投递前悄悄替换了答案
- 终端和 UI 中的输出不一致

### 5. 隐藏 Agent 层

静默的修复、重试、摘要或召回 agent 在没有明确契约的情况下运行。

**症状：**
- 内部生成的输出与投递给用户的输出不一致
- “自动修复”循环运行了用户不知道的第二轮 LLM 处理
- 多个 agent 在缺乏协调的情况下修改同一输出
- 答案被不可见的层“磨平”或“纠正”

## 审计工作流

### 阶段 1：界定范围

明确你要审计的内容：

- **目标系统** — 什么 Agent 应用？
- **入口点** — 用户如何与之交互？
- **模型栈** — 使用哪些 LLM 和提供商？
- **症状** — 用户报告了什么？
- **时间窗口** — 什么时候开始的？
- **待审计层级** — 12 层中哪些适用？

### 阶段 2：证据收集

从代码库中收集证据：

- **源代码** — agent 循环、工具路由、记忆准入、prompt 组装
- **日志** — 历史会话轨迹、工具调用记录
- **配置** — prompt 模板、工具 schema、提供商设置
- **记忆文件** — SOP、知识库、会话归档

使用 `rg` 搜索反模式：

```bash
# 工具要求仅以 prompt 文本表达（未在代码中体现）
rg "must.*tool|必须.*工具|required.*call" --type md

# 工具执行未经校验
rg "tool_call|toolCall|tool_use" --type py --type ts

# 主 agent 循环之外的隐藏 LLM 调用
rg "completion|chat\.create|messages\.create|llm\.invoke"

# 记忆准入缺少用户纠正优先机制
rg "memory.*admit|long.*term.*update|persist.*memory" --type py --type ts

# 会运行额外 LLM 调用的兜底循环
rg "fallback|retry.*llm|repair.*prompt|re-?prompt" --type py --type ts

# 静默的输出篡改
rg "mutate|rewrite.*response|transform.*output|shap" --type py --type ts
```

### 阶段 3：故障定位

对每项发现，记录：

- **症状** — 用户看到什么
- **机制** — 封装层如何导致它
- **来源层级** — 属于 12 层中的哪一层
- **根因** — 最深层的原因
- **证据** — file:line 或 log:row 引用
- **置信度** — 0.0 到 1.0

### 阶段 4：修复策略

默认修复顺序（代码优先，而非 prompt 优先）：

1. **用代码门禁工具要求** — 在代码中强制执行，而不只是写在 prompt 文本里
2. **移除或收窄隐藏修复 agent** — 让兜底行为显式化并带有契约
3. **减少上下文重复** — 避免同一信息经由 prompt + 历史 + 记忆 + 蒸馏多路进入
4. **收紧记忆准入** — 用户纠正 > agent 断言
5. **收紧蒸馏触发条件** — 不该压缩的不要压缩
6. **减少渲染篡改** — 直通传递，不要转换
7. **改为类型化 JSON 信封** — 结构化的内部流转，而非自由格式散文

## 严重程度模型

| 等级 | 含义 | 处置 |
|-------|---------|--------|
| `critical` | Agent 可能自信地产出错误的操作行为 | 下次发布前修复 |
| `high` | Agent 频繁损害正确性或稳定性 | 本迭代内修复 |
| `medium` | 正确性通常可保，但输出脆弱或浪费 | 规划到下个周期 |
| `low` | 多为外观或可维护性问题 | 列入待办 |

## 输出格式

按以下顺序向用户呈现发现：

1. **按严重程度排序的发现**（最严重的在前）
2. **架构诊断**（哪一层损坏了什么，以及为什么）
3. **有序修复计划**（代码优先，而非 prompt 优先）

不要以夸赞或总结开头。如果系统有问题，直说。

## 快速诊断问题

审计 Agent 系统时，回答以下问题：

| # | 问题 | 若是 → |
|---|----------|----------|
| 1 | 模型能否跳过必需工具仍然作答？ | 工具未设代码门禁 |
| 2 | 新一轮对话中是否出现旧对话内容？ | 记忆污染 |
| 3 | 同一信息是否同时出现在系统 prompt、记忆和历史中？ | 上下文重复 |
| 4 | 平台是否在投递前运行第二轮 LLM 处理？ | 隐藏修复循环 |
| 5 | 内部生成与用户收到的输出是否不一致？ | 渲染损坏 |
| 6 | “必须使用工具 X”的规则是否只存在于 prompt 文本中？ | 工具纪律失效 |
| 7 | agent 自身的独白是否会变成持久记忆？ | 记忆投毒 |

## 需避免的反模式

- 在排除封装层回归之前，不要归咎于模型。
- 在展示污染路径之前，不要归咎于记忆。
- 不要因为当前状态干净，就抹掉历史上的脏事故。
- 不要把 markdown 散文当作可信的内部协议。
- 当代码从未强制执行时，不要接受 prompt 文本中的“必须使用工具”。
- 保持发现直接、有据可依、按严重程度排序。

## 报告 Schema

审计应产出遵循以下结构的结构化报告：

```json
{
  "schema_version": "ecc.agent-architecture-audit.report.v1",
  "executive_verdict": {
    "overall_health": "high_risk",
    "primary_failure_mode": "string",
    "most_urgent_fix": "string"
  },
  "scope": {
    "target_name": "string",
    "model_stack": ["string"],
    "layers_to_audit": ["string"]
  },
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "title": "string",
      "mechanism": "string",
      "source_layer": "string",
      "root_cause": "string",
      "evidence_refs": ["file:line"],
      "confidence": 0.0,
      "recommended_fix": "string"
    }
  ],
  "ordered_fix_plan": [
    { "order": 1, "goal": "string", "why_now": "string", "expected_effect": "string" }
  ]
}
```

## 相关技能

- `agent-introspection-debugging` — 调试 Agent 运行时故障（循环、超时、状态错误）
- `agent-eval` — 对 Agent 性能进行对比式基准测试
- `security-review` — 面向代码与配置的安全审计
- `autonomous-agent-harness` — 搭建自主 Agent 运行体系
- `agent-harness-construction` — 从零构建 agent harness