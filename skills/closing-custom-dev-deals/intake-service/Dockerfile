FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

RUN pip install --no-cache-dir uv

# 只装依赖，不把本项目当包装 —— 它是一个应用，不是库，
# hatchling 那套 packages 声明在容器里跑不通，也没有必要。
COPY pyproject.toml uv.lock ./
RUN uv venv /app/.venv && uv sync --frozen --no-install-project --no-dev

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
