import hashlib
import secrets
from datetime import datetime, timedelta

from app.config import get_settings
from app.database import execute, fetch_one


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_refresh_token(user_id: str) -> str:
    settings = get_settings()
    plain = secrets.token_urlsafe(48)
    token_hash = _hash_token(plain)
    expires_at = datetime.utcnow() + timedelta(days=settings.refresh_token_days)
    execute(
        """
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (user_id, token_hash, expires_at),
    )
    return plain


def verify_refresh_token(token: str) -> dict | None:
    token_hash = _hash_token(token)
    row = fetch_one(
        """
        SELECT rt.user_id, u.email, u.role
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = %s
          AND rt.revoked_at IS NULL
          AND rt.expires_at > CURRENT_TIMESTAMP
          AND u.deleted_at IS NULL
        """,
        (token_hash,),
    )
    if not row:
        return None
    return {
        "user_id": str(row["user_id"]),
        "email": row["email"],
        "role": row["role"],
    }


def revoke_refresh_token(token: str) -> None:
    token_hash = _hash_token(token)
    execute(
        """
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = %s AND revoked_at IS NULL
        """,
        (token_hash,),
    )


def rotate_refresh_token(old_token: str, user_id: str) -> str:
    revoke_refresh_token(old_token)
    return issue_refresh_token(user_id)