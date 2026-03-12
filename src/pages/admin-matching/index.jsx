import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

import demandeService from '../../services/demandeService';
import matchingService from '../../services/matchingService';
import categoryService from '../../services/categoryService';
import { construireUrlAnnonce } from '../../utils/listingUrl';
import { supabase } from '../../lib/supabase';

const AdminMatching = () => {
  const navigate = useNavigate();
  const [demandes, setDemandes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    totalDemands: 0,
    openDemands: 0,
    totalProposals: 0,
    acceptedProposals: 0,
    avgMatchScore: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDemandes(),
        loadCategories(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDemandes = async () => {
    try {
      const { data } = await demandeService?.getDemandes();
      setDemandes(data || []);
    } catch (error) {
      console.error('Load demandes error:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await categoryService?.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Load categories error:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [{ data: allDemands }, { data: proposals, error: proposalError }] = await Promise.all([
        demandeService?.getDemandes(),
        supabase
          ?.from('proposals')
          ?.select('status, match_score')
          ?.limit(10000)
      ]);

      if (proposalError) throw proposalError;

      const openDemands = allDemands?.filter((d) => d?.statut === 'open') || [];
      const proposalRows = Array?.isArray(proposals) ? proposals : [];
      const acceptedProposals = proposalRows?.filter((proposal) => {
        const status = String(proposal?.status || '')?.toLowerCase();
        return status === 'accepted';
      });
      const scoredProposals = proposalRows?.filter((proposal) => Number.isFinite(Number(proposal?.match_score)));
      const avgMatchScore = scoredProposals?.length > 0
        ? scoredProposals?.reduce((sum, proposal) => sum + Number(proposal?.match_score || 0), 0) / scoredProposals?.length
        : 0;

      setStats({
        totalDemands: allDemands?.length || 0,
        openDemands: openDemands?.length || 0,
        totalProposals: proposalRows?.length || 0,
        acceptedProposals: acceptedProposals?.length || 0,
        avgMatchScore: Number(avgMatchScore?.toFixed(1))
      });
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const handleFindMatches = async (demandeId) => {
    setSelectedDemand(demandeId);
    setMatchesLoading(true);
    try {
      const { data } = await matchingService?.findMatchesForDemand(demandeId);
      setMatches(data || []);
    } catch (error) {
      console.error('Find matches error:', error);
      alert('Erreur lors de la recherche de correspondances');
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleCreateProposal = async (demandeId, offerId, matchScore) => {
    if (!confirm('Créer une proposition pour cette correspondance ?')) {
      return;
    }

    try {
      await matchingService?.createProposal(
        demandeId,
        offerId,
        matchScore,
        'Proposition créée manuellement par l\'administrateur'
      );
      alert('Proposition créée avec succès');
      setSelectedDemand(null);
      setMatches([]);
    } catch (error) {
      console.error('Create proposal error:', error);
      alert('Erreur lors de la création de la proposition');
    }
  };

  const handleRunAutomaticMatching = async () => {
    if (!confirm('Lancer le matching automatique pour toutes les demandes ouvertes ?')) {
      return;
    }

    setProcessing(true);
    try {
      const { data } = await matchingService?.runAutomaticMatching();
      const totalProposals = data?.reduce((sum, r) => sum + (r?.proposalsCreated || 0), 0);
      alert(`Matching terminé ! ${totalProposals} propositions créées pour ${data?.length} demandes.`);
      loadStats();
    } catch (error) {
      console.error('Run automatic matching error:', error);
      alert('Erreur lors du matching automatique');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString)?.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (statut, moderationStatus) => {
    if (moderationStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-warning/10 text-warning text-xs rounded-full">
          <Icon name="Clock" size={12} />
          En attente
        </span>
      );
    }

    if (moderationStatus === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-error/10 text-error text-xs rounded-full">
          <Icon name="XCircle" size={12} />
          Refusée
        </span>
      );
    }

    if (statut === 'open') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs rounded-full">
          <Icon name="CheckCircle" size={12} />
          Ouverte
        </span>
      );
    }

    if (statut === 'closed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
          <Icon name="Lock" size={12} />
          Clôturée
        </span>
      );
    }

    return null;
  };

  const filteredDemandes = demandes?.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'open') return d?.statut === 'open';
    if (filter === 'pending') return d?.moderation_status === 'pending';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Icon name="Loader" size={48} className="animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  // Matches View
  if (selectedDemand) {
    const demand = demandes?.find(d => d?.id === selectedDemand);

    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />

        <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8">
          <div className="mb-4">
            <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
              <Icon name="ArrowLeft" size={16} />
              Retour au tableau de bord
            </Link>
          </div>

          <button
            onClick={() => {
              setSelectedDemand(null);
              setMatches([]);
            }}
            className="flex items-center gap-2 text-primary hover:text-primary-dark mb-6 transition-colors"
          >
            <Icon name="ArrowLeft" size={20} />
            <span>Retour aux demandes</span>
          </button>

          {/* Demand Details */}
          <div className="bg-white rounded-lg shadow-elevation-2 p-6 mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4">{demand?.titre}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Icon name="MapPin" size={16} className="text-muted-foreground" />
                <span>{demand?.ville} ({demand?.rayon_km} km)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                <span>Max {demand?.prix_max}€/jour</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Icon name="Calendar" size={16} className="text-muted-foreground" />
                <span>{formatDate(demand?.dispo_de)} - {formatDate(demand?.dispo_a)}</span>
              </div>
            </div>
          </div>

          {/* Matches */}
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Correspondances trouvées ({matches?.length})
          </h3>

          {matchesLoading && (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader" size={32} className="animate-spin text-primary" />
            </div>
          )}

          {!matchesLoading && matches?.length === 0 && (
            <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
              <Icon name="Search" size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Aucune correspondance
              </h3>
              <p className="text-muted-foreground">
                Aucune offre ne correspond aux critères de cette demande
              </p>
            </div>
          )}

          {!matchesLoading && matches?.length > 0 && (
            <div className="space-y-4">
              {matches?.map((match, index) => (
                <div key={index} className="bg-white rounded-lg shadow-elevation-1 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-foreground mb-2">
                        {match?.offer?.titre}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {match?.factors?.categoryMatch && (
                          <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                            Catégorie
                          </span>
                        )}
                        {match?.factors?.locationMatch && (
                          <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                            Localisation
                          </span>
                        )}
                        {match?.factors?.priceCompatible && (
                          <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                            Prix
                          </span>
                        )}
                        {match?.factors?.availabilityOverlap && (
                          <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                            Disponibilité
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-success mb-1">
                        {Math.round(match?.score)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="MapPin" size={16} className="text-muted-foreground" />
                      <span>{match?.offer?.city || match?.offer?.ville}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                      <span>{match?.offer?.prix_jour}€/jour</span>
                    </div>
                    {match?.factors?.distance !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        <Icon name="Navigation" size={16} className="text-muted-foreground" />
                        <span>{Math.round(match?.factors?.distance)} km</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => handleCreateProposal(selectedDemand, match?.offer?.id, match?.score)}
                    >
                      Créer une proposition
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(construireUrlAnnonce(match?.offer))}
                    >
                      Voir l'offre
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
  }

  // Main View
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
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Système de matching automatique
          </h1>
          <p className="text-muted-foreground">
            Gestion intelligente du matching demandes-offres
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Demandes totales</span>
              <Icon name="FileText" size={20} className="text-primary" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.totalDemands}</div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Demandes ouvertes</span>
              <Icon name="CheckCircle" size={20} className="text-success" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.openDemands}</div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Propositions totales</span>
              <Icon name="Send" size={20} className="text-[#17a2b8]" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.totalProposals}</div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Taux d'acceptation</span>
              <Icon name="TrendingUp" size={20} className="text-warning" />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {stats?.totalProposals > 0 
                ? Math.round((stats?.acceptedProposals / stats?.totalProposals) * 100)
                : 0}%
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-elevation-2 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Matching automatique
              </h3>
              <p className="text-sm text-muted-foreground">
                Lance l'algorithme de matching pour toutes les demandes ouvertes
              </p>
            </div>
            <Button
              onClick={handleRunAutomaticMatching}
              disabled={processing}
              className="flex items-center gap-2"
            >
              {processing ? (
                <>
                  <Icon name="Loader" size={18} className="animate-spin" />
                  <span>Traitement...</span>
                </>
              ) : (
                <>
                  <Icon name="Zap" size={18} />
                  <span>Lancer le matching</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' ?'bg-primary text-white' :'bg-white text-foreground hover:bg-muted'
            }`}
          >
            Toutes
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'open' ?'bg-primary text-white' :'bg-white text-foreground hover:bg-muted'
            }`}
          >
            Ouvertes
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'pending' ?'bg-primary text-white' :'bg-white text-foreground hover:bg-muted'
            }`}
          >
            En attente de modération
          </button>
        </div>

        {/* Demands List */}
        <div className="space-y-4">
          {filteredDemandes?.map((demande) => (
            <div key={demande?.id} className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {demande?.titre}
                  </h3>
                  {getStatusBadge(demande?.statut, demande?.moderation_status)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="Tag" size={16} className="text-muted-foreground" />
                  <span>{demande?.categorie_slug || 'Non spécifié'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="MapPin" size={16} className="text-muted-foreground" />
                  <span>{demande?.ville} ({demande?.rayon_km} km)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                  <span>Max {demande?.prix_max}€/jour</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="Calendar" size={16} className="text-muted-foreground" />
                  <span>{formatDate(demande?.dispo_de)} - {formatDate(demande?.dispo_a)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  size="sm"
                  onClick={() => handleFindMatches(demande?.id)}
                  disabled={demande?.statut !== 'open'}
                >
                  <Icon name="Search" size={16} />
                  <span>Trouver des correspondances</span>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredDemandes?.length === 0 && (
          <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
            <Icon name="Inbox" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune demande
            </h3>
            <p className="text-muted-foreground">
              Aucune demande ne correspond aux filtres sélectionnés
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AdminMatching;



