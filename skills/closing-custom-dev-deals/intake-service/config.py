"""
Configuration management for client-intake.
"""

from pathlib import Path
from typing import List, Optional

from pydantic import field_validator, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application Configuration
    app_name: str = "client-intake"
    app_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Storage Configuration
    storage_path: str = "./storage"
    max_file_size_mb: int = 50
    allowed_file_types: str = "txt,md,json,yaml,yml"
    
    # Security Configuration
    secret_key: str = "your-secret-key-change-in-production"
    session_timeout_hours: int = 24

    # /admin 的 HTTP Basic。密码只从环境变量来，仓库是公开的，不能写死在代码里。
    # 没设密码就把 /admin 关掉 —— 失败要往锁死的方向倒，不能默认敞开。
    admin_user: str = "admin"
    admin_password: str = ""
    
    # Logging Configuration
    log_level: str = "INFO"
    log_file: str = "./logs/app.log"
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"
    )
    
    @field_validator("allowed_file_types")
    @classmethod
    def parse_allowed_file_types(cls, v: str) -> List[str]:
        """Parse comma-separated file types into a list."""
        return [ext.strip().lower() for ext in v.split(",")]
    
    @field_validator("storage_path")
    @classmethod
    def create_directories(cls, v: str) -> str:
        """Ensure directories exist."""
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return str(path)
    
    @field_validator("log_file")
    @classmethod
    def create_log_directory(cls, v: str) -> str:
        """Ensure log directory exists."""
        log_path = Path(v)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        return str(v)
    
    @property
    def max_file_size_bytes(self) -> int:
        """Convert max file size from MB to bytes."""
        return self.max_file_size_mb * 1024 * 1024


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the application settings."""
    return settings
