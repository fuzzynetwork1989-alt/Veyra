from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import bcrypt
import jwt
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SECRET_KEY = "veyra-secret-change-this"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

class UserRegister(BaseModel):
    email: str
    password: str
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    return payload

@router.post("/register", response_model=TokenResponse)
async def register(user: UserRegister):
    # Placeholder implementation - in production, store user in database
    hashed_password = hash_password(user.password)
    user_id = "placeholder-user-id"
    
    access_token = create_access_token({
        "sub": user.email,
        "user_id": user_id,
        "role": user.role
    })
    
    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        email=user.email,
        role=user.role
    )

@router.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    # Placeholder implementation - in production, verify against database
    user_id = "placeholder-user-id"
    role = "user"
    
    access_token = create_access_token({
        "sub": user.email,
        "user_id": user_id,
        "role": role
    })
    
    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        email=user.email,
        role=role
    )

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user.get("user_id"),
        "email": current_user.get("sub"),
        "role": current_user.get("role")
    }
