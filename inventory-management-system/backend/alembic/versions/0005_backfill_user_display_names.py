"""Backfill empty users.name for default seeded accounts only (admin@ims.com, user@ims.com).

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET name = 'System Administrator'
        WHERE lower(trim(email)) = 'admin@ims.com'
          AND btrim(coalesce(name, '')) = ''
        """
    )
    op.execute(
        """
        UPDATE users
        SET name = 'Demo User'
        WHERE lower(trim(email)) = 'user@ims.com'
          AND btrim(coalesce(name, '')) = ''
        """
    )


def downgrade() -> None:
    # Data backfill is not reversed
    pass
