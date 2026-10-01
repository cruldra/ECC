---
name: writing-code-comments
description: '在以任何语言编写或修改代码注释或 docstring 时使用。每条注释都遵循 Kotlin KDoc Markdown：用反引号标注代码，用 `[Name]` 引用符号，使用 `@param` / `@return` / `@throws` 块标签；绝不使用 reST、Google 风格的 `Args`、Javadoc HTML 或 JSDoc 的 `{Type}`。同时涵盖中文名标记（`Annotated[T, Comment("…")]`、`@Comment("…")`、枚举成员行尾的 `# @Comment 名字`），使代码阅读预览能够用中文渲染代码。'
locale: zh-CN
source_hash: e41cfb8c69b6ce8597e27dcb35f871a183a8f30338cc0fe1434863629a646fbc
translated_at: 2026-09-30T08:25:03Z
model: glm-5.3-flash
---

# 编写代码注释

## 注释格式：任何语言都用 KDoc Markdown

无论使用哪种语言，所有注释都按 Kotlin KDoc 的方式书写。Python、TypeScript、Java 及其余所有语言一律遵循此格式；不要使用语言自带的文档格式。

- 用反引号标注代码、字面量和命令，例如 `user_id`、`None`。
- 用方括号引用类、函数、参数和枚举成员，例如 `[UserRole.ADMIN]`、`[get_user]`、`[token]`。
- 块标签：`@param name description`、`@return description`、`@throws ExceptionClass when it is thrown`。不写类型；类型由签名承载。
- 文档注释的第一句是摘要。空一行后写细节；细节可使用列表、加粗和代码块。
- 行注释（`#` / `//`）同样使用反引号和方括号。

绝不使用：reST 的 `:param x:` 与双反引号、Google 风格的 `Args` / `Returns` 分节、Javadoc 的 HTML 标签及 `{@link}` / `{@code}`、JSDoc 的 `{Type}`。

同一个函数，在三种语言中结构一致：

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

## 中文名标记：`@Comment`

Superpowers 扩展的代码阅读预览会用中文渲染代码。给某个名字加上中文名后，凡是用到该名字的地方，预览都会显示中文名（悬停显示原名）。例如，`if current_user.role != UserRole.ADMIN` 会显示为「如果 当前用户.role 不等于 用户角色.管理员」。类名只有在类本身带有标记时才会被渲染。

标记不是解释。它是一张**名称对照表**：只有名字，没有描述。解释仍然写在普通注释和 docstring 中。

### 如何书写（只写在定义处，绝不写在调用处）

**规则：只要代码能承载标记，就不要用注释。**代码标记写错时会立即报错，会跟随重命名，并随定义一起消失。注释标记则静默失效，而且无法识别的注释标记会作为杂物留在代码里。只有当语言没有地方放置代码标记时，才使用注释标记。

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

- 参数、变量、类字段：`Annotated[Type, Comment("name")]`。
- 函数和类：装饰器 `@Comment("name")`。
- **仅枚举成员**使用行尾 `# @Comment 名字`，因为 `ADMIN = "admin"` 没有地方放置代码标记。
- 在项目中保留一个空操作 `Comment`，供装饰器和 `Annotated` 共用：

  ```python
  def Comment(name: str):                              # read only by the code-reading preview; returns the target unchanged
      def mark(target):
          return target
      return mark
  ```

**TypeScript / JavaScript**

- 类、方法、方法参数、构造函数参数：装饰器 `@Comment("name")`。
- 普通函数参数、变量和枚举成员没有代码形式；使用行尾 `// @Comment name`。

**不要依赖的兜底方式**：没有标记时，预览会取 docstring 中 `Args:` / `:param x:` 条目或 JSDoc `@param` 条目的第一个分句（至多 12 个字符）作为中文名。它只为旧代码而存在。新名字一律按上文显式添加标记。参数描述按其自身用途书写；绝不要为了凑出中文名而改写措辞。

### 何时添加

- **添加**：领域名词、在文件中反复出现的名字（`current_user`、`tenant_id`）、枚举成员、缩写与行话（`bps`、`slot`、`acks_late`），以及任何一眼看不出对应中文的名字。
- **跳过**：显而易见的名字（`i`、`name`、`url`）、只用一两次的局部变量，以及含义与其类型相同的名字（`user: User`）。
- 名字保持**简短**：2–6 个汉字的名词短语，至多 12 个，不带标点，不加解释。

### 与注释清理的关系

- 中文名标记不是复述代码的注释。不要删除它。
- 清理 docstring 时，仍要删除只复述参数名或参数类型的条目。如果这类条目中包含有用的中文名，应**将其移入代码标记**（Python 参数：`Annotated[…, Comment("…")]`），而不是直接丢弃。