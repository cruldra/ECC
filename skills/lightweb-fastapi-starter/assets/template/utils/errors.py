"""
Custom exceptions and error handling for {{project_name}}.
"""

from typing import Optional, Dict, Any
from datetime import datetime


class AppError(Exception):
    """Base application error."""
    
    def __init__(
        self,
        message: str,
        error_type: str = "app_error",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        suggested_actions: Optional[list] = None
    ):
        self.message = message
        self.error_type = error_type
        self.status_code = status_code
        self.details = details or {}
        self.suggested_actions = suggested_actions or []
        self.timestamp = datetime.now().isoformat()
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary."""
        return {
            "error": {
                "type": self.error_type,
                "message": self.message,
                "details": self.details,
                "suggested_actions": self.suggested_actions,
                "timestamp": self.timestamp
            }
        }


def handle_error(exc: Exception) -> Dict[str, Any]:
    """Handle exception and return error details."""
    if isinstance(exc, AppError):
        return exc.to_dict()
    
    return {
        "error": {
            "type": "internal_error",
            "message": "An internal error occurred",
            "details": {"original_error": str(exc)},
            "suggested_actions": ["Please try again later", "Contact support if the problem persists"],
            "timestamp": datetime.now().isoformat()
        }
    }
