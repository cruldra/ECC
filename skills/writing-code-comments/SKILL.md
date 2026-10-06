---
name: writing-code-comments
description: 'Use when writing or editing code comments or docstrings in any language. Explain code the Feynman way: one plain sentence a newcomer understands. When rewriting, ignore the old comment and write from the code. Before finishing, check every comment written against every rule. Doc comments on front-end components embed a screenshot taken from an environment that is already running. Every comment follows Kotlin KDoc Markdown: backticks for code and parameter names, `[Name]` for code defined in or imported into the file, `[plain name](repo/path#Symbol)` links for code elsewhere in the repo, `@param` / `@return` / `@throws` block tags; never reST, Google-style `Args`, Javadoc HTML, or JSDoc `{Type}`. Also covers Chinese name marks (`Annotated[T, Comment("…")]`, `@Comment("…")`, trailing `# @Comment 名字` on enum members) that let the code-reading preview render code in Chinese.'
---

# Writing Code Comments

## Explaining Code: One Plain Sentence

Explain code the Feynman way: say what it does and why in one sentence, in plain words a newcomer to the codebase understands.

- One sentence. For a doc comment, that sentence is the summary line.
- Everyday words. A term the reader may not know gets replaced, or explained in the same sentence.
- Say the why, not the mechanics. The code already shows the mechanics.
- If one plain sentence will not come, the code is not understood yet, or it does too much. Read it again or split it before writing the comment.

```python
# Bad: jargon, no reason
# CAS-based conditional delete leveraging Lua atomicity to mitigate stale-holder races.

# Good: plain words, the reason included
# Delete the lock only if it is still ours, so a holder whose lock expired cannot delete someone else's.
```

## Rewriting a Comment: Start From the Code

When asked to rewrite or clean up a comment, do not edit the old one. Ignore it, read the code, and write what is true now from scratch. An old comment carries stale facts, restated code, and wrong summaries; editing it keeps them.

Then check what you wrote:

- **The summary is true.** No neat word the code does not live up to, such as "one-to-one" for code that never deletes.
- **Nothing restates the code.** A condition written out in words adds nothing. When a value has a hidden meaning (`owner_id is None` means a platform row), say it on that line, or better, name it in code (`row.is_platform`) and drop the comment.
- **Each note sits where it applies.** A condition's meaning goes next to the condition, not into the module summary.
- **Nothing describes other modules.** What another page or service does goes stale here when it changes.
- **Less is fine.** When nothing non-obvious is left, the comment goes.

Before, a module docstring rewritten by changing only its format:

```python
"""Keep the `agent` table one-to-one with `vendor/agents/<slug>/agent.yaml` at startup.

Add only, never delete: rows whose yaml was removed stay (the admin page marks them
"definition missing"), to avoid deleting user data. Rows with `owner_id` were created by
users, leave them; platform rows (`owner_id` is `None`) refresh description and tags from yaml.
"""
```

After, written from the code:

```python
"""At startup, sync the [agent definitions](vendor/agents) into the [agent table](backend/src/app/agent/models.py#Agent); it adds and updates but never deletes rows, because a row may carry user data."""

        elif row.owner_id is None and (...):  # platform rows only; rows users created stay as they are
```

## Comment Format: KDoc Markdown in Every Language

Write every comment the way Kotlin KDoc does, whatever the language. Python, TypeScript, Java, and the rest all follow it; do not use a language's own doc format.

- Backticks for parameter names, literals, and commands, e.g. `token`, `None`, `GET`.
- Square brackets for classes, functions, members, and exceptions defined in this file or imported into it, as in KDoc: `[UserRole.ADMIN]`, `[get_user]`, `[LocalRuntimeDisabled]`.
- Links for code anywhere else in the repo: other modules, files, directories, tables. See Links to Code in the Repo.
- Block tags: `@param name description` (the bare parameter name), `@return description`, `@throws [ExceptionClass] when it is thrown` (a full link when the exception is neither defined nor imported here). No types; the signature carries them.
- The first sentence of a doc comment is the summary. Leave one blank line, then the details; details may use lists, bold, and code blocks.
- Line comments (`#` / `//`) use the same backticks, square brackets, and links.

