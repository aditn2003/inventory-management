"""
Tenant middleware — extracts X-Tenant-Id header, verifies user access,
and sets app.current_tenant_id on the database session so RLS policies apply.

This middleware runs AFTER auth (JWT is validated first by FastAPI dependencies).
The tenant check is enforced in each router that requires tenant scoping.
"""
