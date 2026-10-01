---
name: writing-code-comments
locale: zh-CN
description: '在编写或修改任何语言的代码注释、文档字符串时使用。用费曼方式解释代码：一句新人都看得懂的大白话。所有注释遵循 Kotlin KDoc Markdown：代码用反引号，符号引用用 `[Name]`，块标签用 `@param` / `@return` / `@throws`；绝不使用 reST、Google 风格的 `Args`、Javadoc HTML 或 JSDoc `{Type}`。同时涵盖中文名字标记（`Annotated[T, Comment("…")]`、`@Comment("…")`、枚举成员尾随的 `# @Comment 名字`），让代码阅读预览以中文渲染代码。'
source_hash: dffa0b837b95310e898bf72e618ef465070aecb1a71c92aeec19625effeb6bc5
translated_at: 2026-10-01T16:08:58Z
model: glm-5.3-flash
---

# 编写代码注释

## 解释代码：一句大白话

用费曼方式解释代码：用一句话说出它做什么、为什么这么做，说的是代码库新人都听得懂的大白话。

- 一句话。对文档注释而言，这句话就是摘要行。
- 日常用词。读者可能不认识的术语要么替换掉，要么就在同一句话里解释清楚。
- 说为什么，不说机制。代码本身已经展示了机制。
- 如果一句大白话说不出来，说明代码还没被真正理解，或者它做的事太多了。先重读代码或先拆分，再写注释。

```python
# 坏：行话，没说原因
# 基于 CAS 的条件删除，利用 Lua 原子性缓解旧持有者竞态。

# 好：大白话，说了原因
# 只有锁仍是自己的才删，这样锁已过期的持有者删不掉别人的锁。
```

## 注释格式：所有语言都用 KDoc Markdown

无论什么语言，每条注释都按 Kotlin KDoc 的方式写。Python、TypeScript、Java 以及其他语言一律遵循；不要用各语言自己的文档格式。

- 代码、字面量、命令用反引号，如 `user_id`、`None`。
- 引用类、函数、参数、枚举成员用方括号，如 `[UserRole.ADMIN]`、`[get_user]`、`[token]`。
- 块标签：`@param name description`、`@return description`、`@throws ExceptionClass 何时抛出`。不写类型；类型由签名表达。
- 文档注释的第一句话是摘要。空一行，再写详细内容；详细内容可以用列表、加粗和代码块。
- 行注释（`#` / `//`）也用同样的反引号和方括号。

绝不使用：reST 的 `:param x:` 和双反引号、Google 风格的 `Args` / `Returns` 小节、Javadoc HTML 标签以及 `{@link}` / `{@code}`、JSDoc 的 `{Type}`。

同一个函数，在三种语言中结构一致：

```kotlin
/**
 * 释放 [token] 持有的会话锁。
 *
 * 仅当 `GET` 到的值等于 [token] 时才删除，这样锁已过期的旧持有者删不掉新锁。
 *
 * @return 删除了返回 `true`；锁已归他人则返回 `false`
 */
fun release(sessionId: String, token: String): Boolean
```

```python
def release(session_id: str, token: str) -> bool:
    """释放 [token] 持有的会话锁。

    仅当 `GET` 到的值等于 [token] 时才删除，这样锁已过期的旧持有者删不掉新锁。

    @return 删除了返回 `True`；锁已归他人则返回 `False`
    """
```

```ts
/**
 * 释放 [token] 持有的会话锁。
 *
 * 仅当 `GET` 到的值等于 [token] 时才删除，这样锁已过期的旧持有者删不掉新锁。
 *
 * @return 删除了返回 `true`；锁已归他人则返回 `false`
 */
function release(sessionId: string, token: string): boolean
```

## 中文名字标记：`@Comment`

Superpowers 扩展的代码阅读预览会以中文渲染代码。给一个名字起一个中文名字，预览就会在用到这个名字的地方显示它（悬停时显示原名）。例如，`if current_user.role != UserRole.ADMIN` 会显示为「如果 当前用户.role 不等于 用户角色.管理员」。类名只有在类带有标记时才会被渲染。

标记不是解释。它是一张**名字对照表**：只有名字，没有描述。解释仍然写在普通注释和文档字符串里。

### 怎么写（只写在定义处，绝不写在调用处）

**规则：代码能携带标记的地方，就不要用注释。** 代码标记错了会大声失败，能跟随重命名，并随定义一起消失。注释标记错了会悄无声息地失败，识别不了的注释标记会作为杂物一直留在代码里。只在语言没有地方放代码标记时，才用注释标记。

**Python**

```python
from app.core.naming import Comment                    # 项目里的空操作 Comment（见下文）

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
- 只有**枚举成员**用尾随的 `# @Comment name`，因为 `ADMIN = "admin"` 没有地方放代码标记。
- 在项目里保留一个空操作的 `Comment`，供装饰器和 `Annotated` 共用：

  ```python
  def Comment(name: str):                              # 只供代码阅读预览读取；原样返回目标
      def mark(target):
          return target
      return mark
  ```

**TypeScript / JavaScript**

- 类、方法、方法参数、构造函数参数：装饰器 `@Comment("name")`。
- 普通函数参数、变量、枚举成员没有代码形式，用尾随的 `// @Comment name`。

**不要依赖的兜底**：没有标记时，预览会取文档字符串 `Args:` / `:param x:` 条目或 JSDoc `@param` 条目的第一个分句（最多 12 个字符）当中文名字。这是为旧代码准备的。新名字一律按上面的方式显式加标记。参数描述本身就是目的，该怎么写就怎么写；绝不要为了凑出中文名字而改写描述。

### 什么时候加

- **加**：领域名词、文件里反复出现的名字（`current_user`、`tenant_id`）、枚举成员、缩写和行话（`bps`、`slot`、`acks_late`），以及任何一眼看不出对应中文的名字。
- **跳过**：显而易见的名字（`i`、`name`、`url`）、只用一两次的局部变量，以及含义与其类型相同的名字（`user: User`）。
- 名字保持**短**：2–6 个汉字的名词短语，最多 12 个字符，不带标点，不带解释。

### 与注释清理的关系

- 中文名字标记不是复述代码的注释，不要删。
- 清理文档字符串时，只复述参数名字或类型的条目照删不误。如果这样的条目里有一个有用的中文名字，把它**挪进代码标记**（Python 参数用 `Annotated[…, Comment("…")]`），不要直接丢掉。