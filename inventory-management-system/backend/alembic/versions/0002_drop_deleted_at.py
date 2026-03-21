"""drop deleted_at columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("orders", "deleted_at")
    op.drop_column("inventory", "deleted_at")
    op.drop_column("products", "deleted_at")
    op.drop_column("tenants", "deleted_at")
    op.drop_column("users", "deleted_at")


def downgrade() -> None:
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("products", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("inventory", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
