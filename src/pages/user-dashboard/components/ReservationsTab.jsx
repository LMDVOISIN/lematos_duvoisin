import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import reservationService from '../../../services/reservationService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const normalizeDateOnly = (value) => {
  const parsedDate = value ? new Date(value) : null;
  if (!parsedDate || Number.isNaN(parsedDate?.getTime())) return null;

  parsedDate?.setHours(0, 0, 0, 0);
  return parsedDate;
};

const getDisplayStatus = (reservation) => {
  const rawStatus = String(reservation?.status || '')?.toLowerCase();
  if (rawStatus === 'accepted') return 'pending';
  if (rawStatus !== 'completed') return rawStatus || 'pending';

  const today = normalizeDateOnly(new Date());
  const startDate = normalizeDateOnly(reservation?.start_date);
  const endDate = normalizeDateOnly(reservation?.end_date);

  if (startDate && today && startDate > today) return 'accepted';
  if (endDate && today && endDate >= today) return 'active';

  return 'completed';
};

const ReservationsTab = () => {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchReservations();
    }
  }, [user?.id]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      // Fetch both renter and owner reservations
      const [renterRes, ownerRes] = await Promise.all([
        reservationService?.getUserReservations(user?.id),
        reservationService?.getOwnerReservations(user?.id)
      ]);

      const allReservations = [
        ...(renterRes?.data || [])?.map((r) => ({ ...r, role: 'renter' })),
        ...(ownerRes?.data || [])?.map((r) => ({ ...r, role: 'owner' }))
      ]?.map((reservation) => ({
        ...reservation,
        displayStatus: getDisplayStatus(reservation)
      }));

      allReservations?.forEach((reservation) => {
        if (
          String(reservation?.status || '')?.toLowerCase() === 'completed'
          && reservation?.displayStatus !== 'completed'
        ) {
          console.warn('[ReservationsTab] Statut incoh?rent corrige ? l?affichage', {
            reservationId: reservation?.id,
            status: reservation?.status,
            displayStatus: reservation?.displayStatus,
            startDate: reservation?.start_date,
            endDate: reservation?.end_date
          });
        }
      });

      // Sort by created_at descending
      allReservations?.sort((a, b) => new Date(b?.created_at) - new Date(a?.created_at));

      setReservations(allReservations);
    } catch (error) {
      console.error('Erreur lors du chargement de reservations:', error);
      toast?.error('Erreur lors du chargement des réservations');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };
  const handleCancel = async (id) => {
    if (!window.confirm('Voulez-vous vraiment annuler cette réservation ?')) return;

    try {
      const reason = prompt('Raison de l\'annulation (optionnel):');
      const { error } = await reservationService?.cancelReservation(id, reason, user?.id);
      if (error) throw error;

      toast?.success('Réservation annulée');
      fetchReservations();
    } catch (error) {
      console.error('Cancel error:', error);
      toast?.error('Erreur lors de l\'annulation');
    }
  };

  const handleViewDetails = (id) => {
    if (!id) return;
    navigate(`/photos-d-tat-des-lieux/${id}`);
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        label: 'A payer',
        icon: 'Clock',
        color: 'text-warning bg-warning/10'
      },
      accepted: {
        label: 'A payer',
        icon: 'CheckCircle',
        color: 'text-success bg-success/10'
      },
      paid: {
        label: 'Payée',
        icon: 'CreditCard',
        color: 'text-[#17a2b8] bg-[#17a2b8]/10'
      },
      active: {
        label: 'En cours',
        icon: 'PlayCircle',
        color: 'text-[#17a2b8] bg-[#17a2b8]/10'
      },
      completed: {
        label: 'Terminée',
        icon: 'Check',
        color: 'text-muted-foreground bg-muted'
      },
      cancelled: {
        label: 'Annulée',
        icon: 'XCircle',
        color: 'text-error bg-error/10'
      }
    };
    return configs?.[status] || configs?.pending;
  };

  const filteredReservations = filter === 'all' ?
    reservations :
    reservations?.filter((r) => (r?.displayStatus || r?.status) === filter);

  const filters = [
    { id: 'all', label: 'Toutes' },
    { id: 'pending', label: 'A payer' },
    { id: 'active', label: 'En cours' },
    { id: 'completed', label: 'Terminées' }
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
      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {filters?.map((f) =>
          <button
            key={f?.id}
            onClick={() => setFilter(f?.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f?.id ?
              'bg-[#17a2b8] text-white' :
              'bg-surface text-muted-foreground hover:bg-muted hover:text-foreground'}`
            }>
            {f?.label}
          </button>
        )}
      </div>

      {/* Reservations List */}
      {filteredReservations?.length === 0 ?
        <div className="text-center py-12">
          <Icon name="Calendar" size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune réservation trouvée</p>
        </div> :
        <div className="space-y-4">
          {filteredReservations?.map((reservation) => {
            const statusConfig = getStatusConfig(reservation?.displayStatus || reservation?.status);
            const mainPhoto = reservation?.annonce?.images?.[0] || '/assets/images/no_image.png';
            const isOwner = reservation?.role === 'owner';

            return (
              <div key={reservation?.id} className="bg-surface rounded-lg p-4 border border-border hover:shadow-elevation-2 transition-shadow">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Equipment Image */}
                  <div className="w-full md:w-32 h-32 flex-shrink-0">
                    <Image
                      src={mainPhoto}
                      alt={reservation?.annonce?.titre || 'Annonce'}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>

                  {/* Reservation Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">{reservation?.annonce?.titre}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Icon name="User" size={14} />
                          <span>{isOwner ? 'Locataire' : 'Propriétaire'}: {isOwner ? reservation?.renter?.pseudo : reservation?.owner?.pseudo}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                        <Icon name={statusConfig?.icon} size={14} />
                        <span>{statusConfig?.label}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon name="Calendar" size={14} />
                        <span>{new Date(reservation?.start_date)?.toLocaleDateString('fr-FR')} - {new Date(reservation?.end_date)?.toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground font-semibold">
                        <Icon name="Euro" size={14} />
                        <span>{reservation?.total_price?.toFixed(2)} €</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {['pending', 'accepted']?.includes(reservation?.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          iconName="XCircle"
                          onClick={() => handleCancel(reservation?.id)}
                        >
                          Annuler
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Eye"
                        onClick={() => handleViewDetails(reservation?.id)}
                      >
                        Détails
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
};

export default ReservationsTab;


