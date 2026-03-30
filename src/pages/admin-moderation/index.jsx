import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import RefusalModal from './components/RefusalModal';
import ModerationItemDetailModal from './components/ModerationItemDetailModal';
import { supabase } from '../../lib/supabase';
import annonceService from '../../services/annonceService';
import demandeService from '../../services/demandeService';
import seoRefreshQueueService from '../../services/seoRefreshQueueService';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'in_review', label: 'En cours' },
  { value: 'validated', label: 'Validee' },
  { value: 'refused', label: 'Refusee' }
];

const getStatusConfig = (status) => {
  const configs = {
    pending: {
      label: 'En attente',
      icon: 'Clock',
      color: 'text-warning bg-warning/10'
    },
    in_review: {
      label: 'En cours',
      icon: 'Eye',
      color: 'text-blue-700 bg-blue-100'
    },
    validated: {
      label: 'Validee',
      icon: 'CheckCircle',
      color: 'text-success bg-success/10'
    },
    refused: {
      label: 'Refusee',
      icon: 'XCircle',
      color: 'text-error bg-error/10'
    }
  };
  return configs?.[status] || configs?.pending;
};

const normalizeListingStatus = (listing) => {
  const moderation = String(listing?.moderation_status || '')?.toLowerCase();
  const statut = String(listing?.statut || '')?.toLowerCase();
  const isPublished = statut === 'publiee' || statut === 'published' || Boolean(listing?.published);

  if (isPublished) return 'validated';
  if (statut === 'refusee' || statut === 'rejected') return 'refused';
  if (statut === 'en_attente' || statut === 'pending') return 'pending';
  if (moderation === 'approved' || moderation === 'validated' || moderation === 'accepted') return 'validated';
  if (moderation === 'rejected' || moderation === 'refused') return 'refused';
  if (moderation === 'in_review' || moderation === 'in-review' || moderation === 'review') return 'in_review';
  if (moderation === 'pending') return 'pending';

  return 'pending';
};

