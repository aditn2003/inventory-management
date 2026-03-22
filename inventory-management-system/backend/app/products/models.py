"""Product catalog rows (per tenant)."""

import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Integer,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.auth.models import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    sku = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)
    cost_per_unit = Column(Numeric(12, 2), nullable=False)
    reorder_threshold = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, server_default="active")
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
        CheckConstraint(
            "status IN ('active', 'inactive')", name="products_status_check"
        ),
        CheckConstraint(
            "reorder_threshold >= 0", name="products_reorder_threshold_check"
        ),
        CheckConstraint("cost_per_unit > 0", name="products_cost_per_unit_check"),
    )

    tenant = relationship("Tenant", back_populates="products")
    inventory = relationship(
        "Inventory",
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan",
    )
    orders = relationship("Order", back_populates="product")
