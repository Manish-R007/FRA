from datetime import datetime, timedelta, timezone
from typing import Optional, List
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.user import User
    
    # 1. Fallback for unauthenticated public demo access
    if not token or token in ["null", "undefined"]:
        admin_user = db.query(User).filter(User.role == "ADMIN").first()
        if admin_user:
            return admin_user
        first_user = db.query(User).first()
        if first_user:
            return first_user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    # 2. Handle 1-click role tokens from frontend switcher
    if token.startswith("role-token-") or token == "demo-token":
        role_req = token.replace("role-token-", "").upper()
        if "ODISHA" in role_req:
            user = db.query(User).filter(User.role == "STATE_OFFICER", User.state == "Odisha").first()
            if user:
                return user
        elif "MP" in role_req or "MADHYA" in role_req:
            user = db.query(User).filter(User.role == "STATE_OFFICER", User.state == "Madhya Pradesh").first()
            if user:
                return user
        elif "KARNATAKA" in role_req:
            user = db.query(User).filter(User.role == "STATE_OFFICER", User.state == "Karnataka").first()
            if user:
                return user
        elif "TELANGANA" in role_req or "TG" in role_req:
            user = db.query(User).filter(User.role == "STATE_OFFICER", User.state == "Telangana").first()
            if user:
                return user
        elif role_req == "STATE_OFFICER":
            user = db.query(User).filter(User.role == "STATE_OFFICER", User.state == "Odisha").first()
            if user:
                return user
        elif role_req == "CITIZEN":
            user = db.query(User).filter(User.role == "CITIZEN").first()
            if user:
                return user
        elif role_req in ["ADMIN", "DEMO-TOKEN"]:
            user = db.query(User).filter(User.role == "ADMIN").first()
            if user:
                return user
        role_user = db.query(User).filter(User.role == role_req).first()
        if role_user:
            return role_user
        admin_user = db.query(User).filter(User.role == "ADMIN").first()
        if admin_user:
            return admin_user

    # 3. Decode signed JWT token
    try:
        payload = decode_token(token)
        email: str = payload.get("sub")
        if email:
            user = db.query(User).filter(User.email == email).first()
            if user and user.is_active:
                return user
    except Exception:
        pass

    # Default fallback to Admin in development/demo mode
    admin_user = db.query(User).filter(User.role == "ADMIN").first()
    if admin_user:
        return admin_user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {allowed_roles}, your role: {current_user.role}",
            )
        return current_user
    return role_checker
