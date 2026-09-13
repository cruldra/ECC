from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Request, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from config import get_settings
from routes import web, api
from utils.logger import setup_logger
from utils.errors import AppError, handle_error


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    setup_logger()
    logger.info(f"Starting {{project_name}}...")
    
    # Initialize storage directories
    settings = get_settings()
    Path(settings.storage_path).mkdir(parents=True, exist_ok=True)
    
    logger.info("Application startup complete")
    
    yield
    
    logger.info("Shutting down {{project_name}}...")
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="{{project_description}}",
        lifespan=lifespan
    )
    
    # Add global exception handlers
    @app.exception_handler(AppError)
    async def app_exception_handler(request: Request, exc: AppError):
        """Handle custom application exceptions"""
        error_details = handle_error(exc)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_details
        )
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions"""
        error_details = handle_error(exc)
        return JSONResponse(
            status_code=500,
            content=error_details
        )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else ["http://localhost:8000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Get the base directory
    base_dir = Path(__file__).parent
    
    # Set up static and templates directories
    static_dir = base_dir / "static"
    templates_dir = base_dir / "templates"
    
    # Ensure directories exist
    static_dir.mkdir(exist_ok=True)
    templates_dir.mkdir(exist_ok=True)
    
    # Mount static files
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    
    # Set up templates
    templates = Jinja2Templates(directory=str(templates_dir))
    app.state.templates = templates
    
    # Include routers
    app.include_router(web.router)
    app.include_router(api.router)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "version": settings.app_version
        }
    
    return app


# Create the application instance
app = create_app()

if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
