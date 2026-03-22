"""Customer orders against products (per tenant)."""

import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.auth.models import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    display_id = Column(String(20), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    requested_qty = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, server_default="created")
    notes = Column(Text, nullable=True)
    order_date = Column(Date, server_default=func.current_date(), nullable=False)
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
            "status IN ('created', 'pending', 'confirmed', 'cancelled')",
            name="orders_status_check",
        ),
        CheckConstraint("requested_qty > 0", name="orders_requested_qty_check"),
    )

    tenant = relationship("Tenant", back_populates="orders")
    product = relationship("Product", back_populates="orders")