Never use: reST `:param x:` and double backticks, Google-style `Args` / `Returns` sections, Javadoc HTML tags and `{@link}` / `{@code}`, JSDoc `{Type}`.

One function, same structure in three languages:

```kotlin
/**
 * Releases the session lock held by `token`.
 *
 * Deletes only when the `GET` value equals `token`, so an old holder whose lock expired cannot delete the new lock.
 *
 * @return `true` if deleted; `false` if the lock now belongs to someone else
 */
fun release(sessionId: String, token: String): Boolean
```

```python
def release(session_id: str, token: str) -> bool:
    """Releases the session lock held by `token`.

    Deletes only when the `GET` value equals `token`, so an old holder whose lock expired cannot delete the new lock.

    @return `True` if deleted; `False` if the lock now belongs to someone else
    """
```

```ts
/**
 * Releases the session lock held by `token`.
 *
 * Deletes only when the `GET` value equals `token`, so an old holder whose lock expired cannot delete the new lock.
 *
 * @return `true` if deleted; `false` if the lock now belongs to someone else
 */
function release(sessionId: string, token: string): boolean
```

### Links to Code in the Repo

Code a comment names that is neither defined in nor imported into this file is a Markdown link: a directory, a file, a table, a class or function in another module. A backtick name only looks like code; a link takes the reader there.

- Format: `[plain name](path/from/repo/root#Symbol)`.
- The path is relative to the repository root, with no leading `./` or `/`.
- `#Symbol` names a class, function, or member in that file: `#Agent`, `#Agent.owner_id`, `#sync_agent_rows`. Leave it off for a directory or a whole file.
- Never a line number. Lines shift with every edit above them; a symbol name does not.
- The link text is the plain name a reader understands: `agent table`, not `agent`.
- Names defined in or imported into this file stay `[Name]`, as in KDoc. The code-reading preview resolves them the same way: this file first, then its imports.

```python
# Bad: names the reader has to go and find
# Syncs `vendor/agents` into `agent`.

# Good: each one opens the code it names
# Syncs the [agent definitions](vendor/agents) into the [agent table](backend/src/app/agent/models.py#Agent).
```

## Front-End Components: Show What It Looks Like

A front-end component's doc comment embeds a screenshot of the component as rendered, right after the summary sentence. The reader sees at a glance which part of the screen the code draws.

```tsx
/**
 * Overview card: one fact per row, value on the left, note below, secondary action on the right.
 *
 * ![overview card](frontend/src/components/overview/screenshots/OverviewSection.png)
 */
export function OverviewSection(props: OverviewSectionProps) {
```

- **Reuse an environment that is already running.** Local dev server first, then test, then production. Never start a server or a build just for the screenshot. If you do not know the URL, ask.
- **Crop to the component.** Not the whole page.
- **No real people's data.** Test and production pages show real names, phone numbers, emails, amounts, and avatars. If any is visible, use the dev environment with fake data, or ask. Never commit a screenshot with real user data.
- **Store it next to the component**: `<component dir>/screenshots/<ComponentName>.png`, committed with the code. The image path follows the link rule: from the repo root, `![plain name](path)`.
- **One screenshot of the usual state.** Add another only for a state that looks very different, such as empty or error.
- **Retake it when the look changes.** A stale screenshot misleads like a stale comment.
- **Skip components that draw nothing of their own**: providers, context wrappers, hooks.

