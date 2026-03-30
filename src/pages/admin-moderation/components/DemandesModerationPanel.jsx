import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import demandeService from '../../../services/demandeService';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'in-review', label: 'En cours' },
  { value: 'approved', label: 'Approuvees' },
  { value: 'rejected', label: 'Rejetees' }
];

const STATUS_META = {
  pending: { label: 'En attente', color: 'bg-warning/10 text-warning', icon: 'Clock' },
  'in-review': { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: 'Eye' },
  approved: { label: 'Approuvee', color: 'bg-success/10 text-success', icon: 'CheckCircle' },
  rejected: { label: 'Rejetee', color: 'bg-error/10 text-error', icon: 'XCircle' }
};

const normalizeRequestStatus = (request) => {
  const moderation = String(request?.moderation_status || request?.status || '')?.toLowerCase();
  const statut = String(request?.statut || '')?.toLowerCase();

  if (moderation === 'approved' || moderation === 'validated') return 'approved';
  if (moderation === 'rejected' || moderation === 'refused') return 'rejected';
  if (moderation === 'in_review' || moderation === 'in-review' || moderation === 'review') return 'in-review';
  if (moderation === 'pending') return 'pending';

  if (statut === 'closed') return 'approved';
  if (statut === 'rejected') return 'rejected';
  return 'pending';
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date?.getTime())) return '-';

  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getTypeLabel = (type) => {
  const safeType = String(type || '')?.replace(/_/g, ' ');
  return safeType || 'Demande';
};

const DemandesModerationPanel = ({ showHeading = false }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const { data, error } = await supabase
        ?.from('demandes')
        ?.select('*')
        ?.order('created_at', { ascending: false })
        ?.limit(500);

      if (error) throw error;

      const rows = Array?.isArray(data) ? data : [];
      const userIds = [...new Set(rows?.map((row) => row?.user_id)?.filter(Boolean))];

      let usersMap = {};
      if (userIds?.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          ?.from('profiles')
          ?.select('id, pseudo, email')
          ?.in('id', userIds);

        if (!profileError) {
          usersMap = (profiles || [])?.reduce((acc, profile) => {
            acc[profile?.id] = profile;
            return acc;
          }, {});
        }
      }

      const normalized = rows?.map((row) => {
        const owner = usersMap?.[row?.user_id] || null;

        return {
          ...row,
          type: row?.categorie_slug || row?.categorie || 'demande-location',
          subject: row?.titre || 'Demande sans titre',
          description: row?.description || '-',
          user: owner?.pseudo || 'Utilisateur',
          userEmail: owner?.email || '-',
          status: normalizeRequestStatus(row),
          submittedDate: row?.created_at || row?.submitted_at || null
        };
      });

      setRequests(normalized);
    } catch (error) {
      console.error('Erreur de chargement des demandes a moderer:', error);
      setFetchError(error?.message || 'Impossible de charger les demandes');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    pending: requests?.filter((request) => request?.status === 'pending')?.length || 0,
    review: requests?.filter((request) => request?.status === 'in-review')?.length || 0,
    approved: requests?.filter((request) => request?.status === 'approved')?.length || 0,
    rejected: requests?.filter((request) => request?.status === 'rejected')?.length || 0
  }), [requests]);

  const filteredRequests = useMemo(() => {
    const query = String(searchQuery || '')?.trim()?.toLowerCase();

    return (requests || [])?.filter((request) => {
      const matchesStatus = statusFilter === 'all' || request?.status === statusFilter;
      if (!matchesStatus) return false;

      if (!query) return true;

      const subject = String(request?.subject || '')?.toLowerCase();
      const user = String(request?.user || '')?.toLowerCase();
      const email = String(request?.userEmail || '')?.toLowerCase();
      const description = String(request?.description || '')?.toLowerCase();

      return (
        subject?.includes(query) ||
        user?.includes(query) ||
        email?.includes(query) ||
        description?.includes(query)
      );
    });
  }, [requests, searchQuery, statusFilter]);

  const updateRequestStatus = async (requestId, nextStatus) => {
    try {
      setUpdatingId(requestId);
      const { error } = await demandeService?.reviewDemande(requestId, nextStatus);
      if (error) throw error;
      await loadRequests();
    } catch (error) {
      console.error('Erreur de mise a jour de la moderation de la demande:', error);
      window?.alert(error?.message || 'Impossible de mettre a jour cette demande');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {showHeading ? (
        <div>
          <h2 className="text-2xl font-bold text-foreground">Demandes a moderer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Validez ou refusez les demandes avant leur publication.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-elevation-1 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <Icon name="Clock" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.pending}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Icon name="Eye" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.review}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <Icon name="CheckCircle" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.approved}</p>
              <p className="text-xs text-muted-foreground">Approuvees</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-error/10 text-error">
              <Icon name="XCircle" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejetees</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-elevation-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Rechercher par utilisateur, sujet ou contenu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value || '')}
          />

          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || 'all')}
          />

          <Button variant="outline" iconName="RefreshCw" onClick={loadRequests} loading={loading}>
            Actualiser
          </Button>
        </div>
      </div>

      {fetchError ? (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 text-sm">
          {fetchError}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
            Chargement des demandes...
          </div>
        ) : filteredRequests?.length === 0 ? (
          <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
            Aucune demande pour ce filtre.
          </div>
        ) : (
          filteredRequests?.map((request) => {
            const statusBadge = STATUS_META?.[request?.status] || STATUS_META?.pending;
            const isUpdating = updatingId === request?.id;

            return (
              <div key={request?.id} className="bg-white rounded-lg shadow-elevation-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-foreground">{request?.subject}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge?.color}`}>
                        <Icon name={statusBadge?.icon} size={12} />
                        {statusBadge?.label}
                      </span>
                      <span className="px-2 py-1 bg-surface text-muted-foreground text-xs font-medium rounded-full">
                        {getTypeLabel(request?.type)}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">{request?.description}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Icon name="User" size={12} />
                        {request?.user}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Mail" size={12} />
                        {request?.userEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Calendar" size={12} />
                        {formatDate(request?.submittedDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {request?.status === 'pending' ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          iconName="CheckCircle"
                          loading={isUpdating}
                          onClick={() => updateRequestStatus(request?.id, 'approved')}
                        >
                          Approuver et publier
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          iconName="XCircle"
                          disabled={isUpdating}
                          onClick={() => updateRequestStatus(request?.id, 'rejected')}
                        >
                          Rejeter
                        </Button>
                      </>
                    ) : null}

                    {request?.status === 'in-review' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="CheckCircle"
                        loading={isUpdating}
                        onClick={() => updateRequestStatus(request?.id, 'approved')}
                      >
                        Approuver et publier
                      </Button>
                    ) : null}

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DemandesModerationPanel;
