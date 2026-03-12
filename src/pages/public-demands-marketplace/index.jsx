import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import demandeService from '../../services/demandeService';
import categoryService from '../../services/categoryService';
import { setStoredCity } from '../../utils/cityPrefill';

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

const PublicDemandsMarketplace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [demandes, setDemandes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFiltres] = useState({
    text: '',
    categorie_slug: '',
    ville: '',
    sortBy: 'recent'
  });

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
        statut: 'open'
      });

      const searchText = normalizeSearchValue(filters?.text);
      const searchCity = normalizeSearchValue(filters?.ville);
      const selectedCategory = filters?.categorie_slug;

      let filteredData = data || [];

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

      setDemandes(sortedData);
    } catch (error) {
      console.error('Load demandes error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFiltres(prev => ({ ...prev, [field]: value }));
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
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Demandes de location
          </h1>
          <p className="text-muted-foreground">
            Découvrez les équipements recherchés par nos utilisateurs
          </p>
        </div>

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
                onChange={(e) => handleFilterChange('categorie_slug', e?.target?.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ville
              </label>
              <input
                type="text"
                name="city"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: Paris"
                value={filters?.ville}
                onChange={(e) => {
                  const nextCity = e?.target?.value;
                  handleFilterChange('ville', nextCity);
                  setStoredCity(nextCity);
                }}
                autoComplete="address-level2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Trier par
              </label>
              <Select
                options={sortOptions}
                value={filters?.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e?.target?.value)}
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
                className="bg-white rounded-lg shadow-elevation-1 hover:shadow-elevation-3 transition-shadow p-6"
              >
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
                    onClick={() => {
                      // In production, this would open a modal to propose an offer
                      alert('Fonctionnalité de proposition à venir');
                    }}
                  >
                    Proposer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PublicDemandsMarketplace;

