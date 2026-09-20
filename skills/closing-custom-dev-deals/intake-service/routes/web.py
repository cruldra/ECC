"""页面路由：客户填的表，和内部看提交的列表。"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import require_admin
from db import get_session
from models.intake import Submission

router = APIRouter(tags=["web"])


def templates(request: Request):
    return request.app.state.templates


@router.get("/", response_class=HTMLResponse)
async def form_page(request: Request):
    return templates(request).TemplateResponse(request, "form.html", {})


@router.get("/admin", response_class=HTMLResponse)
async def admin_list(request: Request, session: Session = Depends(get_session), _: str = Depends(require_admin)):
    rows = session.scalars(select(Submission).order_by(Submission.created_at.desc())).all()
    return templates(request).TemplateResponse(
        request, "admin.html", {"rows": [row.as_dict() for row in rows]}
    )


@router.get("/admin/{submission_id}", response_class=HTMLResponse)
async def admin_detail(
    request: Request,
    submission_id: int,
    session: Session = Depends(get_session),
    _: str = Depends(require_admin),
):
    row = session.get(Submission, submission_id)
    if row is None:
        raise HTTPException(status_code=404, detail="没有这份提交")
    return templates(request).TemplateResponse(
        request, "detail.html", {"row": row.as_dict()}
    )
