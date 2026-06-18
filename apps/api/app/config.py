from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra"
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "veyra-secret-change-this"
    jwt_expires_minutes: int = 60 * 24 * 7
    migrations_dir: str = "../../migrations"
    openai_api_key: str = "lm-studio"
    openai_base_url: str = "http://127.0.0.1:1234/v1"
    openai_model: str = ""
    llm_timeout_seconds: int = 600


@lru_cache
def get_settings() -> Settings:
    return Settings()