Taking the screenshot with `opencli browser` (the user's Chrome, already logged in):

```bash
S=shot
opencli browser $S open "<page url>"
opencli browser $S wait selector "<component root selector>"
opencli browser $S eval "(() => { const el = document.querySelector('<component root selector>'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth }; })()"
opencli browser $S screenshot /tmp/page.png
# scale = PNG width / vw (sips -g pixelWidth /tmp/page.png); every number below is multiplied by scale
sips -c <h> <w> --cropOffset <y> <x> /tmp/page.png --out <component dir>/screenshots/<ComponentName>.png
opencli browser $S close
```

`sips --cropOffset` takes the top offset first, then the left offset. Look at the cropped image before committing it.

## Before You Finish: Check Every Comment You Wrote

Writing comments one by one drifts: the third one gets a link, the fourth one does not. Before saying the work is done, go over every comment written or changed in this task, not a sample, and check each rule:

1. **Every name of code is a reference.** Classes, functions, members, exceptions, files, directories, tables, including names after `@throws`: `[Name]` when defined in or imported into this file, otherwise `[plain name](path#Symbol)`. No bare names, no backtick names.
2. **Every reference resolves.** Each `[Name]` is defined in or imported into its file. Each link's file exists and its `#Symbol` is defined there (`grep -n "class Symbol\|def Symbol\|function Symbol" path`). No line numbers.
3. **Parameters, literals, and commands are in backticks.** The name after `@param` stays bare.
4. **The summary is one plain, true sentence.** Nothing restates the code.
5. **Front-end components carry their screenshot.**

List the bare `[Name]` references mechanically, then confirm each one is defined in or imported into its file; code such as `items[i]` also matches:

```bash
git diff -U0 | grep '^+' | grep -nE '\[[A-Za-z_][A-Za-z0-9_.]*\]([^(]|$)'
```

Fix every miss before reporting the work as finished.

## Chinese Name Marks: `@Comment`

The Superpowers extension's code-reading preview renders code in Chinese. Give a name a Chinese name, and the preview shows it wherever the name is used (hover shows the original). For example, `if current_user.role != UserRole.ADMIN` reads as 「如果 当前用户.role 不等于 用户角色.管理员」. A class name is rendered only when the class carries a mark.

A mark is not an explanation. It is a **name lookup table**: the name only, no description. Explanations still go in normal comments and docstrings.

### How to Write (on the Definition Only, Never at Use Sites)

**Rule: if code can carry the mark, do not use a comment.** A code mark fails loudly when wrong, follows renames, and disappears with the definition. A comment mark fails silently, and an unrecognized one stays in the code as clutter. Use a comment mark only where the language has no place for a code mark.

**Python**

```python
from app.core.naming import Comment                    # the project's no-op Comment (see below)

@Comment("查询用户")
async def get_user(
    user_id: Annotated[Int4Path, Comment("用户编号")],
    current_user: Annotated[User, Comment("当前用户")] = Depends(get_current_user),
) -> UserDetailResponse: ...

@Comment("用户角色")
class UserRole(str, enum.Enum):
    ADMIN = "admin"                                    # @Comment 管理员
    USER = "user"                                      # @Comment 普通用户

MAX_RETRY: Annotated[int, Comment("最大重试次数")] = 3
```

- Parameters, variables, class fields: `Annotated[Type, Comment("name")]`.
- Functions and classes: decorator `@Comment("name")`.
- **Enum members only** use a trailing `# @Comment name`, because `ADMIN = "admin"` has no place for a code mark.
- Keep one no-op `Comment` in the project, shared by the decorator and `Annotated`:

  ```python
  def Comment(name: str):                              # read only by the code-reading preview; returns the target unchanged
      def mark(target):
          return target
      return mark
  ```

**TypeScript / JavaScript**

- Classes, methods, method parameters, constructor parameters: decorator `@Comment("name")`.
- Plain function parameters, variables, and enum members have no code form; use a trailing `// @Comment name`.

**Fallback not to rely on**: with no mark, the preview takes the first clause (12 characters at most) of the docstring `Args:` / `:param x:` entry or the JSDoc `@param` entry as the Chinese name. It exists for old code. New names always get an explicit mark as above. Write parameter descriptions for their own sake; never reword them to produce a Chinese name.

### When to Add

- **Add**: domain nouns, names that recur across the file (`current_user`, `tenant_id`), enum members, abbreviations and jargon (`bps`, `slot`, `acks_late`), and any name that does not map to Chinese at a glance.
- **Skip**: obvious names (`i`, `name`, `url`), locals used once or twice, and names that mean the same as their type (`user: User`).
- Keep names **short**: a noun phrase of 2–6 Chinese characters, 12 at most, with no punctuation and no explanation.

### Relation to Comment Cleanup

- A Chinese name mark is not a comment that restates code. Do not delete it.
- When cleaning a docstring, still delete entries that only restate a parameter's name or type. If such an entry holds a useful Chinese name, **move it into a code mark** (Python parameters: `Annotated[…, Comment("…")]`) instead of dropping it.
