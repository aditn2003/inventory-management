import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tenantsApi } from '@/api/tenants';
import { useAuth } from '@/hooks/useAuth';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/apiError';
import type { Tenant } from '@/types/tenant';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    tenantsApi.get(id)
      .then(setTenant)
      .catch(() => navigate('/tenants'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!tenant) return;
    try {
      await tenantsApi.delete(tenant.id);
      toast.success('Tenant deleted.');
      navigate('/tenants');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <DetailHeader
        title={tenant.name}
        subtitle={tenant.display_id}
        backTo="/tenants"
        backLabel="Tenants"
        actions={
          user?.role === 'admin' ? (
            <>
              <button
                onClick={() => navigate(`/tenants/${tenant.id}/edit`)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </>
          ) : undefined
        }
      />

      <InfoCardGrid
        cards={[
          { label: 'Display ID', value: tenant.display_id },
          { label: 'Status', value: <StatusBadge status={tenant.status} /> },
          { label: 'Created', value: new Date(tenant.created_at).toLocaleDateString() },
          { label: 'Last Updated', value: new Date(tenant.updated_at).toLocaleDateString() },
        ]}
      />

      <ConfirmDialog
        open={showDelete}
        title="Delete Tenant"
        message={`Are you sure you want to delete "${tenant.name}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
