import json
import secrets
from typing import Annotated
from urllib.parse import urlencode
from uuid import UUID

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_redis
from app.auth.models import User
from app.auth.repository import UserRepository
from app.auth.invite_repository import UserInviteRepository, hash_invite_token
from app.auth.oauth_google import build_authorize_url, exchange_code_for_tokens, fetch_userinfo
from app.auth.schemas import (
    GoogleOAuthCompleteRequest,
    GoogleOAuthTokenResponse,
    InvitePreviewResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterWithInviteRequest,
    UserResponse,
)
from app.auth.service import AuthService
from app.config import get_settings
from app.database import get_db
from app.tenants.schemas import TenantResponse
from app.tenants.service import TenantService

router = APIRouter()

OAUTH_STATE_KEY = "oauth_google_state:{state}"
OAUTH_COMPLETE_KEY = "oauth_google_complete:{code}"
OAUTH_STATE_TTL_SEC = 600
OAUTH_COMPLETE_TTL_SEC = 120


def _frontend_oauth_redirect(query: dict[str, str]) -> RedirectResponse:
    settings = get_settings()
    base = settings.public_app_url.rstrip("/")
    return RedirectResponse(url=f"{base}/auth/oauth-callback?{urlencode(query)}", status_code=302)


@router.get("/google/status")
async def google_oauth_status() -> dict:
    s = get_settings()
    enabled = bool(s.google_oauth_client_id.strip() and s.google_oauth_client_secret.strip())
    return {"enabled": enabled}


@router.get("/google/start")
async def google_oauth_start(
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
    invite_token: str | None = Query(None, min_length=20, max_length=2048),
) -> RedirectResponse:
    settings = get_settings()
    if not settings.google_oauth_client_id.strip() or not settings.google_oauth_client_secret.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )

    if invite_token:
        inv_repo = UserInviteRepository(session)
        inv = await inv_repo.get_valid_by_token_hash(hash_invite_token(invite_token))
        if not inv:
            base = settings.public_app_url.rstrip("/")
            return RedirectResponse(
                url=f"{base}/register/invite?{urlencode({'token': invite_token, 'invite_oauth_error': 'invalid_invite'})}",
                status_code=302,
            )
        state_payload: dict = {"flow": "invite", "invite_token": invite_token}
    else:
        state_payload = {"flow": "login"}

    state = secrets.token_urlsafe(32)
    await redis_client.setex(
        OAUTH_STATE_KEY.format(state=state),
        OAUTH_STATE_TTL_SEC,
        json.dumps(state_payload),
    )
    url = build_authorize_url(
        client_id=settings.google_oauth_client_id.strip(),
        redirect_uri=settings.google_oauth_redirect_uri_resolved,
        state=state,
    )
    return RedirectResponse(url=url, status_code=302)


