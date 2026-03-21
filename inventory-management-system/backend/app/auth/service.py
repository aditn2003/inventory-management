from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import redis.asyncio as aioredis
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.repository import UserRepository
from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

BLACKLIST_PREFIX = "blacklist:"
ATTEMPT_PREFIX = "login_attempts:"
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300  # 5 minutes


class AuthService:
    def __init__(self, session: AsyncSession, redis_client: aioredis.Redis) -> None:
        self.session = session
        self.redis = redis_client
        self.repo = UserRepository(session)

    # ── Passwords ──────────────────────────────────────────────────────────

    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    def hash_password(self, plain: str) -> str:
        return pwd_context.hash(plain)

    # ── Tokens ─────────────────────────────────────────────────────────────

    def create_access_token(self, user_id: UUID, role: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
        payload = {"sub": str(user_id), "role": role, "exp": expire, "type": "access"}
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    def create_refresh_token(self, user_id: UUID) -> str:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    def decode_token(self, token: str) -> dict:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

    # ── Redis blacklist ────────────────────────────────────────────────────

    async def blacklist_token(self, token: str) -> None:
        try:
            payload = self.decode_token(token)
            exp = payload.get("exp", 0)
            ttl = max(0, int(exp - datetime.now(timezone.utc).timestamp()))
            await self.redis.setex(f"{BLACKLIST_PREFIX}{token}", ttl, "1")
        except JWTError:
            pass

    async def is_blacklisted(self, token: str) -> bool:
        return await self.redis.exists(f"{BLACKLIST_PREFIX}{token}") == 1

    # ── Rate limiting ──────────────────────────────────────────────────────

    async def check_rate_limit(self, email: str) -> None:
        key = f"{ATTEMPT_PREFIX}{email}"
        attempts = await self.redis.get(key)
        if attempts and int(attempts) >= MAX_ATTEMPTS:
            raise ValueError("Too many login attempts. Please try again in 5 minutes.")

    async def record_failed_attempt(self, email: str) -> None:
        key = f"{ATTEMPT_PREFIX}{email}"
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_SECONDS)
        await pipe.execute()

    async def clear_attempts(self, email: str) -> None:
        await self.redis.delete(f"{ATTEMPT_PREFIX}{email}")

    # ── Auth operations ────────────────────────────────────────────────────

    async def register(self, email: str, password: str, name: str) -> User:
        existing = await self.repo.get_by_email(email)
        if existing:
            raise ValueError("Email already registered.")
        password_hash = self.hash_password(password)
        user = await self.repo.create(
            email=email, password_hash=password_hash, name=name.strip()
        )
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def register_with_invite(self, token: str, name: str, password: str) -> User:
        from app.auth.invite_repository import UserInviteRepository, hash_invite_token

        th = hash_invite_token(token)
        inv_repo = UserInviteRepository(self.session)
        inv = await inv_repo.get_valid_by_token_hash(th)
        if not inv:
            raise ValueError("Invalid or expired invitation.")
        if await self.repo.get_by_email(inv.email):
            raise ValueError("Email already registered.")
        password_hash = self.hash_password(password)
        try:
            user = await self.repo.create(
                email=inv.email,
                password_hash=password_hash,
                name=name.strip(),
                role="user",
            )
            await inv_repo.consume(inv)
            await self.session.commit()
            await self.session.refresh(user)
        except IntegrityError:
            await self.session.rollback()
            raise ValueError("Could not complete registration.")
        return user

    async def login(self, email: str, password: str) -> tuple[str, str]:
        await self.check_rate_limit(email)
        user = await self.repo.get_by_email(email)
        if not user or not self.verify_password(password, user.password_hash):
            await self.record_failed_attempt(email)
            raise ValueError("Invalid email or password.")
        await self.clear_attempts(email)
        access_token = self.create_access_token(user.id, user.role)
        refresh_token = self.create_refresh_token(user.id)
        return access_token, refresh_token

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        if await self.is_blacklisted(refresh_token):
            raise ValueError("Refresh token has been revoked.")
        try:
            payload = self.decode_token(refresh_token)
        except JWTError:
            raise ValueError("Invalid refresh token.")
        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type.")

        user_id = UUID(payload["sub"])
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found.")

        # Rotate — blacklist old, issue new pair
        await self.blacklist_token(refresh_token)
        access_token = self.create_access_token(user.id, user.role)
        new_refresh = self.create_refresh_token(user.id)
        return access_token, new_refresh

    async def logout(self, refresh_token: str) -> None:
        await self.blacklist_token(refresh_token)
