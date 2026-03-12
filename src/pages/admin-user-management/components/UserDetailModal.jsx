import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';

const UserDetailModal = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [reservations, setReservations] = useState([]);
  const [listings, setListings] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user?.id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch reservations
      const { data: reservationsData } = await supabase?.from('reservations')?.select(`
          id,
          status,
          start_date,
          end_date,
          annonce:annonce_id(titre)
        `)?.or(`renter_id.eq.${user?.id},owner_id.eq.${user?.id}`)?.order('created_at', { ascending: false })?.limit(20);
      
      // Fetch listings
      const { data: listingsData } = await supabase?.from('annonces')?.select('id, titre, statut, published, created_at')?.eq('owner_id', user?.id)?.order('created_at', { ascending: false })?.limit(20);
      
      // Fetch strikes
      const { data: strikesData } = await supabase?.from('user_sanctions')?.select('id, type, reason, created_at, level')?.eq('user_id', user?.id)?.order('created_at', { ascending: false });

      setReservations(reservationsData || []);
      setListings(listingsData || []);
      setStrikes(strikesData || []);
    } catch (error) {
      console.error('Erreur lors du chargement de user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profil', icon: 'User' },
    { id: 'reservations', label: 'Réservations', icon: 'Calendar' },
    { id: 'listings', label: 'Annonces', icon: 'Package' },
    { id: 'strikes', label: 'Avertissements', icon: 'AlertTriangle' },
    { id: 'documents', label: 'Documents', icon: 'FileText' }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date?.getTime())) return '-';
    return date?.toLocaleDateString('fr-FR');
  };

  const getUserStatus = () => {
    if (user?.status) return user?.status;
    if (user?.banned_at) return 'banned';
    if (user?.suspended_at) return 'suspended';
    return 'active';
  };

  const strikeCount = Number(user?.strikeCount ?? user?.no_reply_strikes ?? strikes?.length ?? 0) || 0;

  if (!isOpen || !user) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pseudo</p>
                <p className="font-medium text-foreground">{user?.pseudo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">E-mail</p>
                <p className="font-medium text-foreground">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date d'inscription</p>
                <p className="font-medium text-foreground">
                  {formatDate(user?.created_at || user?.registrationDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Statut</p>
                <p className="font-medium text-foreground capitalize">{getUserStatus()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Réservations</p>
                <p className="font-medium text-foreground">{reservations?.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Annonces</p>
                <p className="font-medium text-foreground">{listings?.length}</p>
              </div>
            </div>
            {user?.is_tester && (
              <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Icon name="Beaker" size={16} className="text-[#17a2b8]" />
                  <span className="text-sm font-medium text-foreground">Utilisateur participant aux essais</span>
                </div>
              </div>
            )}
          </div>
        );
      case 'reservations':
        return (
          <div className="space-y-3">
            {reservations?.map((res) => (
              <div key={res?.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{res?.annonce?.titre || `Reservation ${res?.id}`}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(res?.start_date)} - {formatDate(res?.end_date)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    res?.status === 'completed' ? 'bg-success/10 text-success' : 'bg-[#17a2b8]/10 text-[#17a2b8]'
                  }`}>
                    {res?.status || 'inconnu'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'listings':
        return (
          <div className="space-y-3">
            {listings?.map((listing) => (
              <div key={listing?.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{listing?.titre || `Annonce ${listing?.id}`}</p>
                    <p className="text-xs text-muted-foreground">Creee le {formatDate(listing?.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    listing?.published ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>
                    {listing?.published ? 'Publiee' : (listing?.statut || 'Brouillon')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'strikes':
        return (
          <div className="space-y-3">
            {strikeCount === 0 ? (
              <div className="text-center py-8">
                <Icon name="CheckCircle" size={48} className="mx-auto text-success mb-2" />
                <p className="text-sm text-muted-foreground">Aucun avertissement</p>
              </div>
            ) : (
              strikes?.map((strike) => (
                <div key={strike?.id} className="border border-warning/20 bg-warning/5 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{strike?.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(strike?.created_at)} | {strike?.type}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {strikeCount >= 2 && (
              <div className="bg-error/10 border border-error/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Icon name="AlertCircle" size={16} className="text-error mt-0.5" />
                  <p className="text-sm text-foreground">
                    Attention: {Math.max(0, 3 - strikeCount)} avertissement{Math.max(0, 3 - strikeCount) > 1 ? 's' : ''} avant bannissement automatique
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      case 'documents':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-2">
                <Icon name="FileText" size={16} className="text-muted-foreground" />
                <span className="text-sm text-foreground">Pièce d'identité</span>
              </div>
              {user?.documentsVerified ? (
                <Icon name="CheckCircle" size={16} className="text-success" />
              ) : (
                <Icon name="Clock" size={16} className="text-warning" />
              )}
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-2">
                <Icon name="CreditCard" size={16} className="text-muted-foreground" />
                <span className="text-sm text-foreground">Carte bancaire</span>
              </div>
              {user?.documentsVerified ? (
                <Icon name="CheckCircle" size={16} className="text-success" />
              ) : (
                <Icon name="Clock" size={16} className="text-warning" />
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal En-tête */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={user?.avatar_url || user?.avatar || '/assets/images/no_image.png'}
                alt={user?.pseudo}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h2 className="text-xl font-semibold text-foreground">{user?.pseudo}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface rounded-md transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border overflow-x-auto">
          <div className="flex min-w-max">
            {tabs?.map((tab) => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab?.id
                    ? 'border-[#17a2b8] text-[#17a2b8] bg-[#17a2b8]/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface'
                }`}
              >
                <Icon name={tab?.icon} size={16} />
                <span>{tab?.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : (
            renderTabContent()
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;

