from __future__ import annotations

from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

from .catalog import load_catalog
from .editor import load_item, save_item, translate_item
from .harness import load_status, mutate
from . import mcpctl

HERE = Path(__file__).resolve().parent
app = FastAPI(title="ECC 插件控制台")
app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
templates = Jinja2Templates(directory=str(HERE / "templates"))


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/api/catalog")
def catalog():
    return load_catalog()


@app.get("/api/status")
def status():
    return load_status()


@app.post("/api/harness/{name}/{action}")
def harness_action(name: str, action: str):
    if name not in {"claude", "codex"} or action not in {"install", "uninstall", "update"}:
        raise HTTPException(status_code=400, detail="坏请求")
    return mutate(name, action)


@app.get("/api/mcp")
def mcp_snapshot():
    return mcpctl.snapshot()


@app.post("/api/mcp/{server_id}/{action}")
def mcp_action(server_id: str, action: str):
    try:
        return mcpctl.mutate(server_id, action)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


KIND_PATH = {"skills": "skill", "commands": "command"}


def _kind_or_http(bucket: str) -> str:
    kind = KIND_PATH.get(bucket)
    if kind is None:
        raise HTTPException(status_code=404, detail="未知类型")
    return kind


def _load_or_http(kind: str, item_id: str) -> dict:
    try:
        return load_item(kind, item_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"找不到 {kind}") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@app.get("/api/{bucket}/{item_id}")
def get_item(bucket: str, item_id: str):
    return _load_or_http(_kind_or_http(bucket), item_id)


@app.put("/api/{bucket}/{item_id}")
def put_item(bucket: str, item_id: str, payload: dict = Body(...)):
    kind = _kind_or_http(bucket)
    text = payload.get("text")
    if not isinstance(text, str):
        raise HTTPException(status_code=400, detail="缺少 text")
    try:
        return save_item(kind, item_id, text)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"找不到 {kind}") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@app.post("/api/{bucket}/{item_id}/translate")
def post_translate(bucket: str, item_id: str, payload: dict = Body(default={})):
    kind = _kind_or_http(bucket)
    locale = payload.get("locale") or "zh-CN"
    force = bool(payload.get("force"))
    try:
        result = translate_item(kind, item_id, locale=locale, force=force)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"找不到 {kind}") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("stderr") or "翻译失败")
    return result


def main() -> None:
    uvicorn.run("ecc_plugin_console.main:app", host="127.0.0.1", port=8765, reload=False)
