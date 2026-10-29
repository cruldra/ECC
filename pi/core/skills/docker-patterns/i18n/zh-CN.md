---
name: docker-patterns
description: Docker 和 Docker Compose 模式，涵盖本地开发、加固的 CLI 安装程序测试框架、容器安全、网络、卷以及多服务编排。在创建或评审 Dockerfile 和 Compose 服务、跨 Linux 发行版测试安装程序，或规划 macOS 和 Windows 原生验证时使用。
locale: zh-CN
source_hash: 2a880cf2f6401874151daa9bcc0eacd10cf79f5f48b97f98e93a877a8f3fd12b
translated_at: 2026-09-14T07:43:11Z
model: z-ai/glm-5.3-flash
---

# Docker 模式

用于容器化开发的 Docker 与 Docker Compose 最佳实践。

## 使用 Docker Compose 进行本地开发

### 标准 Web 应用技术栈

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      target: dev                     # 使用多阶段 Dockerfile 的 dev 阶段
    ports:
      - "3000:3000"
    volumes:
      - .:/app                        # 绑定挂载以支持热重载
      - /app/node_modules             # 匿名卷 -- 保留容器内的依赖
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
      - REDIS_URL=redis://redis:6379/0
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  mailpit:                            # 本地邮件测试
    image: axllent/mailpit
    ports:
      - "8025:8025"                   # Web UI
      - "1025:1025"                   # SMTP

volumes:
  pgdata:
  redisdata:
```

### 开发与生产环境的 Dockerfile

```dockerfile
# Stage: dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage: dev (hot reload, debug tools)
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage: build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# Stage: production (minimal image)
FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

### 覆盖文件

```yaml
# docker-compose.override.yml（自动加载，仅开发环境设置）
services:
  app:
    environment:
      - DEBUG=app:*
      - LOG_LEVEL=debug
    ports:
      - "9229:9229"                   # Node.js 调试器

# docker-compose.prod.yml（生产环境显式使用）
services:
  app:
    build:
      target: production
    restart: always
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
```

```bash
# 开发环境（自动加载 override 文件）
docker compose up

# 生产环境
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 网络

### 服务发现

同一 Compose 网络中的服务可通过服务名解析：
```
# 在 "app" 容器中：
postgres://postgres:postgres@db:5432/app_dev    # "db" 解析到 db 容器
redis://redis:6379/0                             # "redis" 解析到 redis 容器
```

### 自定义网络

```yaml
services:
  frontend:
    networks:
      - frontend-net

  api:
    networks:
      - frontend-net
      - backend-net

  db:
    networks:
      - backend-net              # 仅可从 api 访问，frontend 无法访问

networks:
  frontend-net:
  backend-net:
```

### 仅暴露必要的端口

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"   # 仅主机可访问，不对网络开放
    # 在生产环境中完全省略 ports -- 仅在 Docker 网络内可访问
```

## 卷策略

```yaml
volumes:
  # 命名卷：跨容器重启持久化，由 Docker 管理
  pgdata:

  # 绑定挂载：将主机目录映射进容器（用于开发）
  # - ./src:/app/src

  # 匿名卷：在绑定挂载覆盖时保留容器生成的内容
  # - /app/node_modules
```

### 常见模式

```yaml
services:
  app:
    volumes:
      - .:/app                   # 源代码（绑定挂载以支持热重载）
      - /app/node_modules        # 保护容器内的 node_modules 不受主机影响
      - /app/.next               # 保护构建缓存

  db:
    volumes:
      - pgdata:/var/lib/postgresql/data          # 持久化数据
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql  # 初始化脚本
```

## 容器安全

### Dockerfile 加固

```dockerfile
# 1. 使用明确的标签（绝不用 :latest）
FROM node:22.12-alpine3.20

# 2. 以非 root 用户运行
RUN addgroup -g 1001 -S app && adduser -S app -u 1001
USER app

# 3. 移除能力（在 compose 中配置）
# 4. 尽可能使用只读根文件系统
# 5. 镜像层中不包含机密
```

### Compose 安全

```yaml
services:
  app:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.cache
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE          # 仅在绑定 < 1024 的端口时需要
```

### 机密管理

```yaml
# 正确做法：使用环境变量（运行时注入）
services:
  app:
    env_file:
      - .env                     # 绝不将 .env 提交到 git
    environment:
      - API_KEY                  # 从主机环境继承

# 正确做法：Docker secrets（Swarm 模式）
secrets:
  db_password:
    file: ./secrets/db_password.txt

services:
  db:
    secrets:
      - db_password

# 错误做法：硬编码在镜像中
# ENV API_KEY=sk-proj-xxxxx      # 绝对不要这样做
```

