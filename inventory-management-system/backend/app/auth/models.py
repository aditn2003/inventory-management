"""ORM models: ``User``, ``UserInvite``, ``UserTenantRole``."""

import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False, server_default=text("''"))
    password_hash = Column(String(255), nullable=True)
    google_sub = Column(String(255), unique=True, nullable=True)
    role = Column(String(20), nullable=False, server_default="user")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user')", name="users_role_check"),
    )

    tenant_assignments = relationship(
        "UserTenantRole", back_populates="user", cascade="all, delete-orphan"
    )
    invites_sent = relationship("UserInvite", back_populates="invited_by")


class UserInvite(Base):
    """Pending registration link sent by admin (email contains secret token)."""

    __tablename__ = "user_invites"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    email = Column(String(255), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    consumed_at = Column(DateTime(timezone=True), nullable=True)

    invited_by = relationship("User", back_populates="invites_sent")


class UserTenantRole(Base):
    __tablename__ = "user_tenant_roles"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_user_tenant"),)

    user = relationship("User", back_populates="tenant_assignments")
    tenant = relationship("Tenant", back_populates="user_assignments")
