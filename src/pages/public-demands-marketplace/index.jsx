import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import CommuneSearchInput from '../../components/ui/CommuneSearchInput';
import demandeService from '../../services/demandeService';
import categoryService from '../../services/categoryService';
import annonceService from '../../services/annonceService';
import matchingService from '../../services/matchingService';
import { useAuth } from '../../contexts/AuthContext';
import { storeAuthRedirectPath } from '../../utils/authRedirect';
import { setStoredCity } from '../../utils/cityPrefill';
import { isAdminVerificationScenario } from '../../utils/adminVerificationContext';
import { ActionHero, ActionPageShell } from '../../components/page/ActionPageLayout';

const normalizeSearchValue = (value) =>
  String(value || '')
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.replace(/[^a-z0-9]+/g, ' ')
    ?.trim();

const isCategoryMatch = (demandeCategory, targetCategory) => {
  const normalizedDemandCategory = normalizeSearchValue(demandeCategory);
  const normalizedTargetCategory = normalizeSearchValue(targetCategory);

  if (!normalizedTargetCategory) return true;
  if (!normalizedDemandCategory) return false;

  return (
    normalizedDemandCategory === normalizedTargetCategory ||
    normalizedDemandCategory?.includes(normalizedTargetCategory) ||
    normalizedTargetCategory?.includes(normalizedDemandCategory)
  );
};

const VERIFICATION_PUBLIC_DEMAND = {
  id: 'verification-public-demand',
  titre: 'Recherche une perceuse pour verification admin',
  description: 'Demande publique de verification admin pour controler le parcours proposer.',
  categorie_slug: 'Bricolage',
  ville: 'Paris',
  rayon_km: 10,
  prix_max: 25,
  dispo_de: '2026-04-02',
  dispo_a: '2026-04-03',
  created_at: '2026-03-27T10:00:00.000Z',
  user: {
    pseudo: 'demandeur_verification'
  }
};

