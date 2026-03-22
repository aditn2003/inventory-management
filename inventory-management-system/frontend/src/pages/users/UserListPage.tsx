import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UsersThree } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/useUsers';
import { usersApi } from '@/api/users';
import { DataTable } from '@/components/ui/DataTable';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/types/api';
import type { UserListItem } from '@/types/user';

export function UserListPage() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const { data, loading, error, refetch } = useUsers();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await usersApi.delete(deleteTarget.id);
      toast.success(`User "${deleteTarget.name}" deleted.`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'role', header: 'Role', render: (u: UserListItem) => (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
        bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-600/20">
        {u.role}
      </span>
    )},
    { key: 'assigned_tenant_count', header: 'Tenant access', render: (u: UserListItem) =>
      u.assigned_tenant_count === 0 ? (
        <span className="text-emerald-600 font-medium">All tenants</span>
      ) : (
        `${u.assigned_tenant_count} only`
      )
    },
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

  if (error) return <p className="text-rose-600">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Users</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Manage user accounts and access</p>
        </div>
        <button type="button" onClick={() => navigate('/users/new')} className="btn-primary">
          <Plus size={16} />
          Invite user
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        emptyState={
          <EmptyState
            icon={<UsersThree size={40} />}
            heading="No users found"
            subtext="Invite your first user to get started."
          />
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Delete user "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
