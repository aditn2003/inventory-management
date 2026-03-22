"""Expand product categories to include Electronics, Textiles, Packaging,
Tools, Adhesives, Ceramics, Glass.

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_CATEGORIES = (
    "'Metals', 'Chemicals', 'Plastics', 'Electronics', "
    "'Textiles', 'Packaging', 'Tools', 'Adhesives', 'Ceramics', 'Glass'"
)

OLD_CATEGORIES = "'Metals', 'Chemicals', 'Plastics'"


def upgrade() -> None:
    op.drop_constraint("products_category_check", "products", type_="check")
    op.create_check_constraint(
        "products_category_check",
        "products",
        f"category IN ({NEW_CATEGORIES})",
    )


def downgrade() -> None:
    op.drop_constraint("products_category_check", "products", type_="check")
    op.create_check_constraint(
        "products_category_check",
        "products",
        f"category IN ({OLD_CATEGORIES})",
    )
