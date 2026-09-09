from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

from .catalog import load_catalog
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


def main() -> None:
    uvicorn.run("ecc_plugin_console.main:app", host="127.0.0.1", port=8765, reload=False)