## 加固的 CLI 安装程序测试框架

使用容器针对一次性的项目副本来测试安装程序行为，同时防止测试改动源码检出目录。

### 尊重平台边界

- 针对 Debian、Ubuntu 等 Linux 发行版运行真实容器。
- macOS 无法作为 Docker 容器运行，因为 Docker 共享的是 Linux 内核。改为在 macOS 上原生运行同一个无 shell 的测试入口。
- Windows 容器需要 Windows Docker 引擎。在与平台无关的逻辑上使用原生 Windows CI runner，并将 Windows 容器保留给 Windows 主机使用。
- 保留原生的 Ubuntu/macOS/Windows CI 矩阵，以覆盖主机相关的路径、命令 shim、引号处理和文件系统行为。

不要声称 Linux 容器可以验证 macOS 或 Windows 的行为。

### 强制执行隔离契约

- 通过不可变摘要固定基础镜像，并固定已安装的 CLI 版本。
- 当发行版账户名不一致时，以非 root 的数字 UID/GID 运行。
- 以只读方式挂载仓库和源项目。
- 在任何改动之前，先将源项目复制到可写的 `tmpfs` 工作区中。
- 以 `noexec`、UID/GID 1000 和 `mode=0700` 挂载 `/workspace`，使只有
  容器用户可以查看项目数据。
- 将 npm 和 npx 的可执行缓存保留在可执行的 `/tmp` 挂载点上的
  `NPM_CONFIG_CACHE=/tmp/npm-cache`。其默认大小为 2 GiB，可通过
  `ECC_TMPFS_SIZE` 调整；`ECC_WORKSPACE_SIZE` 单独控制私有
  工作区挂载的大小。
- 设置 `read_only: true`、`no-new-privileges:true`、`cap_drop: [ALL]` 以及有限的 `pids_limit`。
- 将默认的真实 CLI 服务保持在 `network_mode: none`。仅在通过一个明确
  命名的可选择性加入（opt-in）服务进行已认证的提供商会话时才添加网络
  访问；绝不让它成为环境驱动的意外默认值。
- 仅创建该工具所需的可写临时路径。
- 默认不向容器传递主机凭据。
- 默认执行 dry run，并且仅将 `dry-run`、`install`、`plugin` 和 `shell` 模式列入白名单。
- 对跨平台 runner 使用参数数组或 `spawnSync(..., { shell: false })`。绝不要将项目路径插入到 shell 命令中。

### 演练 ECC 插件安装框架

使用 `docker/plugin-setup/compose.yaml` 作为参考实现。它提供：

- `fixture-tests`，用于聚焦的安装清单、目标和执行器套件。
- `real-cli`，用于固定的基于 Debian 的通用 Linux 镜像。
- `real-cli-ubuntu`，用于固定的 Ubuntu 镜像。

在构建之前验证 Compose 模型：

```bash
docker compose -f docker/plugin-setup/compose.yaml config --quiet
```

构建两个真实 Linux 镜像：

```bash
docker compose -f docker/plugin-setup/compose.yaml \
  build real-cli real-cli-ubuntu
```

在每个镜像中运行安全的默认流程：

```bash
docker compose -p ecc-plugin-debian-test \
  -f docker/plugin-setup/compose.yaml \
  run --rm -T real-cli dry-run

docker compose -p ecc-plugin-ubuntu-test \
  -f docker/plugin-setup/compose.yaml \
  run --rm -T real-cli-ubuntu dry-run
```

dry run 会执行当前的公开命令契约：

```bash
ecc install --profile core --target claude-project --dry-run --json
```

在该命令运行之前，容器会使用 `npm pack --ignore-scripts` 从只读检出目录
创建一个本地打包的 npm 制品。它在 `/tmp` 下解压自建的 tarball，校验
`ecc-universal` 包名、必需的安装清单以及受限的 `package.json` `bin.ecc`
映射，然后调用解压出的 `ecc` 可执行文件。运行时保持在
`network_mode: none`，不执行包生命周期脚本，也不依赖主机的
`node_modules`；其精确固定的生产依赖已经包含在镜像中。

该框架会拒绝空计划、非 `claude-project` 目标、任何超出
`/workspace/project/.claude` 范围的操作，或任何会创建目标目录的 dry run。
`install` 会执行两次隔离的 apply，检查其托管安装状态，列出已安装的
目标，并运行 `doctor`。

### 启动、打开、重连和清理命名会话

不使用 `--rm` 运行一个分离式容器，这样退出终端时不会移除该会话：