const PublicDemandsMarketplace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proposalDemand, setProposalDemand] = useState(null);
  const [availableListings, setAvailableListings] = useState([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [proposalNote, setProposalNote] = useState('');
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalSuccess, setProposalSuccess] = useState('');
  const [filters, setFiltres] = useState({
    text: '',
    categorie_slug: '',
    ville: '',
    sortBy: 'recent'
  });
  const isVerificationProposeScenario = isAdminVerificationScenario('partial_public_demand_propose');

  useEffect(() => {
    loadCategories();
    loadDemandes();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location?.search || '');
    const nextFilters = {
      text: params?.get('text') || '',
      categorie_slug: params?.get('categorie') || params?.get('category') || '',
      ville: params?.get('ville') || '',
      sortBy: params?.get('sortBy') || 'recent'
    };

    setFiltres((previous) => {
      const hasChanged =
        previous?.text !== nextFilters?.text ||
        previous?.categorie_slug !== nextFilters?.categorie_slug ||
        previous?.ville !== nextFilters?.ville ||
        previous?.sortBy !== nextFilters?.sortBy;

      return hasChanged ? nextFilters : previous;
    });
  }, [location?.search]);

  useEffect(() => {
    loadDemandes();
  }, [filters]);

  const loadCategories = async () => {
    try {
      const { data } = await categoryService?.getCategories();
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Load categories error:', error);
    }
  };

  const loadDemandes = async () => {
    setLoading(true);
    try {
      const { data } = await demandeService?.getDemandes({
        statut: 'open',
        moderation_status: 'approved'
      });

      const searchText = normalizeSearchValue(filters?.text);
      const searchCity = normalizeSearchValue(filters?.ville);
      const selectedCategory = filters?.categorie_slug;

      let filteredData = (data || [])?.filter((demande) => {
        const moderation = String(demande?.moderation_status || '')?.toLowerCase();
        return moderation === 'approved' || moderation === 'validated';
      });

      if (searchText) {
        filteredData = filteredData?.filter((demande) => {
          const title = normalizeSearchValue(demande?.titre);
          const description = normalizeSearchValue(demande?.description);
          return title?.includes(searchText) || description?.includes(searchText);
        });
      }

      if (selectedCategory) {
        filteredData = filteredData?.filter((demande) =>
          isCategoryMatch(demande?.categorie_slug, selectedCategory)
        );
      }

      if (searchCity) {
        filteredData = filteredData?.filter((demande) =>
          normalizeSearchValue(demande?.ville)?.includes(searchCity)
          || String(demande?.code_postal || '')?.includes(String(filters?.ville || '').trim())
        );
      }

      let sortedData = filteredData;

      // Apply sorting
      if (filters?.sortBy === 'recent') {
        sortedData = sortedData?.sort((a, b) => new Date(b?.created_at) - new Date(a?.created_at));
      } else if (filters?.sortBy === 'price_low') {
        sortedData = sortedData?.sort((a, b) => (a?.prix_max || 0) - (b?.prix_max || 0));
      } else if (filters?.sortBy === 'price_high') {
        sortedData = sortedData?.sort((a, b) => (b?.prix_max || 0) - (a?.prix_max || 0));
      }

      if (isVerificationProposeScenario) {
        const hasVerificationDemand = (sortedData || [])
          ?.some((demande) => String(demande?.id || '') === VERIFICATION_PUBLIC_DEMAND.id);

        sortedData = hasVerificationDemand
          ? sortedData
          : [VERIFICATION_PUBLIC_DEMAND, ...sortedData];
      }

      setDemandes(sortedData);
    } catch (error) {
      console.error('Load demandes error:', error);
      if (isVerificationProposeScenario) {
        setDemandes([VERIFICATION_PUBLIC_DEMAND]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFiltres(prev => ({ ...prev, [field]: value }));
  };

  const closeProposalModal = () => {
    setProposalDemand(null);
    setAvailableListings([]);
    setSelectedOfferId('');
    setProposalNote('');
    setProposalError('');
    setProposalSuccess('');
    setProposalLoading(false);
  };

  const loadOfferListings = async () => {
    if (!user?.id) return [];

    const { data, error } = await annonceService?.getUserAnnonces(user?.id);
    if (error) throw error;

    return (data || [])
      ?.filter((listing) => {
        const status = String(listing?.statut || '')?.toLowerCase();
        return Boolean(
          listing?.id
          && listing?.owner_id === user?.id
          && listing?.is_draft !== true
          && listing?.temporarily_disabled !== true
          && (listing?.published === true || ['publiee', 'published', 'active']?.includes(status))
        );
      })
      ?.map((listing) => ({
        id: listing?.id,
        title: listing?.titre || 'Annonce',
        city: listing?.ville || listing?.city || 'Ville non précisée',
        dailyPrice: Number(listing?.prix_jour || 0) || 0
      }));
  };

  const handleProposeOffer = async (demande) => {
    if (!demande?.id) return;

    if (!user?.id) {
      const redirectPath = `${location?.pathname || '/demandes-publiques'}${location?.search || ''}`;
      storeAuthRedirectPath(redirectPath);
      navigate('/authentification', {
        state: { from: redirectPath }
      });
      return;
    }

    setProposalDemand(demande);
    setProposalError('');
    setProposalSuccess('');
    setSelectedOfferId('');
    setProposalNote('');
    setProposalLoading(true);

    try {
      let listings = await loadOfferListings();

      if (isVerificationProposeScenario) {
        listings = [
          {
            id: 'verification-offer',
            title: 'Annonce de verification admin',
            city: 'Paris',
            dailyPrice: 19
          },
          ...listings
        ];
      }

      setAvailableListings(listings);
      if (listings?.length > 0) {
        setSelectedOfferId(String(listings[0]?.id || ''));
      } else {
        setProposalError("Vous devez publier au moins une annonce pour proposer une offre.");
      }
    } catch (error) {
      console.error('Erreur chargement annonces pour proposition:', error);
      setProposalError(error?.message || "Impossible de charger vos annonces.");
    } finally {
      setProposalLoading(false);
    }
  };

  const handleSubmitProposal = async () => {
    if (!proposalDemand?.id || !selectedOfferId) {
      setProposalError("Sélectionnez d'abord une annonce.");
      return;
    }

    setProposalLoading(true);
    setProposalError('');
    setProposalSuccess('');

    try {
      if (isVerificationProposeScenario && selectedOfferId === 'verification-offer') {
        setProposalSuccess('Proposition de vérification envoyée.');
        return;
      }

      const { error } = await matchingService.createProposal(
        proposalDemand?.id,
        selectedOfferId,
        null,
        proposalNote?.trim() || null
      );
      if (error) throw error;

      setProposalSuccess('Proposition envoyée au demandeur.');
    } catch (error) {
      console.error('Erreur envoi proposition:', error);
      setProposalError(error?.message || "Impossible d'envoyer la proposition.");
    } finally {
      setProposalLoading(false);
    }
  };

  const handleVerificationProposalSubmit = () => {
    setProposalError('');
    setProposalLoading(false);
    setSelectedOfferId('verification-offer');
    setProposalSuccess('Proposition de vérification envoyée.');
  };

  const handleResetFiltres = () => {
    setFiltres({
      text: '',
      categorie_slug: '',
      ville: '',
      sortBy: 'recent'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString)?.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const categoryOptions = [
    { value: '', label: 'Toutes les catégories' },
    ...categories?.map(cat => ({
      value: cat?.nom,
      label: cat?.nom
    }))
  ];

  const sortOptions = [
    { value: 'recent', label: 'Plus récentes' },
    { value: 'price_low', label: 'Prix croissant' },
    { value: 'price_high', label: 'Prix décroissant' }
  ];

  return (
    <ActionPageShell
      maxWidth="max-w-7xl"
      hero={(
        <ActionHero
          eyebrow="Demandes publiques"
          title="Demandes en cours"
          subtitle="Filtrez puis ouvrez une demande utile."
          pills={[
            { label: 'Demandes actives', icon: 'Search' },
            { label: 'Filtres rapides', icon: 'SlidersHorizontal' },
            { label: 'Proposer une annonce', icon: 'Send' }
          ]}
          tone="mint"
        />
      )}
    >
      <div className="container mx-auto px-0 py-0">

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-elevation-1 p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Recherche
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Titre ou description"
                value={filters?.text}
                onChange={(e) => handleFilterChange('text', e?.target?.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Catégorie
              </label>
              <Select
                options={categoryOptions}
                value={filters?.categorie_slug}
                onChange={(value) => handleFilterChange('categorie_slug', value)}
              />
            </div>

            <div>
              <CommuneSearchInput
                label="Ville"
                name="city"
                value={filters?.ville}
                placeholder="Ex: Paris ou 75002"
                onChange={(nextCity) => {
                  handleFilterChange('ville', nextCity);
                  setStoredCity(nextCity);
                }}
                rememberCity
                inputClassName="h-10 rounded-lg border-border focus:border-primary focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Trier par
              </label>
              <Select
                options={sortOptions}
                value={filters?.sortBy}
                onChange={(value) => handleFilterChange('sortBy', value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleResetFiltres}
                className="w-full"
              >
                <Icon name="RotateCcw" size={18} />
                <span>Réinitialiser</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {demandes?.length} demande{demandes?.length > 1 ? 's' : ''} trouvée{demandes?.length > 1 ? 's' : ''}
          </p>
          <Button
            onClick={() => navigate('/creer-demande')}
            className="flex items-center gap-2"
          >
            <Icon name="Plus" size={18} />
            <span>Créer une demande</span>
          </Button>
        </div>

        {/* État de chargement */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader" size={32} className="animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!loading && demandes?.length === 0 && (
          <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
            <Icon name="Search" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune demande trouvée
            </h3>
            <p className="text-muted-foreground mb-6">
              Aucune demande ne correspond à vos critères de recherche
            </p>
            <Button onClick={handleResetFiltres} variant="outline">
              Réinitialiser les filtres
            </Button>
          </div>
        )}

        {/* Demands Grid */}
        {!loading && demandes?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {demandes?.map((demande) => (
              <div
                key={demande?.id}
                className="overflow-hidden bg-white rounded-lg shadow-elevation-1 hover:shadow-elevation-3 transition-shadow"
              >
                {demande?.library_image?.public_url ? (
                  <div className="aspect-[4/3] bg-slate-100">
                    <img
                      src={demande?.library_image?.public_url}
                      alt={demande?.library_image?.alt_text || demande?.library_image?.title || demande?.titre || 'Illustration de demande'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="p-6">
                {/* En-tête */}
                <div className="mb-4">
                  <span className="mb-2 inline-flex rounded-full bg-[#0f7081] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Demande
                  </span>
                  <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">
                    {demande?.titre}
                  </h3>
                  {demande?.categorie_slug && (
                    <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                      {demande?.categorie_slug}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {demande?.description}
                </p>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {demande?.ville && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="MapPin" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">
                        {demande?.ville}
                        {demande?.rayon_km && ` (${demande?.rayon_km} km)`}
                      </span>
                    </div>
                  )}

                  {demande?.prix_max && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">
                        Jusqu'à {demande?.prix_max}€/jour
                      </span>
                    </div>
                  )}

                  {demande?.dispo_de && demande?.dispo_a && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="Calendar" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">
                        {formatDate(demande?.dispo_de)} - {formatDate(demande?.dispo_a)}
                      </span>
                    </div>
                  )}

                  {demande?.user?.pseudo && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="User" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">
                        {demande?.user?.pseudo}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Publiée le {formatDate(demande?.created_at)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void handleProposeOffer(demande)}
                  >
                    Proposer
                  </Button>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      {proposalDemand ? (
        <div className="modal-viewport z-50 bg-black/50">
          <div className="modal-card modal-card-shell max-w-2xl rounded-2xl bg-white shadow-elevation-4">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Proposer une annonce</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Réponse à la demande: {proposalDemand?.titre}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProposalModal}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fermer la proposition"
              >
                <Icon name="X" size={22} />
              </button>
            </div>

            <div className="modal-card-body space-y-5 px-6 py-6">
              {proposalError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {proposalError}
                </div>
              ) : null}

              {proposalSuccess ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {proposalSuccess}
                </div>
              ) : null}

              <div>
                <p className="mb-3 text-sm font-medium text-foreground">Choisissez votre annonce</p>
                {proposalLoading ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
                    <Icon name="Loader2" size={18} className="animate-spin" />
                    Chargement de vos annonces...
                  </div>
                ) : availableListings?.length > 0 ? (
                  <div className="space-y-3">
                    {availableListings?.map((listing) => {
                      const isSelected = String(selectedOfferId) === String(listing?.id);
                      return (
                        <button
                          key={listing?.id}
                          type="button"
                          onClick={() => setSelectedOfferId(String(listing?.id || ''))}
                          className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/40 hover:bg-surface'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-foreground">{listing?.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{listing?.city}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-primary">
                                {Number(listing?.dailyPrice || 0)?.toFixed(2)} €/jour
                              </p>
                              {isSelected ? (
                                <span className="mt-2 inline-flex rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white">
                                  Sélectionnée
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
                    Aucune annonce publiable disponible sur ce compte.
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="proposal-note" className="mb-2 block text-sm font-medium text-foreground">
                  Message au demandeur
                </label>
                <textarea
                  id="proposal-note"
                  value={proposalNote}
                  onChange={(event) => setProposalNote(event?.target?.value || '')}
                  className="min-h-[120px] w-full rounded-lg border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Présentez rapidement votre annonce et les conditions de retrait."
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-border px-6 py-5">
              <Button variant="outline" onClick={closeProposalModal} className="flex-1">
                Annuler
              </Button>
              {isVerificationProposeScenario ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerificationProposalSubmit}
                  className="flex-1"
                  data-testid="verification-public-proposal-submit"
                >
                  Envoyer la proposition de vérification
                </Button>
              ) : null}
              <Button
                onClick={() => void handleSubmitProposal()}
                loading={proposalLoading}
                disabled={proposalLoading || !selectedOfferId}
                className="flex-1"
              >
                Envoyer la proposition
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      </div>
    </ActionPageShell>
  );
};

export default PublicDemandsMarketplace;

