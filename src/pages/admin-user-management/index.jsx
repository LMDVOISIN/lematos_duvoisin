import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { Link } from 'react-router-dom';
import UserDetailModal from './components/UserDetailModal';
import StatusChangeModal from './components/StatusChangeModal';
import { supabase } from '../../lib/supabase';

const DEFAULT_AVATAR = '/assets/images/no_image.png';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'banned', label: 'Bannis' },
  { value: 'testers', label: 'Participants aux essais' }
];

const normalizeUserStatus = (user) => {
  const rawStatus = String(user?.status || '')?.toLowerCase();

  if (rawStatus === 'active' || rawStatus === 'suspended' || rawStatus === 'banned') {
    return rawStatus;
  }

  if (user?.banned_at) return 'banned';
  if (user?.suspended_at) return 'suspended';
  return 'active';
};

const normalizeUser = (user) => ({
  ...user,
  status: normalizeUserStatus(user),
  strikeCount: Number(user?.no_reply_strikes ?? user?.strikeCount ?? 0) || 0,
  avatar_url: user?.avatar_url || user?.avatar || DEFAULT_AVATAR,
  created_at: user?.created_at || user?.registrationDate || null,
  is_tester: Boolean(user?.is_tester || user?.isTester)
});

const getStatusConfig = (status) => {
  const configs = {
    active: {
      label: 'Actif',
      icon: 'CheckCircle',
      color: 'text-success bg-success/10'
    },
    suspended: {
      label: 'Suspendu',
      icon: 'AlertCircle',
      color: 'text-warning bg-warning/10'
    },
    banned: {
      label: 'Banni',
      icon: 'XCircle',
      color: 'text-error bg-error/10'
    }
  };
  return configs?.[status] || configs?.active;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date?.getTime())) return '-';
  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const buildStatusUpdatePayload = (user, action, reason) => {
  const now = new Date()?.toISOString();
  const userKeys = Object.keys(user || {});
  const has = (field) => userKeys?.includes(field);

  const payload = {};

  if (has('status')) {
    if (action === 'activate') payload.status = 'active';
    if (action === 'suspend') payload.status = 'suspended';
    if (action === 'ban') payload.status = 'banned';
  }

  if (action === 'activate') {
    if (has('suspended_at')) payload.suspended_at = null;
    if (has('suspension_reason')) payload.suspension_reason = null;
    if (has('banned_at')) payload.banned_at = null;
    if (has('ban_reason')) payload.ban_reason = null;
  }

  if (action === 'suspend') {
    if (has('suspended_at')) payload.suspended_at = now;
    if (has('suspension_reason')) payload.suspension_reason = reason || null;
    if (has('banned_at')) payload.banned_at = null;
  }

  if (action === 'ban') {
    if (has('banned_at')) payload.banned_at = now;
    if (has('ban_reason')) payload.ban_reason = reason || null;
  }

  if (has('updated_at')) payload.updated_at = now;

  return payload;
};

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const { data, error } = await supabase
        ?.from('profiles')
        ?.select('*')
        ?.order('created_at', { ascending: false });

      if (error) throw error;

      setUsers((data || [])?.map((user) => normalizeUser(user)));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setFetchError(error?.message || 'Impossible de charger les utilisateurs');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return (users || [])?.filter((user) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'testers' && user?.is_tester) ||
        (statusFilter !== 'testers' && user?.status === statusFilter);

      const query = String(searchQuery || '')?.toLowerCase();
      const matchesSearch =
        !query ||
        String(user?.pseudo || '')?.toLowerCase()?.includes(query) ||
        String(user?.email || '')?.toLowerCase()?.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [users, searchQuery, statusFilter]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(filteredUsers?.map((u) => u?.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId, checked) => {
    if (checked) {
      setSelectedUsers((prev) => [...prev, userId]);
    } else {
      setSelectedUsers((prev) => prev?.filter((id) => id !== userId));
    }
  };

  const handleViewProfile = (user) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const handleStatusChange = (userId, action) => {
    const user = users?.find((item) => item?.id === userId);
    setSelectedUser(user || null);
    setStatusAction(action);
    setShowStatusModal(Boolean(user));
  };

  const applyStatusChange = async (user, action, reason = '') => {
    if (!user?.id) return;

    try {
      setActionLoading(true);

      const payload = buildStatusUpdatePayload(user, action, reason);
      if (Object.keys(payload || {})?.length === 0) {
        throw new Error('Aucune colonne de statut compatible dans la table profiles');
      }

      const { error } = await supabase
        ?.from('profiles')
        ?.update(payload)
        ?.eq('id', user?.id);

      if (error) throw error;

      await fetchUsers();
    } catch (error) {
      console.error('Erreur de mise ? jour statut utilisateur:', error);
      window?.alert(error?.message || 'Impossible de mettre a jour ce statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers?.length === 0) {
      window?.alert('Veuillez selectionner au moins un utilisateur');
      return;
    }

    if (action === 'export') {
      const rows = users?.filter((user) => selectedUsers?.includes(user?.id));
      const headers = ['id', 'pseudo', 'email', 'status', 'created_at'];
      const csvLines = rows?.map((row) =>
        [
          row?.id,
          row?.pseudo,
          row?.email,
          row?.status,
          row?.created_at
        ]
            ?.map((value) => `"${String(value ?? '')?.replace(/"/g, '""')}"`)
          ?.join(',')
      );

      const csvContent = [headers?.join(','), ...(csvLines || [])]?.join('\n');
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-export-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
      document.body?.appendChild(link);
      link?.click();
      document.body?.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const reason = action === 'suspend' ? 'Suspension admin (action en lot)' : '';

    try {
      setActionLoading(true);
      const selectedRows = users?.filter((user) => selectedUsers?.includes(user?.id));

      for (const user of selectedRows || []) {
        // eslint-disable-next-line no-await-in-loop
        await applyStatusChange(user, action, reason);
      }

      setSelectedUsers([]);
      await fetchUsers();
    } catch (error) {
      console.error('Erreur action en lot:', error);
      window?.alert(error?.message || "Impossible d'appliquer l'action en lot");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8">
        <div className="mb-6">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">Gerez les comptes utilisateurs et leurs statuts</p>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select
                label="Statut"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value || 'all')}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Rechercher"
                placeholder="Pseudo ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value || '')}
              />
            </div>
          </div>
        </div>

        {selectedUsers?.length > 0 && (
          <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4 mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <p className="text-sm font-medium text-foreground">
                {selectedUsers?.length} utilisateur{selectedUsers?.length > 1 ? 's' : ''} selectionne{selectedUsers?.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Ban"
                  loading={actionLoading}
                  onClick={() => handleBulkAction('suspend')}
                >
                  Suspendre
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Download"
                  loading={actionLoading}
                  onClick={() => handleBulkAction('export')}
                >
                  Exporter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconName="X"
                  disabled={actionLoading}
                  onClick={() => setSelectedUsers([])}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedUsers?.length === filteredUsers?.length && filteredUsers?.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Pseudo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">E-mail</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Date inscription</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Avertissements</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
                      Chargement des utilisateurs...
                    </td>
                  </tr>
                ) : filteredUsers?.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
                      Aucun utilisateur trouve.
                    </td>
                  </tr>
                ) : (
                  filteredUsers?.map((user) => {
                    const statusConfig = getStatusConfig(user?.status);

                    return (
                      <tr key={user?.id} className="hover:bg-surface transition-colors">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedUsers?.includes(user?.id)}
                            onCheckedChange={(checked) => handleSelectUser(user?.id, checked)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={user?.avatar_url || DEFAULT_AVATAR}
                              alt={user?.pseudo}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-medium text-foreground">{user?.pseudo}</p>
                              {user?.is_tester && (
                                <span className="inline-flex items-center gap-1 text-xs text-[#17a2b8]">
                                  <Icon name="Beaker" size={12} />
                                  Participant aux essais
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{user?.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-muted-foreground">{formatDate(user?.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                            <Icon name={statusConfig?.icon} size={12} />
                            <span>{statusConfig?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                user?.strikeCount >= 3
                                  ? 'text-error'
                                  : user?.strikeCount >= 2
                                    ? 'text-warning'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {user?.strikeCount}
                            </span>
                            {user?.strikeCount >= 2 && (
                              <Icon name="AlertTriangle" size={14} className="text-warning" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              iconName="Eye"
                              onClick={() => handleViewProfile(user)}
                            >
                              Voir
                            </Button>
                            {user?.status === 'active' && (
                              <Button
                                variant="outline"
                                size="xs"
                                iconName="Ban"
                                onClick={() => handleStatusChange(user?.id, 'suspend')}
                              >
                                Suspendre
                              </Button>
                            )}
                            {user?.status === 'suspended' && (
                              <Button
                                variant="outline"
                                size="xs"
                                iconName="CheckCircle"
                                onClick={() => handleStatusChange(user?.id, 'activate')}
                              >
                                Activer
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />

      {showDetailModal && selectedUser && (
        <UserDetailModal
          isOpen={showDetailModal}
          user={selectedUser}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {showStatusModal && selectedUser && (
        <StatusChangeModal
          isOpen={showStatusModal}
          user={selectedUser}
          action={statusAction}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedUser(null);
            setStatusAction(null);
          }}
          onConfirm={async (reason) => {
            await applyStatusChange(selectedUser, statusAction, reason);
            setShowStatusModal(false);
            setSelectedUser(null);
            setStatusAction(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminUserManagement;

