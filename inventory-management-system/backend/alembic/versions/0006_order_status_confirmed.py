"""Add order status confirmed; migrate legacy created (stock already deducted) to confirmed.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("orders_status_check", "orders", type_="check")
    op.execute("UPDATE orders SET status = 'confirmed' WHERE status = 'created'")
    op.create_check_constraint(
        "orders_status_check",
        "orders",
        "status IN ('created', 'pending', 'confirmed', 'cancelled')",
    )


def downgrade() -> None:
    op.drop_constraint("orders_status_check", "orders", type_="check")
    op.execute("UPDATE orders SET status = 'created' WHERE status = 'confirmed'")
    op.create_check_constraint(
        "orders_status_check",
        "orders",
        "status IN ('created', 'pending', 'cancelled')",
    )
