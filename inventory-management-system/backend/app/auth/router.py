from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_redis
from app.auth.models import User
from app.auth.invite_repository import UserInviteRepository, hash_invite_token
from app.auth.schemas import (
    InvitePreviewResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterWithInviteRequest,
    TokenResponse,
    UserResponse,
)
from app.auth.service import AuthService
from app.database import get_db

router = APIRouter()


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