@router.get("/google/callback")
async def google_oauth_callback(
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
) -> RedirectResponse:
    settings = get_settings()
    if error:
        return _frontend_oauth_redirect({"oauth_error": error or "access_denied"})
    if not code or not state:
        return _frontend_oauth_redirect({"oauth_error": "missing_code_or_state"})

    raw_state = await redis_client.get(OAUTH_STATE_KEY.format(state=state))
    if not raw_state:
        return _frontend_oauth_redirect({"oauth_error": "invalid_or_expired_state"})
    await redis_client.delete(OAUTH_STATE_KEY.format(state=state))

    try:
        state_payload = json.loads(raw_state)
    except json.JSONDecodeError:
        return _frontend_oauth_redirect({"oauth_error": "invalid_or_expired_state"})

    flow = state_payload.get("flow") or "login"

    try:
        token_payload = await exchange_code_for_tokens(
            client_id=settings.google_oauth_client_id.strip(),
            client_secret=settings.google_oauth_client_secret.strip(),
            redirect_uri=settings.google_oauth_redirect_uri_resolved,
            code=code,
        )
        google_access = token_payload.get("access_token")
        if not google_access:
            return _frontend_oauth_redirect({"oauth_error": "no_access_token"})
        info = await fetch_userinfo(access_token=google_access)
    except (httpx.HTTPError, ValueError, KeyError):
        return _frontend_oauth_redirect({"oauth_error": "google_token_exchange_failed"})

    if not info.get("email_verified"):
        return _frontend_oauth_redirect({"oauth_error": "email_not_verified"})

    google_sub = info.get("sub")
    email = info.get("email")
    if not google_sub or not email:
        return _frontend_oauth_redirect({"oauth_error": "incomplete_profile"})

    name = str(info.get("name") or "")

    svc = AuthService(session, redis_client)
    try:
        if flow == "invite":
            invite_token = state_payload.get("invite_token")
            if not invite_token:
                return _frontend_oauth_redirect({"oauth_error": "missing_invite"})
            inv_repo = UserInviteRepository(session)
            inv = await inv_repo.get_valid_by_token_hash(hash_invite_token(invite_token))
            if not inv:
                return _frontend_oauth_redirect({"oauth_error": "invalid_invite"})
            user = await svc.process_google_oauth_invite(google_sub, email, name, inv)
        else:
            user = await svc.process_google_oauth_login(google_sub, email, name)
    except ValueError as exc:
        return _frontend_oauth_redirect({"oauth_error": str(exc)})

    complete_code = secrets.token_urlsafe(32)
    await redis_client.setex(
        OAUTH_COMPLETE_KEY.format(code=complete_code),
        OAUTH_COMPLETE_TTL_SEC,
        str(user.id),
    )
    return _frontend_oauth_redirect({"code": complete_code})


@router.post("/google/complete", response_model=GoogleOAuthTokenResponse)
async def google_oauth_complete(
    body: GoogleOAuthCompleteRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
) -> GoogleOAuthTokenResponse:
    key = OAUTH_COMPLETE_KEY.format(code=body.code)
    user_id_str = await redis_client.get(key)
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired sign-in code.")
    await redis_client.delete(key)

    repo = UserRepository(session)
    user = await repo.get_by_id(UUID(user_id_str))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    svc = AuthService(session, redis_client)
    access_token, refresh_token = svc.issue_token_pair(user)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return GoogleOAuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
) -> User:
    svc = AuthService(session, redis_client)
    try:
        user = await svc.register(body.email, body.password, body.name.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return user


@router.get("/invite/preview", response_model=InvitePreviewResponse)
async def invite_preview(
    session: Annotated[AsyncSession, Depends(get_db)],
    token: str = Query(..., min_length=20),
) -> InvitePreviewResponse:
    inv_repo = UserInviteRepository(session)
    inv = await inv_repo.get_valid_by_token_hash(hash_invite_token(token))
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation.",
        )
    return InvitePreviewResponse(email=inv.email)


@router.post("/register-invite", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_with_invite(
    body: RegisterWithInviteRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
) -> User:
    svc = AuthService(session, redis_client)
    try:
        return await svc.register_with_invite(body.token, body.name, body.password)
    except ValueError as exc:
        detail = str(exc)
        if "already registered" in detail.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
) -> dict:
    svc = AuthService(session, redis_client)
    try:
        access_token, refresh_token = await svc.login(body.email, body.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # set True in production with HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh")
async def refresh(
    body: RefreshRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
) -> dict:
    svc = AuthService(session, redis_client)
    try:
        access_token, new_refresh = await svc.refresh(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[aioredis.Redis, Depends(get_redis)],
) -> None:
    svc = AuthService(session, redis_client)
    await svc.logout(body.refresh_token)
    response.delete_cookie("refresh_token")


@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


@router.get("/me/accessible-tenants", response_model=list[TenantResponse])
async def list_accessible_tenants(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=100),
) -> list[TenantResponse]:
    """Tenants the current user may work in (for X-Tenant-Id / UI selector). Not the admin tenants API."""
    svc = TenantService(session)
    if current_user.role == "admin":
        accessible_ids = None
    else:
        repo = UserRepository(session)
        assigned = await repo.get_assigned_tenant_ids(current_user.id)
        accessible_ids = assigned if assigned else None
    result = await svc.list_tenants(accessible_ids, page, page_size, None)
    return result["data"]
