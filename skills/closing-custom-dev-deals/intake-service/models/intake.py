"""业务信息收集表的数据模型。"""

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Submission(Base):
    """一次提交。岗位和场景条数不定，存 JSON；要筛要统计的几列单独落字段。"""

    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    company: Mapped[str] = mapped_column(String(200), index=True)
    city: Mapped[str] = mapped_column(String(100), default="")
    business: Mapped[str] = mapped_column(Text, default="")
    industry: Mapped[str] = mapped_column(String(50), default="", index=True)
    headcount: Mapped[str] = mapped_column(String(50), default="")
    roles: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    scenes: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "company": self.company,
            "city": self.city,
            "business": self.business,
            "industry": self.industry,
            "headcount": self.headcount,
            "roles": self.roles or [],
            "scenes": self.scenes or [],
        }


class RoleIn(BaseModel):
    name: str = ""
    flow: str = ""


class SceneIn(BaseModel):
    name: str = ""
    now: str = ""
    want: str = ""


class SubmissionIn(BaseModel):
    """只有公司名称必填。其余留空是有效信息 —— 空着的地方当面问。"""

    company: str = Field(min_length=1, max_length=200)
    city: str = ""
    business: str = ""
    industry: str = ""
    headcount: str = ""
    roles: list[RoleIn] = Field(default_factory=list)
    scenes: list[SceneIn] = Field(default_factory=list)

    @field_validator("company")
    @classmethod
    def company_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("公司名称不能为空")
        return cleaned

    @field_validator("roles", "scenes")
    @classmethod
    def drop_empty_entries(cls, entries: list[Any]) -> list[Any]:
        """客户加了卡又没填，别把空卡存进去。"""
        return [e for e in entries if any(str(v).strip() for v in e.model_dump().values())]
