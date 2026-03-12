import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import ListingDetailModal from './components/ListingDetailModal';
import RefusalModal from './components/RefusalModal';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import annonceService from '../../services/annonceService';
import seoRefreshQueueService from '../../services/seoRefreshQueueService';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
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

  // The public marketplace relies on statut/published, so prefer those fields
  // to avoid showing "pending" for listings already online.
  if (isPublished) return 'validated';

  if (statut === 'refusee' || statut === 'rejected') return 'refused';
  if (statut === 'en_attente' || statut === 'pending') return 'pending';

  if (moderation === 'approved' || moderation === 'validated' || moderation === 'accepted') return 'validated';
  if (moderation === 'rejected' || moderation === 'refused') return 'refused';
  if (moderation === 'pending') return 'pending';

  return 'pending';
};

const mapListing = (listing, ownerMap) => {
  const ownerId = listing?.owner_id || listing?.user_id;
  const owner = ownerMap?.[ownerId] || null;

  const photos = Array?.isArray(listing?.photos)
    ? listing?.photos
    : Array?.isArray(listing?.images)
      ? listing?.images
      : [];

  return {
    ...listing,
    image: photos?.[0] || listing?.photo_url || '/assets/images/no_image.png',
    imageAlt: listing?.titre || listing?.title || 'Annonce',
    title: listing?.titre || listing?.title || 'Annonce sans titre',
    ownerPseudo: owner?.pseudo || listing?.ownerPseudo || 'Utilisateur',
    category: listing?.categorie || listing?.category || '-',
    submissionDate: listing?.created_at || listing?.submissionDate || null,
    status: normalizeListingStatus(listing),
    dailyPrice: Number(listing?.prix_jour ?? listing?.dailyPrice ?? 0) || 0,
    description: listing?.description || '-',
    refusalReason: listing?.moderation_reason || listing?.refusal_reason || null
  };
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

const AdminModeration = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [refusalListingId, setRefusalListingId] = useState(null);
  const [refusalListing, setRefusalListing] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const { data, error } = await supabase
        ?.from('annonces')
        ?.select('*')
        ?.order('created_at', { ascending: false })
        ?.limit(500);

      if (error) throw error;

      const source = Array?.isArray(data) ? data : [];
      const ownerIds = [...new Set(source?.map((listing) => listing?.owner_id || listing?.user_id)?.filter(Boolean))];

      let ownerMap = {};

      if (ownerIds?.length > 0) {
        const { data: owners, error: ownerError } = await supabase
          ?.from('profiles')
          ?.select('id, pseudo')
          ?.in('id', ownerIds);

        if (!ownerError) {
          ownerMap = (owners || [])?.reduce((acc, owner) => {
            acc[owner?.id] = owner;
            return acc;
          }, {});
        }
      }

      setListings(source?.map((listing) => mapListing(listing, ownerMap)));
    } catch (error) {
      console.error('Erreur de chargement de la moderation annonces:', error);
      setFetchError(error?.message || 'Impossible de charger les annonces');
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = useMemo(() => {
    const query = String(searchQuery || '')?.trim()?.toLowerCase();

    return (listings || [])?.filter((listing) => {
      const matchesStatus = statusFilter === 'all' || listing?.status === statusFilter;
      if (!matchesStatus) return false;

      if (!query) return true;

      const title = String(listing?.title || '')?.toLowerCase();
      const owner = String(listing?.ownerPseudo || '')?.toLowerCase();
      const category = String(listing?.category || '')?.toLowerCase();

      return title?.includes(query) || owner?.includes(query) || category?.includes(query);
    });
  }, [listings, searchQuery, statusFilter]);

  const handleViewDetails = (listing) => {
    setSelectedListing(listing);
    setShowDetailModal(true);
  };

  const handleValidate = async (listingId) => {
    try {
      setActionLoadingId(listingId);
      const { error } = await annonceService?.updateAnnonceStatus(listingId, 'publiee');
      if (error) {
        throw new Error(error?.message || 'Impossible de valider cette annonce');
      }

      const { error: queueError } = await seoRefreshQueueService?.queueAnnonceSeoRefresh({
        annonceId: listingId,
        reason: 'annonce_approved',
        payload: { trigger: 'admin_moderation_validate' }
      });

      if (queueError) {
        console.warn('Annonce validee mais refresh SEO non planifie:', queueError?.message || queueError);
      }

      await loadListings();
    } catch (error) {
      console.error('Erreur de validation annonce:', error);
      window?.alert(error?.message || 'Impossible de valider cette annonce');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRefuse = (listingOrId) => {
    const listing = typeof listingOrId === 'object'
      ? listingOrId
      : (listings || [])?.find((item) => item?.id === listingOrId) || null;

      setRefusalListingId(listing?.id || listingOrId || null);
    setRefusalListing(listing || null);
    setShowRefusalModal(true);
  };

  const handleRefusalSubmit = async (reason) => {
    try {
      setActionLoadingId(refusalListingId);
      const { error } = await annonceService?.updateAnnonceStatus(refusalListingId, 'refusee', reason);
      if (error) {
        throw new Error(error?.message || 'Impossible de refuser cette annonce');
      }
      setShowRefusalModal(false);
      setRefusalListingId(null);
      setRefusalListing(null);
      await loadListings();
    } catch (error) {
      console.error('Erreur de refus annonce:', error);
      window?.alert(error?.message || 'Impossible de refuser cette annonce');
    } finally {
      setActionLoadingId(null);
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Moderation des annonces</h1>
          <p className="text-muted-foreground">Gerez les annonces en attente de validation</p>
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
                placeholder="Titre, propriétaire, categorie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value || '')}
              />
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Annonce</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Propriétaire</th>
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
                      Chargement des annonces...
                    </td>
                  </tr>
                ) : filteredListings?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                      Aucune annonce trouvee.
                    </td>
                  </tr>
                ) : (
                  filteredListings?.map((listing) => {
                    const statusConfig = getStatusConfig(listing?.status);

                    return (
                      <tr key={listing?.id} className="hover:bg-surface transition-colors">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm line-clamp-2">{listing?.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{listing?.dailyPrice?.toFixed(2)} EUR / jour</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{listing?.ownerPseudo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{listing?.category}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-muted-foreground">{formatDate(listing?.submissionDate)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                            <Icon name={statusConfig?.icon} size={12} />
                            <span>{statusConfig?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              iconName="Eye"
                              onClick={() => handleViewDetails(listing)}
                            >
                              Voir
                            </Button>
                            {listing?.status === 'pending' && (
                              <>
                                <Button
                                  variant="success"
                                  size="xs"
                                  iconName="CheckCircle"
                                  loading={actionLoadingId === listing?.id}
                                  onClick={() => handleValidate(listing?.id)}
                                >
                                  Valider
                                </Button>
                                <Button
                                  variant="danger"
                                  size="xs"
                                  iconName="XCircle"
                                  disabled={actionLoadingId === listing?.id}
                                  onClick={() => handleRefuse(listing)}
                                >
                                  Refuser
                                </Button>
                              </>
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

      {showDetailModal && selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setShowDetailModal(false)}
          onValidate={handleValidate}
          onRefuse={handleRefuse}
        />
      )}

      {showRefusalModal && (
        <RefusalModal
          listing={refusalListing}
          loading={actionLoadingId === refusalListingId}
          onClose={() => {
            if (actionLoadingId === refusalListingId) return;
            setShowRefusalModal(false);
            setRefusalListingId(null);
            setRefusalListing(null);
          }}
          onSubmit={handleRefusalSubmit}
        />
      )}
    </div>
  );
};

export default AdminModeration;

