from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.config import get_settings
from app.database import fetch_one

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

ALGORITHM = "HS256"
ALLOWED_ROLES = {"admin", "user", "viewer"}


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    role: str


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from exc


def _get_user_by_email(email: str) -> dict | None:
    return fetch_one(
        """
        SELECT id, email, password_hash, role
        FROM users
        WHERE email = %s AND deleted_at IS NULL
        """,
        (email.lower(),),
    )


def _get_user_by_id(user_id: str) -> dict | None:
    return fetch_one(
        """
        SELECT id, email, role
        FROM users
        WHERE id = %s AND deleted_at IS NULL
        """,
        (user_id,),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user = _get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return {
        "user_id": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister):
    role = user.role if user.role in ALLOWED_ROLES else "user"
    if role != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the default user role can be assigned during registration",
        )

    email = user.email.lower()
    if _get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    hashed_password = hash_password(user.password)
    created_user = fetch_one(
        """
        INSERT INTO users (email, password_hash, role)
        VALUES (%s, %s, %s)
        RETURNING id, email, role
        """,
        (email, hashed_password, role),
    )
    if not created_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    user_id = str(created_user["id"])
    access_token = create_access_token(
        {
            "sub": created_user["email"],
            "user_id": user_id,
            "role": created_user["role"],
        }
    )

    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        email=created_user["email"],
        role=created_user["role"],
    )


@router.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    email = user.email.lower()
    existing_user = _get_user_by_email(email)
    if not existing_user or not verify_password(user.password, existing_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(existing_user["id"])
    access_token = create_access_token(
        {
            "sub": existing_user["email"],
            "user_id": user_id,
            "role": existing_user["role"],
        }
    )

    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        email=existing_user["email"],
        role=existing_user["role"],
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        role=current_user["role"],
    )