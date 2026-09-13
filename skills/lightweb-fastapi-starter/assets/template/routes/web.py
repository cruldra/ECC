"""
Web interface routes for {{project_name}}.
"""

from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from config import get_settings

# Create router
router = APIRouter(tags=["web"])


def get_templates() -> Jinja2Templates:
    """Get Jinja2 templates instance."""
    return Jinja2Templates(directory="templates")


@router.get("/", response_class=HTMLResponse)
async def home(request: Request, templates: Jinja2Templates = Depends(get_templates)):
    """
    主页 - 应用中心
    """
    settings = get_settings()
    
    context = {
        "request": request,
        "app_name": settings.app_name,
        "app_version": settings.app_version,
    }
    
    return templates.TemplateResponse("index.html", context)
