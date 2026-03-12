import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import demandeService from '../../../services/demandeService';
import matchingService from '../../../services/matchingService';
import { useAuth } from '../../../contexts/AuthContext';

const DemandesTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [proposals, setProposals] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDemand, setSelectedDemand] = useState(null);
  const [demandProposals, setDemandProposals] = useState([]);

  useEffect(() => {
    if (user) {
      loadDemandes();
    }
  }, [user]);

  const loadDemandes = async () => {
    setLoading(true);
    try {
      const { data } = await demandeService?.getUserDemandes(user?.id);
      setDemandes(data || []);
      
      // Load proposals for each demand
      const proposalsMap = {};
      for (const demand of data || []) {
        const { data: props } = await matchingService?.getProposalsForDemand(demand?.id);
        proposalsMap[demand?.id] = props || [];
      }
      setProposals(proposalsMap);
    } catch (error) {
      console.error('Erreur lors du chargement de demandes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProposals = async (demandId) => {
    setSelectedDemand(demandId);
    const { data } = await matchingService?.getProposalsForDemand(demandId);
    setDemandProposals(data || []);
  };

  const handleAcceptProposal = async (proposalId) => {
    if (!confirm('Accepter cette proposition ? Une réservation sera créée automatiquement.')) {
      return;
    }

    try {
      await matchingService?.acceptProposal(proposalId);
      alert('Proposition acceptée ! Une réservation a été créée.');
      loadDemandes();
      setSelectedDemand(null);
    } catch (error) {
      console.error("Erreur lors de l'acceptation de la proposition :", error);
      alert('Erreur lors de l\'acceptation de la proposition');
    }
  };

  const handleDeclineProposal = async (proposalId) => {
    if (!confirm('Refuser cette proposition ?')) {
      return;
    }

    try {
      await matchingService?.declineProposal(proposalId);
      alert('Proposition refusée');
      loadDemandes();
      handleViewProposals(selectedDemand);
    } catch (error) {
      console.error('Erreur lors du refus de la proposition :', error);
      alert('Erreur lors du refus de la proposition');
    }
  };

  const handleCloseDemande = async (demandeId) => {
    if (!confirm('Êtes-vous sûr de vouloir clôturer cette demande ?')) {
      return;
    }

    try {
      await demandeService?.closeDemande(demandeId);
      loadDemandes();
      alert('Demande clôturée avec succès');
    } catch (error) {
      console.error('Erreur lors de la clôture de la demande :', error);
      alert('Erreur lors de la clôture de la demande');
    }
  };

  const handleDeleteDemande = async (demandeId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette demande ? Cette action est irréversible.')) {
      return;
    }

    try {
      await demandeService?.deleteDemande(demandeId);
      loadDemandes();
      alert('Demande supprimée avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de la demande :', error);
      alert('Erreur lors de la suppression de la demande');
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
          En attente de modération
        </span>
      );
    }

    if (moderationStatus === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-danger/10 text-danger text-xs rounded-full">
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

  const getProposalStatusBadge = (status) => {
    const statusConfig = {
      sent: { label: 'En attente', color: 'bg-[#17a2b8]/10 text-[#17a2b8]', icon: 'Clock' },
      accepted: { label: 'Acceptée', color: 'bg-success/10 text-success', icon: 'CheckCircle' },
      declined: { label: 'Refusée', color: 'bg-danger/10 text-danger', icon: 'XCircle' }
    };

    const config = statusConfig?.[status] || statusConfig?.sent;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 ${config?.color} text-xs rounded-full`}>
        <Icon name={config?.icon} size={12} />
        {config?.label}
      </span>
    );
  };

  const filteredDemandes = demandes?.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'open') return d?.statut === 'open';
    if (filter === 'closed') return d?.statut === 'closed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  // Proposals Modal
  if (selectedDemand) {
    return (
      <div>
        <button
          onClick={() => setSelectedDemand(null)}
          className="flex items-center gap-2 text-primary hover:text-primary-dark mb-4 transition-colors"
        >
          <Icon name="ArrowLeft" size={20} />
          <span>Retour aux demandes</span>
        </button>

        <h2 className="text-xl font-bold text-foreground mb-4">Propositions reçues</h2>

        {demandProposals?.length === 0 ? (
          <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
            <Icon name="Inbox" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucune proposition</h3>
            <p className="text-muted-foreground">Vous n'avez pas encore reçu de proposition pour cette demande</p>
          </div>
        ) : (
          <div className="space-y-4">
            {demandProposals?.map((proposal) => (
              <div key={proposal?.id} className="bg-white rounded-lg shadow-elevation-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {proposal?.offer?.titre}
                    </h3>
                    {getProposalStatusBadge(proposal?.status)}
                  </div>
                  {proposal?.match_score && (
                    <span className="px-3 py-1 bg-success/10 text-success text-sm rounded-full font-semibold">
                      {Math.round(proposal?.match_score)}% match
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {proposal?.offer?.ville && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="MapPin" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">{proposal?.offer?.ville}</span>
                    </div>
                  )}
                  {proposal?.offer?.prix_jour && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">{proposal?.offer?.prix_jour}€/jour</span>
                    </div>
                  )}
                  {proposal?.proposer && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="User" size={16} className="text-muted-foreground" />
                      <span className="text-foreground">{proposal?.proposer?.pseudo}</span>
                    </div>
                  )}
                </div>

                {proposal?.note && (
                  <p className="text-sm text-muted-foreground mb-4 p-3 bg-surface rounded">
                    {proposal?.note}
                  </p>
                )}

                {proposal?.status === 'sent' && (
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button
                      onClick={() => handleAcceptProposal(proposal?.id)}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <Icon name="CheckCircle" size={18} />
                      Accepter
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDeclineProposal(proposal?.id)}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <Icon name="XCircle" size={18} />
                      Refuser
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Mes demandes</h2>
          <p className="text-sm text-muted-foreground">Gérez vos demandes d'équipement</p>
        </div>
        <Button onClick={() => navigate('/creer-demande')} className="flex items-center gap-2">
          <Icon name="Plus" size={18} />
          Créer une demande
        </Button>
      </div>
      {/* Filtres */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'all' ?'bg-primary text-white' :'bg-white text-foreground border border-border hover:bg-surface'
          }`}
        >
          Toutes ({demandes?.length || 0})
        </button>
        <button
          onClick={() => setFilter('open')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'open' ?'bg-primary text-white' :'bg-white text-foreground border border-border hover:bg-surface'
          }`}
        >
          Ouvertes ({demandes?.filter((d) => d?.statut === 'open')?.length || 0})
        </button>
        <button
          onClick={() => setFilter('closed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'closed' ?'bg-primary text-white' :'bg-white text-foreground border border-border hover:bg-surface'
          }`}
        >
          Clôturées ({demandes?.filter((d) => d?.statut === 'closed')?.length || 0})
        </button>
      </div>
      {/* Liste des demandes */}
      {filteredDemandes?.length === 0 ? (
        <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
          <Icon name="Search" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Aucune demande</h3>
          <p className="text-muted-foreground mb-4">
            {filter === 'all' ? "Vous n'avez pas encore créé de demande" : `Vous n'avez aucune demande ${filter === 'open' ? 'ouverte' : 'clôturée'}`}
          </p>
          <Button onClick={() => navigate('/creer-demande')}>
            <Icon name="Plus" size={18} className="mr-2" />
            Créer ma première demande
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDemandes?.map((demande) => (
            <div key={demande?.id} className="bg-white rounded-lg shadow-elevation-1 p-4 md:p-6">
              {/* En-tête */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{demande?.titre}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(demande?.statut, demande?.moderation_status)}
                    {demande?.categorie_slug && (
                      <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                        {demande?.categorie_slug}
                      </span>
                    )}
                    {proposals?.[demande?.id]?.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#17a2b8]/10 text-[#17a2b8] text-xs rounded-full">
                        <Icon name="Mail" size={12} />
                        {proposals?.[demande?.id]?.length} proposition{proposals?.[demande?.id]?.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{demande?.description}</p>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {demande?.ville && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="MapPin" size={16} className="text-muted-foreground" />
                    <span className="text-foreground">
                      {demande?.ville} ({demande?.rayon_km} km)
                    </span>
                  </div>
                )}

                {demande?.prix_max && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                    <span className="text-foreground">Max: {demande?.prix_max}€/jour</span>
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

                <div className="flex items-center gap-2 text-sm">
                  <Icon name="Clock" size={16} className="text-muted-foreground" />
                  <span className="text-foreground">Créée le {formatDate(demande?.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {proposals?.[demande?.id]?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewProposals(demande?.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon name="Eye" size={16} />
                    Voir les propositions ({proposals?.[demande?.id]?.length})
                  </Button>
                )}
                {demande?.statut === 'open' && demande?.moderation_status === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCloseDemande(demande?.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon name="Lock" size={16} />
                    Clôturer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteDemande(demande?.id)}
                  className="flex items-center gap-2 text-danger hover:bg-danger/10"
                >
                  <Icon name="Trash2" size={16} />
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DemandesTab;


