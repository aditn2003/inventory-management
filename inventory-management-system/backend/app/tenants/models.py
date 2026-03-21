import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.auth.models import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    display_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(255), unique=True, nullable=False)
    status = Column(String(20), nullable=False, server_default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="tenants_status_check"),
    )

    user_assignments = relationship("UserTenantRole", back_populates="tenant")
    products = relationship("Product", back_populates="tenant")
    orders = relationship("Order", back_populates="tenant")
