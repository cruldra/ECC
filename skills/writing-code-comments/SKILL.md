---
name: writing-code-comments
description: '编写或修改任意语言的代码注释 / 文档字符串时使用(示例用 Python)。核心招式:函数只要有多个分支或多个顺序阶段(try / 多 except、if / elif 链、多步流程),就用 ① ② ③ 标骨架 + 右对齐注释列 + ← / → 箭头,把控制流画成一眼可读的地图。每条注释只讲「为什么 / 坑」,不复述「做了什么」。删坏注释(复述代码、废话、历史痕迹、复述签名的参数 / 返回值说明)是强制的;新增注释要克制。另管「中文名」标记(`# @Comment 当前用户`、`Annotated[T, Comment("…")]`、`@Comment("…")`):给参数 / 变量 / 枚举成员 / 函数 / 类起一个短的中文名,供代码阅读预览把代码读成中文。'
---

# 写代码注释

## 注释只有两个目的

1. **讲门道** —— 回答「为什么 / 有什么坑」,从不复述「这行做了什么」。
2. **画地图** —— 函数有多分支 / 多步骤时,用注释把控制流骨架摊成一眼可读的导航。

下面先讲怎么清掉坏的(删),再讲怎么画出效果(地图)。

## 删 vs 加:两套标准

- **删**(清理坏注释)→ **强制**。见一条删一条,不因「克制 / 本来还行」手软。
- **加**(写新注释)→ **克制**。只在代码本身讲不清「为什么 / 坑」时才加。

> 「克制」只管「加」,**不管「删」**。该删的复述 / 废话必须删干净。

## 必删的坏注释(三类,见一删一)

```python
x = get_user(uid)      # 获取用户              ← 复述代码,删
# 下面是循环                                   ← 结构标签,删
return result          # 返回结果              ← 废话,删
# 2024-03 改为异步,原来是同步                  ← 历史痕迹(git 记),删
```

## 文档字符串:逐条机械判定

逐条检查参数 / 返回值 / 异常说明:

> **判据**:遮住函数签名,这条还能告诉你签名里**没有**的信息吗?
> - **不能**(只复述参数名 / 类型 / 返回类型)→ **删掉这一条**。
> - **能**(取值约束、单位、默认行为、副作用、为什么、坑、异常的具体触发条件)→ **保留**,只留新信息。

- 参数 / 返回值说明**整块**都是复述 → 整块删光,只留一句「功能 / 为什么」。
- 对所有函数一视同仁:同样是复述签名的条目,不存在「这文件删、那文件留」。

```python
# 差:遮住签名后零新信息 → 整块删
def release(session_id, token):
    """释放锁。
    Args: session_id: 会话 id。 token: token。
    Returns: bool。"""

# 好:只留签名看不出的门道
def release(session_id, token):
    """Lua CAS 释放:GET value==token 才 DEL —— 防 TTL 过期后旧持有者误删新锁。"""
```

## 核心招式:给有控制流的函数画「骨架地图」

**这是最出效果、也最容易被漏掉的一招。** 函数只要有**多个分支或多个顺序阶段**(try / 多个 except、if / elif 链、多步流程),就别让读者逐行啃 —— 用三样东西把骨架摊开:

1. **`# ① ② ③` 标出骨架的每个阶段 / 分支**,必要时配「下文细说」。
2. **行内注释右对齐成一列** —— 扫这一列,不读函数体就懂整个函数怎么走。
3. **箭头**:`←` 表来源 / 方向,`→` 表导致 / 产出。

每条注释仍讲门道(为什么 / 坑),不复述操作。

**黄金范例**(消费端 `_drive_sse`:把后台队列事件转成 SSE 推给浏览器):

```python
async def _drive_sse(*, handle: RunHandle, session, runner, ...):
    bind_context(session_id=str(session.id))       # 本连接每行日志带 session_id, 便于报障还原
    try:
        async for event in handle.events():        # ← 从 RunHandle 队列一条条拉事件
            # 首见 LLM 节点的 NODE_END → 发后即忘起一个标题生成任务, 与主流并行(下文细说)
            ...
            yield {                                # ← 翻译成 sse-starlette 期望的帧格式
                "event": str(event.type),
                "data": event.model_dump_json(),   #   平台事件序列化成 JSON 推给浏览器
            }
    except asyncio.CancelledError:                 # ① 断连: sse-starlette 取消了本协程
        handle.request_park()                      #   不杀 graph task, 只请求它停在干净边界
        raise                                      #   重抛, 守住"协作式取消"契约
    except Exception as exc:                       # ② graph task 抛异常(FAILED / 业务中断)
        error_type, message = describe_failure(exc)  # 上游异常 → 业务错误码 + 可读文案
        yield {"event": ERROR, "data": ...}        #   向流尾补一帧带内 error, 再优雅关闭
        return
    # ③ 干净结束(events 正常返回)
    if handle.task.cancelled():                    #   用户主动 Stop: graph task 已写 CANCELLED + 回退
        yield {"event": SESSION_CANCELLED, ...}    #   补帧让发起方立即确认, 不必等 5s 兜底
    # COMPLETED / INTERRUPTED: 终态已由 graph task 写, 无需补帧
```

