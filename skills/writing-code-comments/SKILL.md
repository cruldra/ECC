---
name: writing-code-comments
description: 'Use when writing or editing code comments or docstrings in any language. Every comment follows Kotlin KDoc Markdown: backticks for code, `[Name]` for symbol references, `@param` / `@return` / `@throws` block tags; never reST, Google-style `Args`, Javadoc HTML, or JSDoc `{Type}`. Also covers Chinese name marks (`Annotated[T, Comment("…")]`, `@Comment("…")`, trailing `# @Comment 名字` on enum members) that let the code-reading preview render code in Chinese.'
---

# Writing Code Comments

## Comment Format: KDoc Markdown in Every Language

Write every comment the way Kotlin KDoc does, whatever the language. Python, TypeScript, Java, and the rest all follow it; do not use a language's own doc format.

- Backticks for code, literals, and commands, e.g. `user_id`, `None`.
- Square brackets for references to classes, functions, parameters, and enum members, e.g. `[UserRole.ADMIN]`, `[get_user]`, `[token]`.
- Block tags: `@param name description`, `@return description`, `@throws ExceptionClass when it is thrown`. No types; the signature carries them.
- The first sentence of a doc comment is the summary. Leave one blank line, then the details; details may use lists, bold, and code blocks.
- Line comments (`#` / `//`) use the same backticks and square brackets.

Never use: reST `:param x:` and double backticks, Google-style `Args` / `Returns` sections, Javadoc HTML tags and `{@link}` / `{@code}`, JSDoc `{Type}`.

One function, same structure in three languages:

```kotlin
/**
 * Releases the session lock held by [token].
 *
 * Deletes only when the `GET` value equals [token], so an old holder whose lock expired cannot delete the new lock.
 *
 * @return `true` if deleted; `false` if the lock now belongs to someone else
 */
fun release(sessionId: String, token: String): Boolean
```

```python
def release(session_id: str, token: str) -> bool:
    """Releases the session lock held by [token].

    Deletes only when the `GET` value equals [token], so an old holder whose lock expired cannot delete the new lock.

    @return `True` if deleted; `False` if the lock now belongs to someone else
    """
```

```ts
/**
 * Releases the session lock held by [token].
 *
 * Deletes only when the `GET` value equals [token], so an old holder whose lock expired cannot delete the new lock.
 *
 * @return `true` if deleted; `false` if the lock now belongs to someone else
 */
function release(sessionId: string, token: string): boolean
```

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
