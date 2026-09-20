"""业务信息收集表的接口。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import require_admin
from db import get_session
from models.intake import Submission, SubmissionIn

router = APIRouter(prefix="/api", tags=["api"])


@router.post("/submissions", status_code=201)
async def create_submission(payload: SubmissionIn, session: Session = Depends(get_session)) -> dict:
    row = Submission(
        company=payload.company,
        city=payload.city.strip(),
        business=payload.business.strip(),
        industry=payload.industry,
        headcount=payload.headcount,
        roles=[role.model_dump() for role in payload.roles],
        scenes=[scene.model_dump() for scene in payload.scenes],
    )
    session.add(row)
    session.commit()
    return {"id": row.id}


@router.get("/submissions")
async def list_submissions(
    session: Session = Depends(get_session), _: str = Depends(require_admin)
) -> list[dict]:
    rows = session.scalars(select(Submission).order_by(Submission.created_at.desc())).all()
    return [row.as_dict() for row in rows]


@router.get("/submissions/{submission_id}")
async def read_submission(
    submission_id: int, session: Session = Depends(get_session), _: str = Depends(require_admin)
) -> dict:
    row = session.get(Submission, submission_id)
    if row is None:
        raise HTTPException(status_code=404, detail="没有这份提交")
    return row.as_dict()
