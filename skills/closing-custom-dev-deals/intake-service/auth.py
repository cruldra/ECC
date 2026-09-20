"""/admin 和读取接口的门。提交接口对客户开放，读取只给我们自己。"""

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from config import get_settings

basic = HTTPBasic()


def require_admin(credentials: HTTPBasicCredentials = Depends(basic)) -> str:
    """
    用 compare_digest 比对，避免按字符早退泄露长度和前缀。

    密码只从环境变量来 —— 这个仓库是公开的，不能写死在代码里。
    没设密码就把后台整个关掉：失败要往锁死的方向倒，不能默认敞开。
    """
    settings = get_settings()
    if not settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="后台未启用：请在 .env 里设置 ADMIN_PASSWORD 后重启。",
        )
    user_ok = secrets.compare_digest(credentials.username, settings.admin_user)
    password_ok = secrets.compare_digest(credentials.password, settings.admin_password)
    if not (user_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不对",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
