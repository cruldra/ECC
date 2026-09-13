# {{project_name}}

{{project_description}}

## 技术栈

- **Runtime**: Python 3.10+
- **Web Framework**: FastAPI
- **Frontend**: Jinja2 + Metro UI 5 + TailwindCSS + Lit (Web Components)
- **Package Manager**: UV
- **Container**: Docker

## 快速开始

### 环境要求

- Python >= 3.10, < 3.14
- UV 包管理器

### 安装

1. 安装 UV:
```bash
pip install uv
```

2. 安装依赖:
```bash
uv sync
```

3. 配置环境变量:
```bash
cp .env.example .env
# 编辑 .env 文件
```

4. 启动服务:
```bash
uv run python main.py
```

访问 http://localhost:8000

### Docker 部署

```bash
docker-compose up -d
```

## 项目结构

```
{{project_name}}/
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
  - `app-root`: 应用根组件
  - `app-grid`: 应用网格布局
  - `app-card`: 应用卡片组件

## 开发

### 添加新路由

在 `routes/` 目录下创建新的路由文件:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/new", tags=["new"])

@router.get("/")
async def endpoint():
    return {"message": "Hello"}
```

在 `main.py` 中注册路由:

```python
from routes import new
app.include_router(new.router)
```

### 添加新模板

在 `templates/` 目录下创建 HTML 文件,继承 `base.html`:

```html
{% extends "base.html" %}
{% block content %}
    <!-- Your content -->
{% endblock %}
```

### 添加 Web Component

在 `static/js/components/` 创建新的组件:

```javascript
import { LitElement, html } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

class MyComponent extends LitElement {
    createRenderRoot() {
        return this;
    }
    
    render() {
        return html`<div>Hello World</div>`;
    }
}

customElements.define('my-component', MyComponent);
```

## 许可证

MIT License
