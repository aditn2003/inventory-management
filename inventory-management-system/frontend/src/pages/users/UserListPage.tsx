import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersThree } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/useUsers';
import { usersApi } from '@/api/users';
import { DataTable } from '@/components/ui/DataTable';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/utils/apiError';
import type { UserListItem } from '@/types/user';

export function UserListPage() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const { data, loading, error, refetch } = useUsers();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await usersApi.delete(deleteTarget.id);
      toast.success(`User "${deleteTarget.email}" deleted.`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u: UserListItem) => <span className="capitalize">{u.role}</span> },
    { key: 'assigned_tenant_count', header: 'Tenant Access', render: (u: UserListItem) =>
      u.assigned_tenant_count === 0 ? 'All tenants' : `${u.assigned_tenant_count} assigned` },
    { key: 'created_at', header: 'Joined', render: (u: UserListItem) => new Date(u.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (u: UserListItem) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => navigate(`/users/${u.id}`) },
            { label: 'Delete', onClick: () => setDeleteTarget(u), variant: 'danger' as const },
          ]}
        />
      ),
    },
  ];

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-gray-900">Users</h1>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        emptyState={
          <EmptyState
            icon={<UsersThree size={48} />}
            heading="No users found"
          />
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Delete user "${deleteTarget?.email}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
