from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = Field(min_length=1, max_length=255)


class UserResponse(BaseModel):
    """Session user profile — email omitted for display/privacy; use name in UI."""

    id: UUID
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RefreshRequest(BaseModel):
    refresh_token: str


class GoogleOAuthCompleteRequest(BaseModel):
    """One-time code issued after Google redirect (stored in Redis), not Google's authorization code."""

    code: str = Field(min_length=10, max_length=256)


class GoogleOAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str


class InvitePreviewResponse(BaseModel):
    """Email tied to the invitation (for form display)."""

    email: str


class RegisterWithInviteRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
