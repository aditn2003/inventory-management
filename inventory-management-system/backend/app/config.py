from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # utf-8-sig: Windows editors often save .env with BOM; without this, the first key may not load.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", extra="ignore")

    # Database
    database_url: str
    database_url_sync: str = ""

    # Redis
    redis_url: str

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Application
    seed_on_startup: bool = False
    cors_origins: str = "http://localhost"
    environment: Literal["development", "production", "test"] = "development"
    # Public URL of the SPA (for invite links in emails), no trailing slash
    public_app_url: str = "http://localhost"
    # Resend (https://resend.com) — invitation emails
    resend_api_key: str = ""
    resend_from_email: str = "IMS <onboarding@resend.dev>"
    invite_expire_hours: int = 168  # 7 days

    # Google OAuth 2.0 (Sign in with Google) — leave client id/secret empty to disable
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    # Registered redirect URI in Google Cloud Console; if empty, uses PUBLIC_APP_URL + /api/v1/auth/google/callback
    google_oauth_redirect_uri: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_oauth_redirect_uri_resolved(self) -> str:
        if self.google_oauth_redirect_uri.strip():
            return self.google_oauth_redirect_uri.strip().rstrip("/")
        base = self.public_app_url.rstrip("/")
        return f"{base}/api/v1/auth/google/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()
