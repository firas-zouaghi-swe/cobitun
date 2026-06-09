import AdminUsersPageClient from '@/components/pages/AdminUsersPageWrapper';

export default function AdminUsersPage() {
  return (
    <AdminUsersPageClient
      initialUsers={[]}
      pagination={{ page: 1, limit: 20, total: 0, totalPages: 1 }}
      currentUserRole=""
    />
  );
}
