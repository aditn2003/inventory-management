import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUserDetail } from '@/hooks/useUsers';
import { useTenants } from '@/hooks/useTenants';
import { usersApi } from '@/api/users';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getErrorMessage } from '@/utils/apiError';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, loading, refetch } = useUserDetail(id);
  const { data: allTenants } = useTenants({ page_size: 100 });
  const [assignTenantId, setAssignTenantId] = useState('');
  const [roleValue, setRoleValue] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleRoleUpdate = async () => {
    if (!id || !roleValue) return;
    setSaving(true);
    try {
      await usersApi.updateRole(id, { role: roleValue as 'admin' | 'user' });
      toast.success('Role updated.');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTenant = async () => {
    if (!id || !assignTenantId) return;
    try {
      await usersApi.assignTenant(id, assignTenantId);
      toast.success('Tenant assigned.');
      setAssignTenantId('');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRemoveTenant = async (tenantId: string) => {
    if (!id) return;
    try {
      await usersApi.removeTenant(id, tenantId);
      toast.success('Tenant removed.');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await usersApi.delete(id);
      toast.success('User deleted.');
      navigate('/users');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!user) return null;

  const unassignedTenants = allTenants?.data.filter(
    (t) => !user.assigned_tenants.some((a) => a.id === t.id)
  ) ?? [];

  return (
    <div className="space-y-6">
      <DetailHeader
        title={user.email}
        subtitle={`Role: ${user.role}`}
        backTo="/users"
        backLabel="Users"
        actions={
          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        }
      />

      <InfoCardGrid
        cards={[
          { label: 'Email', value: user.email },
          { label: 'Role', value: <span className="capitalize">{user.role}</span> },
          { label: 'Tenant Access', value: user.assigned_tenants.length === 0 ? 'All tenants (default)' : `${user.assigned_tenants.length} assigned` },
          { label: 'Joined', value: new Date(user.created_at).toLocaleDateString() },
        ]}
      />

      {/* Role update */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Change Role</h2>
        <div className="flex items-center gap-3">
          <select
            value={roleValue || user.role}
            onChange={(e) => setRoleValue(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleRoleUpdate}
            disabled={saving || !roleValue}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Update Role
          </button>
        </div>
      </div>

      {/* Tenant assignments */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Tenant Assignments
          <span className="ml-2 text-xs text-gray-400">
            {user.assigned_tenants.length === 0
              ? '(0 assignments — all-access default)'
              : `(${user.assigned_tenants.length} assigned)`}
          </span>
        </h2>

        {user.assigned_tenants.length > 0 && (
          <ul className="space-y-1.5 mb-4">
            {user.assigned_tenants.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.display_id} — {t.name}</span>
                <button
                  onClick={() => handleRemoveTenant(t.id)}
                  className="text-xs text-red-600 hover:text-red-700 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {unassignedTenants.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={assignTenantId}
              onChange={(e) => setAssignTenantId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Add tenant restriction...</option>
              {unassignedTenants.map((t) => (
                <option key={t.id} value={t.id}>{t.display_id} — {t.name}</option>
              ))}
            </select>
            <button
              onClick={handleAssignTenant}
              disabled={!assignTenantId}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Assign
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete User"
        message={`Delete user "${user.email}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
