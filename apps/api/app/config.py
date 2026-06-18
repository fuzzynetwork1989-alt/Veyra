from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra"
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "veyra-secret-change-this"
    jwt_expires_minutes: int = 60
    refresh_token_days: int = 30
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/oauth/google"
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:3000/oauth/github"
    migrations_dir: str = "../../migrations"
    openai_api_key: str = "lm-studio"
    openai_base_url: str = "http://127.0.0.1:1234/v1"
    openai_model: str = ""
    openai_embedding_model: str = ""
    embedding_dimensions: int = 768
    llm_timeout_seconds: int = 600
    daily_token_quota: int = 100_000
    daily_chat_quota: int = 500
    daily_task_quota: int = 100
    mock_llm: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()