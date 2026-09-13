"""
API routes for {{project_name}}.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from loguru import logger

from config import get_settings
from models.requests import HealthResponse, UploadResponse

# Create router
router = APIRouter(prefix="/api", tags=["api"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    settings = get_settings()
    
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.now(),
        services={"storage": "healthy"}
    )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    upload_type: str = Form(...)
):
    """
    Upload a file
    """
    settings = get_settings()
    
    return UploadResponse(
        success=True,
        message=f"File {file.filename} uploaded successfully",
        file_count=1,
        processed_files=[file.filename] if file.filename else [],
        failed_files=[]
    )
