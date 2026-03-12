import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import annonceService from '../../../services/annonceService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import normaliserAnnonce from '../../../utils/annonceNormalizer';

const ListingsTab = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchListings();
    }
  }, [user?.id]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const { data, error } = await annonceService?.getAnnonces({ owner_id: user?.id });

      if (error) throw error;
      const normalisees = (data || [])?.map((annonce) => normaliserAnnonce(annonce));
      setListings(normalisees);
    } catch (error) {
      console.error('Erreur lors du chargement de listings:', error);
      toast?.error('Erreur lors du chargement des annonces');
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette annonce ?')) return;

    try {
      const { error } = await annonceService?.deleteAnnonce(id);
      if (error) throw error;

      toast?.success('Annonce supprimee avec succes');
      fetchListings();
    } catch (error) {
      console.error('Delete error:', error);
      toast?.error('Erreur lors de la suppression');
    }
  };

  const handleTogglePublish = async (id, currentStatus) => {
    try {
      const isPublished = currentStatus === 'publiee' || currentStatus === 'published';
      const newStatus = isPublished ? 'archivee' : 'publiee';
      const { error } = await annonceService?.updateAnnonce(id, {
        statut: newStatus,
        published: newStatus === 'publiee'
      });

      if (error) throw error;

      toast?.success(newStatus === 'publiee' ? 'Annonce publiee' : 'Annonce archivee');
      fetchListings();
    } catch (error) {
      console.error('Toggle publish error:', error);
      toast?.error('Erreur lors de la modification');
    }
  };

  const getStatusConfig = (statut) => {
    const configs = {
      publiee: {
        label: 'Publiee',
        icon: 'CheckCircle',
        color: 'text-success bg-success/10'
      },
      published: {
        label: 'Publiee',
        icon: 'CheckCircle',
        color: 'text-success bg-success/10'
      },
      en_attente: {
        label: 'En attente validation',
        icon: 'Clock',
        color: 'text-warning bg-warning/10'
      },
      pending: {
        label: 'En attente validation',
        icon: 'Clock',
        color: 'text-warning bg-warning/10'
      },
      refusee: {
        label: 'Refusee',
        icon: 'XCircle',
        color: 'text-error bg-error/10'
      },
      rejected: {
        label: 'Refusee',
        icon: 'XCircle',
        color: 'text-error bg-error/10'
      },
      archivee: {
        label: 'Archivee',
        icon: 'Archive',
        color: 'text-muted-foreground bg-muted'
      },
      draft: {
        label: 'Brouillon',
        icon: 'Edit',
        color: 'text-muted-foreground bg-muted'
      }
    };
    return configs?.[statut] || configs?.draft;
  };

  const filteredListings = filter === 'all' ? listings : listings?.filter((l) => l?.statut === filter);

  const filters = [
    { id: 'all', label: 'Toutes' },
    { id: 'publiee', label: 'Publiees' },
    { id: 'en_attente', label: 'En attente' },
    { id: 'archivee', label: 'Archivees' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Icon name="Loader" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {filters?.map((f) => (
            <button
              key={f?.id}
              onClick={() => setFilter(f?.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f?.id
                  ? 'bg-[#17a2b8] text-white'
                  : 'bg-surface text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f?.label}
            </button>
          ))}
        </div>
        <Button
          iconName="Plus"
          className="bg-[#17a2b8] hover:bg-[#138496]"
          onClick={() => navigate('/creer-annonce')}
        >
          Creer une annonce
        </Button>
      </div>

      {filteredListings?.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="Package" size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Aucune annonce trouvee</p>
          <Button
            iconName="Plus"
            className="bg-[#17a2b8] hover:bg-[#138496]"
            onClick={() => navigate('/creer-annonce')}
          >
            Creer votre premiere annonce
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings?.map((listing) => {
            const status = getStatusConfig(listing?.statut);
            const mainPhoto = listing?.image || '/assets/images/no_image.png';

            return (
              <div key={listing?.id} className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
                <div className="relative h-48">
                  <Image
                    src={mainPhoto}
                    alt={listing?.titre || 'Annonce'}
                    className="w-full h-full object-cover"
                  />
                  <div className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status?.color}`}>
                    <Icon name={status?.icon} size={14} />
                    {status?.label}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{listing?.titre}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{listing?.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-[#17a2b8]">{Number(listing?.prix_jour || 0)?.toFixed(2)}€/jour</span>
                    <span className="text-sm text-muted-foreground">{listing?.categorie}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      iconName="Edit"
                      onClick={() => navigate(`/edit-listing/${listing?.id}`)}
                      className="flex-1"
                    >
                      Modifier
                    </Button>
                    {(listing?.statut === 'publiee' || listing?.statut === 'published') && (
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Archive"
                        onClick={() => handleTogglePublish(listing?.id, listing?.statut)}
                      >
                        Archiver
                      </Button>
                    )}
                    {listing?.statut === 'archivee' && (
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Eye"
                        onClick={() => handleTogglePublish(listing?.id, listing?.statut)}
                      >
                        Publier
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      iconName="Trash2"
                      onClick={() => handleDelete(listing?.id)}
                      className="text-error hover:bg-error/10"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ListingsTab;

