---
name: flox-environments
description: "使用 Flox（一个基于声明式 Nix 的环境管理器）创建可复现的跨平台（macOS/Linux）开发环境。适用于为任何语言设置项目工具链、安装系统级依赖（编译器、数据库、openssl/BLAS 等原生库）、为团队锁定确切的软件包版本、运行本地服务（PostgreSQL、Redis、Kafka）、用一条命令让开发者上手，或解决"在我机器上能跑"的问题——包括需要项目级工具且无需 sudo 的 agent/vibe-coding 场景。当用户提到 .flox/、manifest.toml、flox activate 或 FloxHub 时也应使用。"
metadata:
  origin: Flox
  locale: zh-CN
locale: zh-CN
source_hash: d15e0af4d6f57ea085482f163d0d1658279301202b161087e9e6f66e7f4b91c9
translated_at: 2026-09-14T07:46:50Z
model: z-ai/glm-5.3-flash
---

# Flox 环境

Flox 在单个 TOML 清单文件中定义可复现的开发环境。团队中的每位开发者都能获得完全相同的软件包、工具和配置——跨越 macOS 和 Linux——而无需容器或虚拟机。基于 Nix 构建，可访问超过 150,000 个软件包。

## 何时激活

当用户遇到环境管理问题时，即使他们没有提到 Flox，也应使用此技能。在以下情况 Flox 是合适的工具：

- 项目需要**系统级软件包**（编译器、数据库、CLI 工具）以及特定语言的依赖
- **可复现性很重要**——环境设置应在队友的机器上、CI 中或全新的笔记本电脑上表现完全一致
- 用户需要**多个工具共存**——例如，在同一个环境中同时使用 Python 3.11 + PostgreSQL 16 + Redis + Node.js
- 需要**跨平台支持**（同一份配置同时支持 macOS 和 Linux）
- **AI agent 需要安装工具**——Flox 让 agent 无需 sudo、不污染系统、不受沙箱限制即可向项目级环境添加软件包

如果用户只需要一个没有任何系统依赖的单语言运行时，标准的工具（仅用 nvm、pyenv、rustup）可能就足够了。如果他们需要完整的操作系统级隔离，容器可能更合适。Flox 正处于最佳平衡点：声明式、可复现的环境，且没有容器的开销。

