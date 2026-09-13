---
name: lightweb-fastapi-starter
description: 快速创建基于 FastAPI + Metro UI 5 + TailwindCSS + Lit 的轻量级 Web 项目模板。用于初始化现代化的 Python Web 应用，包含完整的项目结构、Web Components 前端、配置文件和 Docker 支持。当用户需要创建一个轻量级的 Web 项目时使用此 skill。
---

# FastAPI 轻量级 Web 项目启动器

此 skill 帮助快速创建基于 FastAPI 的轻量级 Web 项目，采用现代化的前端技术栈（Metro UI 5 + TailwindCSS + Lit Web Components）。

## 技术栈

- **后端**: Python 3.10+, FastAPI, Pydantic, SQLAlchemy
- **前端**: Jinja2 模板, Metro UI 5, TailwindCSS, Lit (Web Components)
- **包管理**: UV (现代 Python 包管理器)
- **部署**: Docker, Docker Compose

## 使用方法

当用户要求创建新项目时，执行以下步骤：

### 1. 收集项目信息

询问用户：
- 项目名称 (project_name)
- 项目描述 (project_description)
- 作者名称 (author_name, 可选，默认 "Developer")
- 作者邮箱 (author_email, 可选，默认 "dev@example.com")
- 目标目录 (默认当前目录)

### 2. 创建项目目录

```bash
mkdir -p {target_dir}/{project_name}
```

### 3. 复制并处理模板文件

从 `assets/template/` 复制所有文件到目标目录，替换模板变量：

| 变量 | 替换为 |
|------|--------|
| `{{project_name}}` | 项目名称 |
| `{{project_description}}` | 项目描述 |
| `{{author_name}}` | 作者名称 |
| `{{author_email}}` | 作者邮箱 |

### 4. 创建必要目录

```bash
cd {target_dir}/{project_name}
mkdir -p storage logs
```

### 5. 初始化项目

```bash
# 安装 UV (如果未安装)
pip install uv

# 安装依赖
uv sync

# 复制环境变量文件
cp .env.example .env
```

### 6. 启动开发服务器

```bash
uv run python main.py
```

访问 http://localhost:8000

## 项目结构

生成的项目包含：

```
{project_name}/
├── main.py              # FastAPI 应用入口
├── config.py            # Pydantic Settings 配置
├── pyproject.toml       # UV 依赖管理
├── .env.example         # 环境变量模板
├── Dockerfile           # Docker 配置
├── docker-compose.yml   # Docker Compose 配置
├── README.md            # 项目说明
├── routes/              # API 路由
│   ├── web.py          # Web 页面路由
│   └── api.py          # API 端点
├── models/              # Pydantic 数据模型
├── templates/           # Jinja2 模板
├── static/              # 静态资源
│   ├── css/            # 样式文件
│   └── js/             # JavaScript
│       └── components/ # Lit Web Components
├── storage/             # 数据存储
└── utils/               # 工具函数
```

## 前端技术

### UI 框架
- **Metro UI 5**: 组件库和样式系统
- **TailwindCSS**: 实用工具类 CSS
- **Font Awesome**: 图标库

### Web Components
- **Lit**: 现代 Web Components 库
- **组件**:
  - `app-root`: 应用根组件（导航栏）
  - `app-grid`: 应用网格布局
  - `app-card`: 应用卡片组件

## 扩展项目

### 添加新路由

在 `routes/` 创建新文件，在 `main.py` 中注册。

### 添加新模板

在 `templates/` 创建 HTML 文件，继承 base.html。

### 添加 Web Component

在 `static/js/components/` 创建新的 Lit 组件。

## Docker 部署

```bash
docker-compose up -d
```

## 注意事项

1. 确保已安装 UV: `pip install uv`
2. Python 版本要求: >= 3.10, < 3.14
3. 首次运行前复制 `.env.example` 到 `.env`
4. 默认端口 8000
