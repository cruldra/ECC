---
name: writing-requirements-spec
description: 'Use when turning a client meeting, recording, chat log or notes into a software requirements specification the client confirms: 需求说明书, 需求规格说明书, 软件需求文档, SRS, 梳理需求给甲方确认, 根据会议录音整理需求, 出第一版需求. Follows the ISO/IEC/IEEE 29148:2018 clause 9.6 outline, plus a model-and-data chapter for AI projects. Writes an internal version where every requirement carries a status (已确认 / 推断 / 待提供) and the meeting minute it came from, then a client version with those marks, standard names and spoken prices removed. Appendices give each open question a recommended answer, the agreed division of work, and the materials the client owes. Bundled scripts condense an SRT to one line per minute, strip the marks, and export Word with bordered full-width tables through pandoc. Not for design specs or implementation plans (spec, writing-plans), and not for quotes or contracts (closing-custom-dev-deals).'
---

# Writing Requirements Spec

Turn what a client said into a requirements specification (需求规格说明书) the client can confirm line by line, and hand them a clean Word file.

## When to Use

- A client meeting, recording, transcript, chat export or notes, and the user wants the first or next version of the requirements document for the client (甲方).
- Updating a specification after the client answers its open questions.
- Not for design specs (`spec`), implementation plans (`writing-plans`) or ideas still being shaped (`grilling`). Quotes, technical proposals and contracts belong to `closing-custom-dev-deals`, whose gate 1 asks for this document.

## How It Works

Bundled files:

| File | Use |
|---|---|
| `references/srs-outline.md` | Chapter outline, requirement row format, appendix columns |
| `scripts/condense_srt.py` | SRT to one line per minute |
| `scripts/strip_annotations.py` | Internal version to client version; `--check` for leftovers |
| `scripts/md2docx.py` | Markdown to Word with bordered tables |

### 1. Get the Words

- Audio or video only: transcribe it with `transcribing-audio` first.
- An SRT file: condense it so the whole meeting fits in one read. Each output line starts with `[mm]`, the minute, which later becomes the source of a requirement.

  ```bash
  uv run --script ${CLAUDE_SKILL_DIR}/scripts/condense_srt.py meeting.srt -o /tmp/<project>/minutes.txt
  ```

- Read the whole transcript, not a sample. Speech recognition swaps homophones; fix them from context (自由化部署 → 私有化部署, PTF → PDF) and keep a list of words you could not resolve for the report.
- Fill the document header from fixed sources; never leave 【待填写】 in these three fields:
  - 乙方: the company's full name from the `closing-custom-dev-deals` vault. Decrypt only this file; the pricing in the vault has no place here.

    ```bash
    bash ${CLAUDE_PLUGIN_ROOT}/skills/closing-custom-dev-deals/scripts/vault.sh show company-profile.md
    ```

    If it reports that no passphrase is cached, ask the user to run `vault.sh unlock` once. Do not guess the name from the project folder.
  - 甲方: the `客户：` line of the project's `README.md`, written the way the user refers to the client. If the README or that line is missing, ask the user once, then add the line (creating the README if needed) so the next version finds it.
  - 文档编号: `HK-<项目代号>-SRS-<序号>`. 项目代号 is the project directory name in capitals with hyphens removed (`ai-civics` → `AICIVICS`); 序号 counts this project's requirement specs from `001`. If the project already has one (`docs/*_需求规格说明书_*.md`), keep its number; a new version does not change it.

### 2. Sort What Was Said

Before writing, sort every point into: goal and pain points; scope (phase 1, later, never); users; functions; data and materials; constraints (law, deployment, ownership); division of work and next actions; money and dates. For each point decide whether the client said it (已确认), you infer it (推断), or only the client can supply it (待提供).

### 3. Write the Internal Version

Write `docs/<项目>_需求规格说明书_V0.1.md` chapter by chapter from `references/srs-outline.md`. Drop a section only when it does not apply; drop 3.6 when the project neither trains nor calls a model.

- Each requirement is one table row: 编号, 需求, 优先级, 状态, 来源. The outline gives the ID prefixes and the meaning of each value.
- One sentence per requirement, starting with 系统应, that a tester can check.
- Never present an inference as something the client said: mark it 推断. A definition you supplied gets （释义为乙方推断）.
- A number the client did not give (response time, accuracy, concurrency) is a 乙方建议值: say so above the table and ask it again in appendix A.
- Use the client's own terms and short sentences.

The appendices are what the client acts on:

- **A 待确认问题**: every gap, each with a recommended answer (乙方建议) and the requirement IDs it blocks. Recommend an answer; do not ask an open question.
- **B 沟通共识**: division of work, direction, next actions with owner and date.
- **C 甲方需提供的资料**: each item, what it is for, when it is due.

When the work is a sales deal, also cover the eight questions of gate 1 in `closing-custom-dev-deals`, except the budget.

### 4. Keep Out of the Client Version

| Content | What to write instead |
|---|---|
| Prices, budget ranges, quotes said aloud | 费用和周期另见报价方案. Any number here reads as a written quote |
| Schedules | Only the meeting's wording, inside an appendix A question, never as a commitment |
| Ownership and confidentiality | The direction agreed, followed by 以合同为准 |
| Standard names, clause numbers, 模板 wording | Nothing: the client wants content, not provenance |
| Statuses, meeting minutes, recording file names | Nothing: they stay in the internal version |

### 5. Make the Client Version

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/strip_annotations.py docs/<项目>_需求规格说明书_V0.1.md docs/<项目>_需求规格说明书_V1.0.md
```

The script drops the 状态 and 来源 columns and every `[mm]` marker, refuses to overwrite, and prints the lines that still hold internal words (推断, 会上, 录音, ISO, 模板…). Rewrite those by hand:

1. Version V1.0; revision record 根据 <日期> 双方需求沟通编写第一版; no 结构依据 row.
2. Replace 阅读说明 with a three-point 说明: please review and annotate; appendices A and C drive the proposal and quote; fees and schedule are in the quotation.
3. Remove the standards from the references and turn 会上 into 沟通时 or drop it.
4. Run `uv run --script ${CLAUDE_SKILL_DIR}/scripts/strip_annotations.py --check <V1.0 file>` until it exits 0.

Keep the internal version; it answers "when did I say that" later.

### 6. Export Word

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/md2docx.py docs/<项目>_需求规格说明书_V1.0.md
```

Requires pandoc (`brew install pandoc`). Every table becomes full width with borders and a tinted header row, and column widths follow the content. There is no table of contents: pandoc's TOC field makes Word ask to update fields when the file opens, so tell the user to insert one from 引用 → 目录 if they want it. Delete older client `.docx` files so the wrong one is not sent.

On macOS, render page 1 with `qlmanage -t -s 1400 -o <dir> <file>.docx` and look at the PNG: title, header table, borders. That checks page 1 only; say so.

### 7. Report

Lead with the Word path. Then the decisions the user must make (what was left out and why, such as the budget), the inferences to review, the transcript words you could not resolve, and what you did not verify.

## Examples

A 41-minute meeting SRT condenses to 42 lines. The internal V0.1 has 60 requirements, 12 open questions each with a recommendation, and no budget. `strip_annotations.py` produces V1.0 and flags 24 lines; after rewriting them, `--check` exits 0 and `md2docx.py` writes a Word file with 27 bordered tables.
