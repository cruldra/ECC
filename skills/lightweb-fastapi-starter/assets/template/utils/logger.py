"""
Utility functions and helpers for {{project_name}}.
"""

from loguru import logger
import sys
from pathlib import Path


def setup_logger():
    """Configure loguru logger."""
    # Remove default handler
    logger.remove()
    
    # Add console handler
    logger.add(
        sys.stdout,
        level="INFO",
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    
    # Add file handler
    log_path = Path("./logs/app.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    logger.add(
        str(log_path),
        rotation="10 MB",
        retention="30 days",
        level="DEBUG",
        encoding="utf-8"
    )