const normalizeDemandeStatus = (request) => {
  const moderation = String(request?.moderation_status || request?.status || '')?.toLowerCase();
  const statut = String(request?.statut || '')?.toLowerCase();

  if (moderation === 'approved' || moderation === 'validated') return 'validated';
  if (moderation === 'rejected' || moderation === 'refused') return 'refused';
  if (moderation === 'in_review' || moderation === 'in-review' || moderation === 'review') return 'in_review';
  if (moderation === 'pending') return 'pending';
  if (statut === 'rejected') return 'refused';
  if (statut === 'closed') return 'validated';

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

const toTimestamp = (dateString) => {
  const timestamp = new Date(dateString || '')?.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `${amount.toFixed(2)} EUR`;
};

const buildLocationLabel = (city, postalCode) => {
  const parts = [city, postalCode]?.filter(Boolean);
  return parts?.length > 0 ? parts?.join(' ') : 'Localisation non renseignee';
};

const mapListing = (listing, ownerMap) => {
  const ownerId = listing?.owner_id || listing?.user_id;
  const owner = ownerMap?.[ownerId] || null;
  const photos = Array?.isArray(listing?.photos)
    ? listing?.photos
    : Array?.isArray(listing?.images)
      ? listing?.images
      : [];
  const formattedPrice = formatCurrency(listing?.prix_jour ?? listing?.dailyPrice);
  const priceLabel = formattedPrice
    ? `${formattedPrice} / jour`
    : 'Prix non renseigne';

  return {
    ...listing,
    kind: 'annonce',
    rowKey: `annonce-${listing?.id}`,
    entityId: listing?.id,
    image: photos?.[0] || listing?.photo_url || '/assets/images/no_image.png',
    imageAlt: listing?.titre || listing?.title || 'Annonce',
    title: listing?.titre || listing?.title || 'Annonce sans titre',
    ownerLabel: owner?.pseudo || owner?.email || listing?.ownerPseudo || 'Utilisateur',
    ownerEmail: owner?.email || '-',
    category: listing?.categorie || listing?.category || '-',
    submissionDate: listing?.created_at || listing?.submissionDate || null,
    formattedSubmissionDate: formatDate(listing?.created_at || listing?.submissionDate || null),
    status: normalizeListingStatus(listing),
    description: listing?.description || '-',
    dailyPrice: Number(listing?.prix_jour ?? listing?.dailyPrice ?? 0) || 0,
    priceLabel,
    subtitle: priceLabel,
    metaLabel: 'Annonce',
    refusalReason: listing?.moderation_reason || listing?.refusal_reason || null
  };
};

const mapDemande = (request, ownerMap) => {
  const owner = ownerMap?.[request?.user_id] || null;
  const radiusValue = Number.parseInt(request?.rayon_km, 10);
  const radiusLabel = Number.isFinite(radiusValue) ? `${radiusValue} km` : 'Rayon non renseigne';
  const budgetValue = formatCurrency(request?.prix_max);
  const locationLabel = buildLocationLabel(request?.ville, request?.code_postal);
  const subtitleParts = [locationLabel, radiusLabel]?.filter(Boolean);
  const budgetLabel = [
    budgetValue ? `${budgetValue} max` : 'Budget non renseigne',
    radiusLabel
  ]?.filter(Boolean)?.join(' - ');

  return {
    ...request,
    kind: 'demande',
    rowKey: `demande-${request?.id}`,
    entityId: request?.id,
    title: request?.titre || 'Demande sans titre',
    ownerLabel: owner?.pseudo || owner?.email || 'Utilisateur',
    ownerEmail: owner?.email || '-',
    category: request?.categorie_slug || request?.categorie || '-',
    submissionDate: request?.created_at || request?.submitted_at || null,
    formattedSubmissionDate: formatDate(request?.created_at || request?.submitted_at || null),
    status: normalizeDemandeStatus(request),
    description: request?.description || '-',
    subtitle: subtitleParts?.join(' - '),
    metaLabel: 'Demande',
    locationLabel,
    radiusLabel,
    budgetLabel,
    refusalReason: request?.moderation_reason || request?.refusal_reason || null
  };
};

const AdminModeration = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [refusalItem, setRefusalItem] = useState(null);
  const [moderationItems, setModerationItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState(null);

  useEffect(() => {
    loadModerationItems();
  }, []);

  const loadModerationItems = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const [
        { data: listingsData, error: listingsError },
        { data: demandesData, error: demandesError }
      ] = await Promise.all([
        supabase
          ?.from('annonces')
          ?.select('*')
          ?.order('created_at', { ascending: false })
          ?.limit(500),
        supabase
          ?.from('demandes')
          ?.select('*')
          ?.order('created_at', { ascending: false })
          ?.limit(500)
      ]);

      if (listingsError) throw listingsError;
      if (demandesError) throw demandesError;

      const listingRows = Array?.isArray(listingsData) ? listingsData : [];
      const demandeRows = Array?.isArray(demandesData) ? demandesData : [];

      const profileIds = [
        ...listingRows?.map((listing) => listing?.owner_id || listing?.user_id),
        ...demandeRows?.map((request) => request?.user_id)
      ]?.filter(Boolean);

      const uniqueProfileIds = [...new Set(profileIds)];
      let ownerMap = {};

      if (uniqueProfileIds?.length > 0) {
        const { data: owners, error: ownersError } = await supabase
          ?.from('profiles')
          ?.select('id, pseudo, email')
          ?.in('id', uniqueProfileIds);

        if (!ownersError) {
          ownerMap = (owners || [])?.reduce((acc, owner) => {
            acc[owner?.id] = owner;
            return acc;
          }, {});
        }
      }

      const mergedRows = [
        ...listingRows?.map((listing) => mapListing(listing, ownerMap)),
        ...demandeRows?.map((request) => mapDemande(request, ownerMap))
      ]?.sort((left, right) => toTimestamp(right?.submissionDate) - toTimestamp(left?.submissionDate));

      setModerationItems(mergedRows);
    } catch (error) {
      console.error('Erreur de chargement de la moderation:', error);
      setFetchError(error?.message || 'Impossible de charger la moderation');
      setModerationItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const query = String(searchQuery || '')?.trim()?.toLowerCase();

    return (moderationItems || [])?.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item?.status === statusFilter;
      if (!matchesStatus) return false;

      if (!query) return true;

      const haystack = [
        item?.title,
        item?.ownerLabel,
        item?.ownerEmail,
        item?.category,
        item?.description,
        item?.metaLabel
      ]
        ?.map((value) => String(value || '')?.toLowerCase())
        ?.join(' ');

      return haystack?.includes(query);
    });
  }, [moderationItems, searchQuery, statusFilter]);

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedItem(null);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleApproveListing = async (item) => {
    try {
      setActionLoadingKey(item?.rowKey);
      const { error } = await annonceService?.updateAnnonceStatus(item?.entityId, 'publiee');
      if (error) {
        throw new Error(error?.message || 'Impossible de valider cette annonce');
      }

      const { error: queueError } = await seoRefreshQueueService?.queueAnnonceSeoRefresh({
        annonceId: item?.entityId,
        reason: 'annonce_approved',
        payload: { trigger: 'admin_moderation_validate' }
      });

      if (queueError) {
        console.warn('Annonce validee mais refresh SEO non planifie:', queueError?.message || queueError);
      }

      closeDetailModal();
      await loadModerationItems();
    } catch (error) {
      console.error('Erreur de validation annonce:', error);
      window?.alert(error?.message || 'Impossible de valider cette annonce');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleApproveDemande = async (item) => {
    try {
      setActionLoadingKey(item?.rowKey);
      const { error } = await demandeService?.reviewDemande(item?.entityId, 'approved');
      if (error) {
        throw new Error(error?.message || 'Impossible d approuver cette demande');
      }
      closeDetailModal();
      await loadModerationItems();
    } catch (error) {
      console.error('Erreur de validation demande:', error);
      window?.alert(error?.message || 'Impossible d approuver cette demande');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const openListingRefusal = (item) => {
    closeDetailModal();
    setRefusalItem(item);
    setShowRefusalModal(true);
  };

  const handleRejectDemande = async (item) => {
    const shouldReject = window?.confirm('Confirmer le rejet de cette demande ?');
    if (!shouldReject) return;

    try {
      setActionLoadingKey(item?.rowKey);
      const { error } = await demandeService?.reviewDemande(item?.entityId, 'rejected');
      if (error) {
        throw new Error(error?.message || 'Impossible de rejeter cette demande');
      }
      closeDetailModal();
      await loadModerationItems();
    } catch (error) {
      console.error('Erreur de rejet demande:', error);
      window?.alert(error?.message || 'Impossible de rejeter cette demande');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleApprove = async (item) => {
    if (!item) return;
    if (item?.kind === 'demande') {
      await handleApproveDemande(item);
      return;
    }
    await handleApproveListing(item);
  };

  const handleReject = async (item) => {
    if (!item) return;
    if (item?.kind === 'demande') {
      await handleRejectDemande(item);
      return;
    }
    openListingRefusal(item);
  };

  const handleRefusalSubmit = async (reason) => {
    if (!refusalItem?.entityId) return;

    try {
      setActionLoadingKey(refusalItem?.rowKey);
      const { error } = await annonceService?.updateAnnonceStatus(refusalItem?.entityId, 'refusee', reason);
      if (error) {
        throw new Error(error?.message || 'Impossible de refuser cette annonce');
      }
      setShowRefusalModal(false);
      setRefusalItem(null);
      await loadModerationItems();
    } catch (error) {
      console.error('Erreur de refus annonce:', error);
      window?.alert(error?.message || 'Impossible de refuser cette annonce');
    } finally {
      setActionLoadingKey(null);
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Moderation</h1>
          <p className="text-muted-foreground">Validez les annonces et les demandes depuis un seul tableau.</p>
        </div>

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
                placeholder="Titre, proprietaire / demandeur, categorie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value || '')}
              />
            </div>
          </div>
        </div>

        {fetchError ? (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Annonce</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Proprietaire / demandeur</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Categorie</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Date soumission</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Statut</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                      Chargement de la moderation...
                    </td>
                  </tr>
                ) : filteredItems?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                      Aucun element trouve.
                    </td>
                  </tr>
                ) : (
                  filteredItems?.map((item) => {
                    const statusConfig = getStatusConfig(item?.status);
                    const isLoadingAction = actionLoadingKey === item?.rowKey;

                    return (
                      <tr key={item?.rowKey} className="hover:bg-surface transition-colors">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-medium text-foreground text-sm line-clamp-2">{item?.title}</p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                item?.kind === 'demande'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                <Icon name={item?.kind === 'demande' ? 'FileSearch' : 'Package'} size={11} />
                                {item?.metaLabel}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{item?.subtitle || '-'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">{item?.ownerLabel}</p>
                            {item?.ownerEmail && item?.ownerEmail !== '-' ? (
                              <p className="text-xs text-muted-foreground mt-1">{item?.ownerEmail}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{item?.category}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-muted-foreground">{item?.formattedSubmissionDate}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                            <Icon name={statusConfig?.icon} size={12} />
                            <span>{statusConfig?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="xs"
                              iconName="Eye"
                              onClick={() => handleViewDetails(item)}
                            >
                              Voir
                            </Button>

                            {(item?.status === 'pending' || item?.status === 'in_review') ? (
                              <>
                                <Button
                                  variant="success"
                                  size="xs"
                                  iconName="CheckCircle"
                                  loading={isLoadingAction}
                                  onClick={() => handleApprove(item)}
                                >
                                  {item?.kind === 'demande' ? 'Approuver' : 'Valider'}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="xs"
                                  iconName="XCircle"
                                  disabled={isLoadingAction}
                                  onClick={() => handleReject(item)}
                                >
                                  {item?.kind === 'demande' ? 'Rejeter' : 'Refuser'}
                                </Button>
                              </>
                            ) : null}

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

      {showDetailModal && selectedItem ? (
        <ModerationItemDetailModal
          item={selectedItem}
          loading={actionLoadingKey === selectedItem?.rowKey}
          onClose={closeDetailModal}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ) : null}

      {showRefusalModal ? (
        <RefusalModal
          listing={refusalItem}
          loading={actionLoadingKey === refusalItem?.rowKey}
          onClose={() => {
            if (actionLoadingKey === refusalItem?.rowKey) return;
            setShowRefusalModal(false);
            setRefusalItem(null);
          }}
          onSubmit={handleRefusalSubmit}
        />
      ) : null}
    </div>
  );
};

export default AdminModeration;
