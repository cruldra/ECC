"""
Request and response models for {{project_name}} API.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="App version")
    timestamp: datetime = Field(..., description="Check time")
    services: dict = Field(default={}, description="Service status")


class UploadResponse(BaseModel):
    """Response model for file upload."""
    success: bool = Field(..., description="Upload success")
    message: str = Field(..., description="Response message")
    file_count: int = Field(..., description="Number of files")
    processed_files: List[str] = Field(default=[], description="Processed files")
    failed_files: List[str] = Field(default=[], description="Failed files")


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(default=None, description="Error details")
