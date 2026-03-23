"""Create ims_app role for RLS enforcement via SET LOCAL ROLE.

Non-owner roles are automatically subject to row-level security policies.
The application switches to ims_app per-transaction on tenant-scoped requests,
while seed/migrations continue running as the table-owner (ims_user) and bypass RLS.

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ims_app') THEN
                CREATE ROLE ims_app NOLOGIN;
            END IF;
        END $$
    """)

    op.execute("GRANT ims_app TO CURRENT_USER")

    op.execute("GRANT USAGE ON SCHEMA public TO ims_app")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE "
        "ON products, inventory, orders TO ims_app"
    )
    op.execute(
        "GRANT SELECT "
        "ON users, tenants, user_tenant_roles, user_invites TO ims_app"
    )
    op.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ims_app")

    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT SELECT ON TABLES TO ims_app"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT USAGE ON SEQUENCES TO ims_app"
    )


def downgrade() -> None:
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE USAGE ON SEQUENCES FROM ims_app"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE SELECT ON TABLES FROM ims_app"
    )
    op.execute("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ims_app")
    op.execute("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ims_app")
    op.execute("REVOKE USAGE ON SCHEMA public FROM ims_app")
    op.execute("REVOKE ims_app FROM CURRENT_USER")
    op.execute("DROP ROLE IF EXISTS ims_app")
