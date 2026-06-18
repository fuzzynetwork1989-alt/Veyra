import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.auth_tokens import issue_refresh_token, revoke_refresh_token, rotate_refresh_token, verify_refresh_token
from app.config import get_settings
from app.database import execute, fetch_one
from app.projects_service import create_default_project
router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

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
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class OAuthCodeRequest(BaseModel):
    code: str


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
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from exc


def _token_response(user: dict) -> TokenResponse:
    user_id = str(user["id"]) if "id" in user else user["user_id"]
    email = user["email"]
    role = user["role"]
    access_token = create_access_token({"sub": email, "user_id": user_id, "role": role})
    refresh_token = issue_refresh_token(user_id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        email=email,
        role=role,
    )


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

    create_default_project(str(created_user["id"]))
    return _token_response(created_user)


@router.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    email = user.email.lower()
    existing_user = _get_user_by_email(email)
    if not existing_user or not verify_password(user.password, existing_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return _token_response(existing_user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(request: RefreshRequest):
    user = verify_refresh_token(request.refresh_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_refresh = rotate_refresh_token(request.refresh_token, user["user_id"])
    access_token = create_access_token(
        {"sub": user["email"], "user_id": user["user_id"], "role": user["role"]}
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user_id=user["user_id"],
        email=user["email"],
        role=user["role"],
    )


@router.post("/logout")
async def logout(request: LogoutRequest):
    revoke_refresh_token(request.refresh_token)
    return {"status": "ok"}


@router.get("/oauth/providers")
async def oauth_providers():
    settings = get_settings()
    providers = []
    if settings.google_client_id and settings.google_client_secret:
        providers.append("google")
    if settings.github_client_id and settings.github_client_secret:
        providers.append("github")
    return {"providers": providers}


@router.get("/oauth/google/url")
async def google_oauth_url():
    settings = get_settings()
    if not settings.google_client_id or not settings.google_redirect_uri:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth not configured")
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
            "state": secrets.token_urlsafe(16),
        }
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.post("/oauth/google", response_model=TokenResponse)
async def google_oauth_callback(request: OAuthCodeRequest):
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret or not settings.google_redirect_uri:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth not configured")

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": request.code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth token exchange failed")
        tokens = token_res.json()
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        user_res.raise_for_status()
        profile = user_res.json()

    email = (profile.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account has no email")

    existing = _get_user_by_email(email)
    if not existing:
        random_password = secrets.token_urlsafe(32)
        existing = fetch_one(
            """
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, 'user')
            RETURNING id, email, role
            """,
            (email, hash_password(random_password)),
        )
        create_default_project(str(existing["id"]))

    return _token_response(existing)


@router.get("/oauth/github/url")
async def github_oauth_url():
    settings = get_settings()
    if not settings.github_client_id or not settings.github_redirect_uri:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="GitHub OAuth not configured")
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "read:user user:email",
            "state": secrets.token_urlsafe(16),
        }
    )
    return {"url": f"https://github.com/login/oauth/authorize?{params}"}


@router.post("/oauth/github", response_model=TokenResponse)
async def github_oauth_callback(request: OAuthCodeRequest):
    settings = get_settings()
    if not settings.github_client_id or not settings.github_client_secret or not settings.github_redirect_uri:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="GitHub OAuth not configured")

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": request.code,
                "redirect_uri": settings.github_redirect_uri,
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth token exchange failed")
        access = token_res.json().get("access_token")
        if not access:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth token missing")

        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access}", "Accept": "application/json"},
        )
        user_res.raise_for_status()
        profile = user_res.json()
        email = profile.get("email")
        if not email:
            emails_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access}", "Accept": "application/json"},
            )
            emails_res.raise_for_status()
            emails = emails_res.json()
            primary = next((e for e in emails if e.get("primary")), emails[0] if emails else None)
            email = primary.get("email") if primary else None

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub account has no public email")

    email = email.lower()
    existing = _get_user_by_email(email)
    if not existing:
        random_password = secrets.token_urlsafe(32)
        existing = fetch_one(
            """
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, 'user')
            RETURNING id, email, role
            """,
            (email, hash_password(random_password)),
        )
        create_default_project(str(existing["id"]))

    return _token_response(existing)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        role=current_user["role"],
    )