**前置条件：** 必须先安装 Flox——请参见 [flox.dev/docs](https://flox.dev/docs/install-flox/install/) 了解 macOS、Linux 和 Docker 的安装方式。

## 核心概念

Flox 环境定义在 `.flox/env/manifest.toml` 中，并通过 `flox activate` 激活。清单文件声明软件包、环境变量、设置钩子（hook）和 shell 配置——是在任何地方复现该环境所需的一切。

**关键路径：**
- `.flox/env/manifest.toml` — 环境定义（应提交到版本控制）
- `$FLOX_ENV` — 已安装软件包的运行时路径（类似 `/usr`——包含 `bin/`、`lib/`、`include/`）
- `$FLOX_ENV_CACHE` — 缓存、虚拟环境、数据的持久化本地存储（重建后仍然存在）
- `$FLOX_ENV_PROJECT` — 项目根目录（`.flox/` 所在位置）

## 核心命令

```bash
flox init                       # 创建新环境
flox search <package> [--all]   # 搜索软件包
flox show <package>             # 显示可用版本
flox install <package>          # 添加软件包
flox list                       # 列出已安装的软件包
flox activate                   # 进入环境
flox activate -- <cmd>          # 在环境中运行命令而不启动子 shell
flox edit                       # 交互式编辑清单
```

## 清单结构

```toml
# .flox/env/manifest.toml

[install]
# 要安装的软件包 —— 环境的核心
ripgrep.pkg-path = "ripgrep"
jq.pkg-path = "jq"

[vars]
# 静态环境变量
DATABASE_URL = "postgres://localhost:5432/myapp"

[hook]
# 非交互式设置脚本（每次激活时运行）
on-activate = """
  echo "Environment ready"
"""

[profile]
# shell 函数和别名（在交互式 shell 中可用）
common = """
  alias dev="npm run dev"
"""

[options]
# 支持的平台
systems = ["x86_64-linux", "aarch64-linux", "x86_64-darwin", "aarch64-darwin"]
```

## 软件包安装模式

### 基本安装

```toml
[install]
nodejs.pkg-path = "nodejs"
python.pkg-path = "python311"
rustup.pkg-path = "rustup"
```

### 版本锁定

```toml
[install]
nodejs.pkg-path = "nodejs"
nodejs.version = "^20.0"          # Semver 范围：最新的 20.x

postgres.pkg-path = "postgresql"
postgres.version = "16.2"         # 精确版本
```

### 平台特定的软件包

```toml
[install]
# 仅限 Linux 的工具
valgrind.pkg-path = "valgrind"
valgrind.systems = ["x86_64-linux", "aarch64-linux"]

# macOS 框架
Security.pkg-path = "darwin.apple_sdk.frameworks.Security"
Security.systems = ["x86_64-darwin", "aarch64-darwin"]

# macOS 上的 GNU 工具（默认的 BSD 版本有差异时）
coreutils.pkg-path = "coreutils"
coreutils.systems = ["x86_64-darwin", "aarch64-darwin"]
```

### 解决软件包冲突

当两个软件包安装同一个二进制文件时，使用 `priority`（数字越小者优先）：

```toml
[install]
gcc.pkg-path = "gcc12"
gcc.priority = 3

clang.pkg-path = "clang_18"
clang.priority = 5               # 发生文件冲突时 gcc 胜出
```

使用 `pkg-group` 将应一起解析版本的软件包分组：

```toml
[install]
python.pkg-path = "python311"
python.pkg-group = "python-stack"

pip.pkg-path = "python311Packages.pip"
pip.pkg-group = "python-stack"    # 与 python 一起解析版本
```

## 各语言专用配方

### Python（配合 uv）

```toml
[install]
python.pkg-path = "python311"
uv.pkg-path = "uv"

[vars]
UV_CACHE_DIR = "$FLOX_ENV_CACHE/uv-cache"
PIP_CACHE_DIR = "$FLOX_ENV_CACHE/pip-cache"

[hook]
on-activate = """
  venv="$FLOX_ENV_CACHE/venv"
  if [ ! -d "$venv" ]; then
    uv venv "$venv" --python python3
  fi
  if [ -f "$venv/bin/activate" ]; then
    source "$venv/bin/activate"
  fi

  if [ -f requirements.txt ] && [ ! -f "$FLOX_ENV_CACHE/.deps_installed" ]; then
    uv pip install --python "$venv/bin/python" -r requirements.txt --quiet
    touch "$FLOX_ENV_CACHE/.deps_installed"
  fi
"""
```

### Node.js

```toml
[install]
nodejs.pkg-path = "nodejs"
nodejs.version = "^20.0"

[hook]
on-activate = """
  if [ -f package.json ] && [ ! -d node_modules ]; then
    npm install --silent
  fi
"""
```

### Rust

```toml
[install]
rustup.pkg-path = "rustup"
pkg-config.pkg-path = "pkg-config"
openssl.pkg-path = "openssl"

[vars]
RUSTUP_HOME = "$FLOX_ENV_CACHE/rustup"
CARGO_HOME = "$FLOX_ENV_CACHE/cargo"

[profile]
common = """
  export PATH="$CARGO_HOME/bin:$PATH"
"""
```

### Go

```toml
[install]
go.pkg-path = "go"
gopls.pkg-path = "gopls"
delve.pkg-path = "delve"

[vars]
GOPATH = "$FLOX_ENV_CACHE/go"
GOBIN = "$FLOX_ENV_CACHE/go/bin"

[profile]
common = """
  export PATH="$GOBIN:$PATH"
"""
```

### C/C++

```toml
[install]
gcc.pkg-path = "gcc13"
gcc.pkg-group = "compilers"

# 重要：仅有 gcc 不会暴露 libstdc++ 头文件 —— 你需要 gcc-unwrapped
gcc-unwrapped.pkg-path = "gcc-unwrapped"
gcc-unwrapped.pkg-group = "libraries"

cmake.pkg-path = "cmake"
cmake.pkg-group = "build"

gnumake.pkg-path = "gnumake"
gnumake.pkg-group = "build"

gdb.pkg-path = "gdb"
gdb.systems = ["x86_64-linux", "aarch64-linux"]
```

## 钩子（Hook）与 Profile

### Hunter——不对，是 Hooks——非交互式设置

钩子在每次激活时运行。应保持它们的速度快且幂等。经验法则：**如果应当自动发生，就放在 `[hook]` 中；如果应当由用户手动输入，就放在 `[profile]` 中。**

```toml
[hook]
on-activate = """
  setup_database() {
    if [ ! -d "$FLOX_ENV_CACHE/pgdata" ]; then
      initdb -D "$FLOX_ENV_CACHE/pgdata" --no-locale --encoding=UTF8
    fi
  }
  setup_database
"""
```

### Profile —— 交互式 Shell 配置

Profile 代码在用户的 shell 会话中可用。

```toml
[profile]
common = """
  dev() { npm run dev; }
  test() { npm run test -- "$@"; }
"""
```

## 反模式

### 绝对路径

```toml
# 差 —— 在其他机器上会失效
[vars]
PROJECT_DIR = "/home/alice/projects/myapp"

# 好 —— 使用 Flox 环境变量
[vars]
PROJECT_DIR = "$FLOX_ENV_PROJECT"
```

### 在钩子中使用 exit

```toml
# 差 —— 会杀死 shell
[hook]
on-activate = """
  if [ ! -f config.json ]; then
    echo "Missing config"
    exit 1
  fi
"""

# 好 —— 从钩子返回，不要 exit
[hook]
on-activate = """
  if [ ! -f config.json ]; then
    echo "Missing config — run setup first"
    return 1
  fi
"""
```

### 在清单中存储密钥

```toml
# 差 —— 清单会被提交到 git
[vars]
API_KEY = "<set-at-runtime>"

# 好 —— 引用外部配置或在运行时传入
# 用法：API_KEY="<your-api-key>" flox activate
[vars]
API_KEY = "${API_KEY:-}"
```

### 没有幂等保护、执行缓慢的钩子

```toml
# 差 —— 每次激活都会重新安装
[hook]
on-activate = """
  pip install -r requirements.txt
"""

# 好 —— 已安装则跳过
[hook]
on-activate = """
  if [ ! -f "$FLOX_ENV_CACHE/.deps_installed" ]; then
    uv pip install -r requirements.txt --quiet
    touch "$FLOX_ENV_CACHE/.deps_installed"
  fi
"""
```

### 将用户命令放入钩子

```toml
# 差 —— 钩子中的函数在交互式 shell 中不可用
[hook]
on-activate = """
  deploy() { kubectl apply -f k8s/; }
"""

# 好 —— 用户可调用的函数使用 [profile]
[profile]
common = """
  deploy() { kubectl apply -f k8s/; }
"""
```

## 全栈示例

一个包含 PostgreSQL 的 Python API 完整环境：

```toml
[install]
python.pkg-path = "python311"
uv.pkg-path = "uv"
postgresql.pkg-path = "postgresql_16"
redis.pkg-path = "redis"
jq.pkg-path = "jq"
curl.pkg-path = "curl"

[vars]
UV_CACHE_DIR = "$FLOX_ENV_CACHE/uv-cache"
DATABASE_URL = "postgres://localhost:5432/myapp"
REDIS_URL = "redis://localhost:6379"

[hook]
on-activate = """
  if [ ! -d "$FLOX_ENV_CACHE/pgdata" ]; then
    initdb -D "$FLOX_ENV_CACHE/pgdata" --no-locale --encoding=UTF8
  fi

  venv="$FLOX_ENV_CACHE/venv"
  if [ ! -d "$venv" ]; then
    uv venv "$venv" --python python3
  fi
  if [ -f "$venv/bin/activate" ]; then
    source "$venv/bin/activate"
  fi

  if [ -f requirements.txt ] && [ ! -f "$FLOX_ENV_CACHE/.deps_installed" ]; then
    uv pip install --python "$venv/bin/python" -r requirements.txt --quiet
    touch "$FLOX_ENV_CACHE/.deps_installed"
  fi
"""

[profile]
common = """
  serve() { uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; }
  migrate() { alembic upgrade head; }
"""

[services]
postgres.command = "postgres -D $FLOX_ENV_CACHE/pgdata -k $FLOX_ENV_CACHE"
redis.command = "redis-server --port 6379 --daemonize no"

[options]
systems = ["x86_64-linux", "aarch64-linux", "x86_64-darwin", "aarch64-darwin"]
```

启动服务并激活：`flox activate --start-services`

## 环境共享

Flox 环境是 git 原生的。提交 `.flox/` 目录，每位协作者都能获得相同的环境：

```bash
git add .flox/
git commit -m "Add Flox environment"
# 队友只需运行：
git clone <repo> && cd <repo> && flox activate
```

对于跨项目可复用的基础环境，可推送到 FloxHub：

```bash
flox push                         # 将环境推送到 FloxHub
flox activate -r owner/env-name   # 在任何地方激活远程环境
```

使用 `[include]` 组合环境：

```toml
[include]
base.floxhub = "myorg/python-base"

[install]
# 在基础环境之上添加项目特定的软件包
fastapi.pkg-path = "python311Packages.fastapi"
```

## AI 辅助与 Vibe Coding

Flox 非常适合 AI 辅助开发和 vibe coding 工作流。当 AI agent 需要当前环境中没有的工具时——编译器、数据库、linter、CLI 实用工具——它可以将其添加到项目的 Flox 清单中，而无需 sudo 权限、不污染系统软件包、也不受沙箱限制。

**这对 agent 为什么重要：**
- **无需 sudo** —— `flox install` 完全在用户空间中运行，agent 无需提升权限即可添加软件包
- **项目级作用域** —— 软件包只安装到项目环境中而非全局，因此不同项目可以使用不同版本而互不冲突
- **沙箱友好** —— 在沙箱或受限环境中运行的 agent 依然可以通过 Flox 安装所需的工具
- **可撤销** —— 每项更改都记录在 `manifest.toml` 中，因此可以干净地移除不需要的软件包，不在系统中留下残留
- **可复现** —— agent 设置好的环境会被原样提交到 git，对所有人同样有效

**Agent 工作流模式：**

```bash
# Agent 发现自己需要一个工具（例如用于 JSON 处理的 jq）
flox search jq                    # 确认该软件包存在
flox install jq                   # 安装到项目环境

# 或者为了更多控制，直接编辑清单
tmp_manifest="$(mktemp)"
flox list -c > "$tmp_manifest"
# 将软件包添加到 [install] 部分，然后应用
flox edit -f "$tmp_manifest"

# 在工具可用的状态下运行命令
flox activate -- jq '.results[]' data.json
```

这使得 Flox 天然适合任何需要 Claude Code 或其他 AI agent 即时引导项目工具链的工作流。

## 调试

```bash
flox list -c                      # 显示原始清单
flox activate -- which python     # 查看解析到哪个二进制文件
flox activate -- env | grep FLOX  # 查看 Flox 环境变量
flox search <package> --all       # 更宽泛的软件包搜索（区分大小写）
```

**常见问题：**
- **找不到软件包：** 搜索区分大小写——尝试 `flox search --all`
- **软件包之间的文件冲突：** 给应当胜出的软件包添加 `priority`
- **钩子失败：** 使用 `return` 而非 `exit`；使用 `${FLOX_ENV_CACHE:-}` 进行保护
- **过时的依赖：** 删除 `$FLOX_ENV_CACHE/.deps_installed` 标记文件

## 相关技能

以下技能属于 [Flox Claude Code 插件](https://github.com/flox/flox-agentic)，提供更深入的集成：

- **flox-services** — 服务管理、数据库设置、后台进程
- **flox-builds** — 使用 Flox 进行可复现构建和打包
- **flox-containers** — 从 Flox 环境创建 Docker/OCI 容器
- **flox-sharing** — 环境组合、远程环境、团队协作模式
- **flox-cuda** — CUDA 和 GPU 开发环境

了解更多并安装，请访问 [flox.dev/docs](https://flox.dev/docs/install-flox/install/)