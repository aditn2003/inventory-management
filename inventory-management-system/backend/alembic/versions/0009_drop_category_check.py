"""Drop products_category_check so categories are user-defined.

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PREVIOUS_CATEGORIES = (
    "'Metals', 'Chemicals', 'Plastics', 'Electronics', "
    "'Textiles', 'Packaging', 'Tools', 'Adhesives', 'Ceramics', 'Glass'"
)


def upgrade() -> None:
    op.drop_constraint("products_category_check", "products", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "products_category_check",
        "products",
        f"category IN ({PREVIOUS_CATEGORIES})",
    )
