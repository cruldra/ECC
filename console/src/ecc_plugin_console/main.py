from __future__ import annotations

from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

from .catalog import load_catalog
from .editor import load_skill, save_original, translate_skill
from .harness import load_status, mutate

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


def _skill_or_http(skill_id: str) -> dict:
    try:
        return load_skill(skill_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="找不到 skill") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@app.get("/api/skills/{skill_id}")
def get_skill(skill_id: str):
    return _skill_or_http(skill_id)


@app.put("/api/skills/{skill_id}")
def put_skill(skill_id: str, payload: dict = Body(...)):
    text = payload.get("text")
    if not isinstance(text, str):
        raise HTTPException(status_code=400, detail="缺少 text")
    try:
        return save_original(skill_id, text)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="找不到 skill") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@app.post("/api/skills/{skill_id}/translate")
def post_translate(skill_id: str, payload: dict = Body(default={})):
    locale = payload.get("locale") or "zh-CN"
    force = bool(payload.get("force"))
    try:
        result = translate_skill(skill_id, locale=locale, force=force)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="找不到 skill") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("stderr") or "翻译失败")
    return result


def main() -> None:
    uvicorn.run("ecc_plugin_console.main:app", host="127.0.0.1", port=8765, reload=False)