不读函数体,光扫右边那列注释:断连①→停在干净边界、异常②→补 error 帧、正常③→区分用户取消还是自然完成。**这就是目标效果。**

要点:
- `①②③` 落在**控制流的转折处**(每个 except、每个结束分支),不是随便编号。
- 右对齐让注释成列;箭头让「来源 / 产出」一眼分清。
- **「带逻辑的分支」正是该画地图的地方**(不要因为分支里有几行代码就放弃画)。

## 何时**不**画地图(别硬套)

- 单分支、纯线性、一两行的简单函数(如 `get` / `touch`)→ 不需要骨架,删干净、清爽即可。
- 判据:函数有 **≥2 个并列分支或多步流程** → 值得画;否则别加。

## 中文名标记:`@Comment`

Superpowers 插件的「代码阅读」预览会把代码翻成中文来读。给名字起一个中文名,预览里用到它的地方都换成中文名(鼠标停上去看原名),比如 `if current_user.role != UserRole.ADMIN` 读成「如果 当前用户.role 不等于 UserRole.管理员」。

它不是注释意义上的「讲门道」,而是一张**名字对照表**:只写名字,不写解释。解释照旧写在普通注释 / docstring 里。

### 写法(只写在**定义处**,不写在用到的地方)

```python
async def get_user(
    user_id: Int4Path,                                 # @Comment 用户编号
    current_user: User = Depends(get_current_user),    # @Comment 当前用户
) -> UserDetailResponse: ...

class UserRole(str, enum.Enum):
    ADMIN = "admin"                                    # @Comment 管理员
    USER = "user"                                      # @Comment 普通用户

MAX_RETRY = 3                                          # @Comment 最大重试次数
```

- **首选行尾标记** `# @Comment 名字`(TypeScript / JavaScript 用 `// @Comment 名字`):不用引任何东西,参数、变量、字段、枚举成员、属性都能写。多行签名里写在那个参数那一行的行尾。
- 项目里本来就在用 `Annotated` 时,可以写成 `current_user: Annotated[User, Comment("当前用户")]`。
- 函数 / 类用装饰器 `@Comment("…")`;TypeScript 的类、方法、方法参数也能用装饰器。这两种要在项目里有一个什么都不干的 `Comment`:

  ```python
  def Comment(name: str):                              # 只给代码阅读预览看, 运行时原样返回
      def mark(target):
          return target
      return mark
  ```

- 行尾标记和普通说明可以写在一起:`# 超时秒数, 含重试 @Comment 超时` —— 预览会把 `@Comment …` 从说明里去掉。
- 兜底:没写标记时,预览会取 docstring `Args:` / `:param x:` 或 JSDoc `@param` 里**第一小句且不超过 12 个字**的说明当中文名。所以参数说明要么以短名字开头(`current_user: 当前用户, 由登录态注入`),要么就是讲门道的长句(不会被误取)。

### 什么时候加

- **加**:领域名词、在文件里反复出现的名字(`current_user`、`tenant_id`)、枚举成员、英文缩写 / 行话(`bps`、`slot`、`acks_late`)、读中文时一眼对不上的名字。
- **不加**:一眼就懂的(`i`、`name`、`url`)、只用一两次的局部变量、和类型名一个意思的(`user: User`)。
- 名字要**短**:名词短语,2~6 个字为宜,最多 12 个字,不带标点、不带解释。

### 和「删坏注释」的关系

- 中文名标记不算「复述代码」,不删。
- 清理 docstring 时,只复述参数名 / 类型的条目照样删;但如果那条里有一个有用的中文名,**把它改成行尾 `@Comment` 标记**,别直接丢掉。

## 红线

- **不留历史痕迹** —— 谁改的、原来怎样、修了什么 bug,一律不写。
- **短** —— 一句话能说清不写两句。
- `→` 专表「映射 / 产出 / 转化」,`←` 表「来源 / 方向」。

## 何时不用本规则

- 一次性脚本、临时调试代码。
- 已经清爽且没有复杂控制流的代码:不要为「套用本规则」反而加注释 —— 但**该删的坏注释仍要删**。
