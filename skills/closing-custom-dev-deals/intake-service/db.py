"""SQLite 连接与建表。数据量按「一年几十份提交」算，SQLite 足够。"""

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import get_settings
from models.intake import Base

_settings = get_settings()
_db_path = Path(_settings.storage_path) / "intake.db"
engine = create_engine(f"sqlite:///{_db_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    Path(_settings.storage_path).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