```bash
docker compose -p ecc-plugin-session \
  -f docker/plugin-setup/compose.yaml \
  run --detach --name ecc-plugin-shell real-cli shell
```

容器会将只读 fixture 复制到稳定的私有目录 `/workspace/project`。
确认它正在运行，然后输出 terminal-opener v1 数据契约中 Docker 一侧的
内容：

```bash
docker inspect --format '{{.State.Running}}' ecc-plugin-shell
node docker/plugin-setup/interactive-plan.js \
  --container ecc-plugin-shell \
  --workdir /workspace/project \
  --json \
  -- bash
```

JSON 结果恰好具有 `executable` 和 `argv` 边界（加上
`contractVersion: 1`）：可执行文件是 `docker`，argv 以
`exec`、`-it` 和 `-w` 开头。当独立的 terminal-opener skill 安装后，将
该数据传递给它。这个 Docker 框架刻意不导入终端适配器、不将
shell 命令插入字符串，也不管理主机 GUI 进程。
在此之前，直接在当前主机终端中打开同一个 PTY：

```bash
docker exec -it -w /workspace/project ecc-plugin-shell bash
```

退出 shell 但不停止分离式容器。使用相同的 `docker exec -it`
命令重新连接。完成后，移除该精确命名的容器及其 Compose 项目资源：

```bash
docker rm --force ecc-plugin-shell
docker compose -p ecc-plugin-session \
  -f docker/plugin-setup/compose.yaml \
  down --remove-orphans
```

默认情况下主机凭据不存在，且凭据目录永不挂载。默认服务也没有网络
访问。当已认证的提供商会话确实需要网络时，先构建 `real-cli`，然后通过
`docker compose --profile networked run real-cli-networked
shell` 明确加入网络配置。优先在那个一次性的
会话内进行认证。如果 CI 运行必须继承主机的环境凭据，则在调用时通过显式的 Compose `--env NAME` 标志将其设为可选加入，并理解该值在
容器生命周期内可被查看并可能被泄露，并在结束后立即移除该精确命名的
容器。

在主机上原生运行同一个聚焦套件：

```bash
npm run test:plugin-setup-platform
```

在信任镜像之前，检查其生成的身份和环境：

```bash
docker image inspect ecc-plugin-setup:debian ecc-plugin-setup:ubuntu
```

清理每个命名的测试项目，而不删除不相关的卷或镜像：

```bash
docker compose -p ecc-plugin-debian-test \
  -f docker/plugin-setup/compose.yaml down --remove-orphans
docker compose -p ecc-plugin-ubuntu-test \
  -f docker/plugin-setup/compose.yaml down --remove-orphans
```

## .dockerignore

```
node_modules
.git
.env
.env.*
dist
coverage
*.log
.next
.cache
docker-compose*.yml
Dockerfile*
README.md
tests/
```

## 调试

### 常用命令

```bash
# 查看日志
docker compose logs -f app           # 跟随 app 日志
docker compose logs --tail=50 db     # db 的最后 50 行日志

# 在运行中的容器内执行命令
docker compose exec app sh           # 进入 app 的 shell
docker compose exec db psql -U postgres  # 连接 postgres

# 检查
docker compose ps                     # 运行中的服务
docker compose top                    # 每个容器中的进程
docker stats                          # 资源使用情况

# 重新构建
docker compose up --build             # 重新构建镜像
docker compose build --no-cache app   # 强制完全重建

# 清理
docker compose down                   # 停止并移除容器
docker compose down -v                # 同时移除卷（具有破坏性）
docker system prune                   # 移除未使用的镜像/容器
```

### 排查网络问题

```bash
# 检查容器内的 DNS 解析
docker compose exec app nslookup db

# 检查连通性
docker compose exec app wget -qO- http://api:3000/health

# 检查网络
docker network ls
docker network inspect <project>_default
```

## 反模式

```
# 错误做法：在生产环境中没有编排工具的情况下使用 docker compose
# 生产环境的多容器工作负载请使用 Kubernetes、ECS 或 Docker Swarm

# 错误做法：在没有卷的情况下将数据存储在容器中
# 容器是临时的 -- 没有卷的话重启即丢掉全部数据

# 错误做法：以 root 运行
# 始终创建并使用非 root 用户

# 错误做法：使用 :latest 标签
# 固定到具体版本以获得可复现的构建

# 错误做法：一个巨型容器塞入所有服务
# 关注点分离：每个容器一个进程

# 错误做法：将机密写入 docker-compose.yml
# 使用 .env 文件（加入 gitignore）或 Docker secrets
```