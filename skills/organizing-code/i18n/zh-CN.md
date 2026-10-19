---
name: organizing-code
description: '用于决定代码放在哪、文件和目录叫什么：新增模块或包、拆大文件、给文件起名、拆出子业务、调整目录结构。先按业务分，再按层分，最后按用例分；每个文件名要么说明属于哪一层，要么说明管哪件业务，不能两样都不说（不要 utils、helpers、common、misc）；同一个概念只用一个名字；层文件超过 800 行，或有 3 组互不调用的用例，就改成按用例命名的同名目录；有自己的表和接口的业务概念建成子包，不用名字前缀区分；调用方向是接口、service、repositories、models，不反向调用。回答常见的 DDD 疑问（文件名大小写、实体用业务名字、按层分还是按业务分、贫血模型），并用白名单只减不增的守卫测试逐步推广。各语言细则放在 references/<language>.md；Python 在 references/python.md。'
locale: zh-CN
source_hash: 5f32786f21a0cf295c0e38597199026f2347081bf582c07b2e42cacc0b120104
translated_at: 2026-10-17T16:24:07Z
model: claude-opus-5-5
---

# 组织代码

决定一段代码放在哪，按顺序回答三个问题：它属于哪个业务、哪一层、哪个用例。目录名和文件名由答案决定。

## 何时使用

- 新增模块、文件或包，或者给它们起名。
- 某个文件太大了，或者一个目录里混着好几个业务。
- 调整目录结构，或者评审一个新增、移动文件的改动。
- 有人问某种结构算不算「DDD」，或者两个名字该留哪个。

不管文件内部的写法，也不管函数和变量的命名。

## 各语言细则

动手前先读当前语言的细则：[Python](references/python.md)。它定下层文件名、大小写约定、拆分时这门语言特有的坑，以及守卫测试。以后每加一门语言，就加一份 `references/<language>.md`。还没有细则的语言，按下面的规则加上它自己的命名惯例来做。

别的技能的示例目录如果整个项目按层分（顶层 `routers/`、`services/`、`utils/`），文件放在哪以本技能为准。

## 怎么做

### 1. 先按业务，再按层，最后按用例

顶层目录是一个业务名词，即一个限界上下文：`order/`、`catalog/`。业务内部每一层是一个固定名字的文件（`models`、`repositories`、`service`、`routes` 等，语言细则里列全了）。某个层文件太大时，改成同名目录，目录里的文件按用例命名。

不要整个项目按层分（顶层 `controllers/`、`services/`、`models/`）。那样改一次订单就要动所有顶层目录，也看不出一个业务到哪为止。

### 2. 文件名要么说明层，要么说明业务

每个文件名只说两件事之一：它是哪一层（`repositories`），或者它管哪件业务、哪个用例（`checkout`）。两样都不说的名字禁用：`utils`、`helpers`、`common`、`misc`、`service_helpers`。唯一的例外是全项目共享的基础设施目录，例如放数据库会话、配置、日志的 `core/`。

辅助函数放进用到它的那个业务的层文件里。两个业务都用的，放到拥有这个概念的业务里；是基础设施的，放进 `core/`。

### 3. 同一个概念只用一个名字

下面每一对在整个项目里只留一个：`service` 或 `services`，`repository` 或 `repositories`，`errors` 或 `exceptions`。具体留哪个由语言细则定。

### 4. 只建用得到的文件

层文件等第一段代码来了再建。不要为业务以后可能用到的层预先建空文件。

### 5. 超过 800 行或有 3 组用例时，文件变目录

层文件超过 800 行，或者里面有 3 组以上互相不调用的用例，就改成同名目录。目录里的文件按用例命名：`service/checkout.py`、`service/refunding.py`。目录里不出现与目录同名的文件：不要 `service/service.py`。

### 6. 有自己的表和接口的子业务建成子包

一个业务概念有自己的表和自己的接口（端点、管理页面）时，建成子包，子包内部按同样的规则组织。不要用名字前缀区分子业务：`routing_models.py`、`routing_repositories.py` 应该是 `routing/models.py`、`routing/repositories.py`。

### 7. 调用只朝一个方向

接口（用户端路由、管理端、定时任务）→ service → repositories → models。不往回调用：repository 不调 service，model 不调 repository。

## DDD 疑问

- **文件名大小写和 DDD 无关。** 用 `snake_case` 还是 `PascalCase` 跟语言惯例走。DDD 关心的是名字用没用业务方的语言、边界划没划对。
- **实体按它代表的「一个」东西命名，用业务方的说法。** 一行代表一个案例，就叫 `Case`，不叫 `CaseLibrary`：「库」是集合，管集合是 repository 的事。
- **先按业务，再按层。** 不推荐整个项目按层分（顶层 `controller/`、`service/`）。DDD 的 domain、application、infrastructure 本身也是层，放在业务里面，不放在顶层。
- **只放数据的实体也可以。** 实体只放数据、逻辑全在 service 里，是贫血模型。严格 DDD 不提倡，但在 Python + SQLAlchemy 这类项目里是主流且够用，不必为此改代码。有明确的业务规则时，例如「只有 READY 的案例能 fork」，优先写成实体的方法。

## 推广：用守卫测试，不一次性大重构

不要一次性重构整个代码库。加一个测试扫描源码目录，报告：

- 禁用的名字（规则 2），
- 选定层名的同义名（规则 3），
- 超过 800 行的文件（规则 5），
- 与所在目录同名的文件 `x/x.py`（规则 5），
- 带前缀的层文件，例如 `routing_models`（规则 6）。

已有的违规列进白名单，白名单只减不增。新违规让测试失败。白名单里的条目已经修好，测试也失败，提示删掉这一行，防止退回去。然后每个子系统一个工单逐个迁移。语言细则里有可以直接复制的测试。

## 示例

整个项目按层分的订单业务（Python 名字）：

```text
app/
  services/
    order_service.py        # 1,400 lines: checkout, refunds, invoices
    order_helpers.py
  models/
    order.py
    shipping_models.py
  utils.py
```

同样的代码按业务、层、用例组织：

```text
app/
  core/
    db.py
  order/
    models.py
    repositories.py
    service/
      checkout.py
      refunding.py
      invoicing.py
    routes.py
    exceptions.py
    shipping/               # its own tables and endpoints
      models.py
      repositories.py
      service.py
      routes.py
```

- `services/` 变成每个业务一个 `service`；`order_service.py` 里有三组互不调用的用例，按用例拆开。
- `order_helpers.py` 和 `utils.py` 既不说明层也不说明业务；里面的函数挪进用到它们的层文件，数据库设置挪进 `core/`。
- `shipping_models.py` 用前缀区分子业务；配送有自己的表和接口，所以变成 `order/shipping/`。

## 完成之前

对这次改动里新增、改名或拆分的每个文件和目录：

1. 路径读起来是业务、层、用例的顺序。
2. 名字说明了层或业务，并且用的是这个概念选定的那一个名字。
3. 里面有代码，没有占位文件。
4. 超过 800 行或有 3 组独立用例的层文件已经改成目录，目录里没有与目录同名的文件。
5. 导入方向是接口 → service → repositories → models，没有反向。
6. 守卫测试通过，这次改动修好的白名单条目已经删掉。
