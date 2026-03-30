import React, { useEffect, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Image from '../../components/AppImage';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import ReservationDetailModal from './components/ReservationDetailModal';
import ForceStatusModal from './components/ForceStatusModal';
import { supabase } from '../../lib/supabase';
import storageService from '../../services/storageService';
import { isAdminVerificationScenario } from '../../utils/adminVerificationContext';

const DEMO_RESERVATIONS = [
  {
    id: 'RES-2026-001',
    equipmentTitle: 'Perceuse sans fil Bosch Professional',
    equipmentImage: '/assets/images/no_image.png',
    equipmentImageAlt: 'Perceuse sans fil',
    renterPseudo: 'Marie_L',
    ownerPseudo: 'BricoleurPro',
    startDate: '2026-02-20',
    endDate: '2026-02-23',
    status: 'pending',
    totalAmount: 75,
    cautionAmount: 150,
    cautionStatus: 'authorized',
    timeline: [
      { date: '2026-02-14T10:30:00', event: 'Demande de reservation creee', type: 'info' },
      { date: '2026-02-14T11:00:00', event: 'En attente de validation proprietaire', type: 'pending' }
    ],
    messages: [
      {
        from: 'Marie_L',
        message: 'Bonjour, je souhaite louer votre perceuse pour un projet de renovation.',
        timestamp: '2026-02-14T10:35:00'
      }
    ]
  },
  {
    id: 'RES-2026-002',
    equipmentTitle: 'Tondeuse thermique Honda',
    equipmentImage: '/assets/images/no_image.png',
    equipmentImageAlt: 'Tondeuse thermique',
    renterPseudo: 'Pierre_M',
    ownerPseudo: 'JardinExpert',
    startDate: '2026-02-15',
    endDate: '2026-02-16',
    status: 'ongoing',
    totalAmount: 45,
    cautionAmount: 200,
    cautionStatus: 'authorized',
    timeline: [
      { date: '2026-02-13T09:00:00', event: 'Demande creee', type: 'info' },
      { date: '2026-02-13T14:30:00', event: 'Acceptee par le proprietaire', type: 'success' },
      { date: '2026-02-14T16:00:00', event: 'Paiement effectue', type: 'success' },
      { date: '2026-02-15T09:30:00', event: 'Equipement recupere', type: 'success' }
    ],
    messages: []
  }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'ongoing', label: 'En cours' },
  { value: 'completed', label: 'Terminées' },
  { value: 'dispute', label: 'Litiges' },
  { value: 'cancelled', label: 'Annulées' }
];

const mapStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (['pending', 'accepted'].includes(normalized)) return 'pending';
  if (['active', 'ongoing'].includes(normalized)) return 'ongoing';
  if (['completed'].includes(normalized)) return 'completed';
  if (normalized.includes('dispute')) return 'dispute';
  if (normalized.includes('cancelled') || normalized.includes('refused') || normalized.includes('rejected')) {
    return 'cancelled';
  }
  return 'pending';
};

const getStatusConfig = (status) => {
  const configs = {
    pending: {
      label: 'En attente',
      icon: 'Clock',
      color: 'text-warning bg-warning/10'
    },
    ongoing: {
      label: 'En cours',
      icon: 'PlayCircle',
      color: 'text-[#17a2b8] bg-[#17a2b8]/10'
    },
    completed: {
      label: 'Terminée',
      icon: 'CheckCircle',
      color: 'text-success bg-success/10'
    },
    dispute: {
      label: 'Litige',
      icon: 'AlertTriangle',
      color: 'text-error bg-error/10'
    },
    cancelled: {
      label: 'Annulée',
      icon: 'XCircle',
      color: 'text-muted-foreground bg-muted'
    }
  };

  return configs?.[status] || configs.pending;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const resolveAnnonceImage = (annonce) => {
  const rawPhotos = Array.isArray(annonce?.photos) ? annonce.photos : [];
  return storageService?.getAnnoncePhotoUrls(rawPhotos)?.[0] || rawPhotos?.[0] || '/assets/images/no_image.png';
};

const buildTimelineFromRow = (row) => {
  const timeline = [
    {
      date: row?.created_at || new Date().toISOString(),
      event: 'Réservation créée',
      type: 'info'
    }
  ];

  if (['ongoing', 'completed', 'dispute']?.includes(row?.status)) {
    timeline.push({
      date: row?.updated_at || row?.created_at || new Date().toISOString(),
      event: 'Paiement confirmé',
      type: 'success'
    });
  }

  if (row?.status === 'completed') {
    timeline.push({
      date: row?.updated_at || new Date().toISOString(),
      event: 'Réservation terminée',
      type: 'success'
    });
  }

  if (row?.status === 'dispute') {
    timeline.push({
      date: row?.updated_at || new Date().toISOString(),
      event: 'Litige ouvert',
      type: 'error'
    });
  }

  return timeline;
};

const AdminReservationManagement = () => {
  const isVerificationAdminReservationsScenario = isAdminVerificationScenario('partial_admin_reservations_demo');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSourceLabel, setDataSourceLabel] = useState('Chargement');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showForceStatusModal, setShowForceStatusModal] = useState(false);
  const [forceStatusReservationId, setForceStatusReservationId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadReservations = async () => {
      setLoading(true);

      if (isVerificationAdminReservationsScenario) {
        if (!isMounted) return;
        setReservations(DEMO_RESERVATIONS);
        setDataSourceLabel('Jeu de vérification admin');
        setLoading(false);
        return;
      }

      try {
        const { data: reservationRows, error: reservationError } = await supabase
          ?.from('reservations')
          ?.select('id, annonce_id, owner_id, renter_id, start_date, end_date, status, total_price, caution_amount, deposit_status, created_at, updated_at')
          ?.order('created_at', { ascending: false })
          ?.limit(50);

        if (reservationError) throw reservationError;

        const reservationList = Array.isArray(reservationRows) ? reservationRows : [];
        if (reservationList.length === 0) {
          if (!isMounted) return;
          setReservations(DEMO_RESERVATIONS);
          setDataSourceLabel('Fallback de démonstration faute de réservations');
          setLoading(false);
          return;
        }

        const annonceIds = [...new Set(reservationList.map((row) => row?.annonce_id).filter(Boolean))];
        const userIds = [...new Set(
          reservationList.flatMap((row) => [row?.owner_id, row?.renter_id]).filter(Boolean)
        )];

        const [{ data: annonces }, { data: profiles }] = await Promise.all([
          annonceIds.length > 0
            ? supabase.from('annonces').select('id, titre, photos, caution').in('id', annonceIds)
            : Promise.resolve({ data: [] }),
          userIds.length > 0
            ? supabase.from('profiles').select('id, pseudo').in('id', userIds)
            : Promise.resolve({ data: [] })
        ]);

        const annonceById = Object.fromEntries((annonces || []).map((annonce) => [annonce?.id, annonce]));
        const profileById = Object.fromEntries((profiles || []).map((profile) => [profile?.id, profile]));

        const mappedReservations = reservationList.map((row) => {
          const annonce = annonceById?.[row?.annonce_id] || null;
          return {
            id: row?.id,
            equipmentTitle: annonce?.titre || 'Annonce',
            equipmentImage: resolveAnnonceImage(annonce),
            equipmentImageAlt: annonce?.titre || 'Annonce',
            renterPseudo: profileById?.[row?.renter_id]?.pseudo || 'Locataire',
            ownerPseudo: profileById?.[row?.owner_id]?.pseudo || 'Propriétaire',
            startDate: row?.start_date,
            endDate: row?.end_date,
            status: mapStatus(row?.status),
            totalAmount: Number(row?.total_price || 0) || 0,
            cautionAmount: Number(row?.caution_amount || annonce?.caution || 0) || 0,
            cautionStatus: String(row?.deposit_status || 'pending').toLowerCase(),
            timeline: buildTimelineFromRow({ ...row, status: mapStatus(row?.status) }),
            messages: []
          };
        });

        if (!isMounted) return;
        setReservations(mappedReservations);
        setDataSourceLabel('Réservations réelles Supabase');
      } catch (error) {
        console.error('Chargement admin reservations impossible:', error);
        if (!isMounted) return;
        setReservations(DEMO_RESERVATIONS);
        setDataSourceLabel('Fallback de démonstration après erreur de chargement');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReservations();

    return () => {
      isMounted = false;
    };
  }, [isVerificationAdminReservationsScenario]);

  const filteredReservations = reservations
    ?.filter((reservation) => (
      statusFilter === 'all' || reservation?.status === statusFilter
    ))
    ?.filter((reservation) => {
      const haystack = [
        reservation?.id,
        reservation?.equipmentTitle,
        reservation?.renterPseudo,
        reservation?.ownerPseudo
      ].join(' ').toLowerCase();

      return haystack.includes(String(searchTerm || '').trim().toLowerCase());
    });

  const handleViewDetails = (reservation) => {
    setSelectedReservation(reservation);
    setShowDetailModal(true);
  };

  const handleForceStatus = (reservationId) => {
    setForceStatusReservationId(reservationId);
    setShowForceStatusModal(true);
  };

  const handleForceStatusSubmit = (_newStatus) => {
    setShowForceStatusModal(false);
    setForceStatusReservationId(null);
  };

  const handleCaptionAction = () => {};
  const handleCancelReservation = () => {};

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="container mx-auto flex-1 px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Gestion des réservations</h1>
          <p className="text-muted-foreground">Supervision complète et intervention manuelle sur les réservations</p>
        </div>

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          Source des données: <span className="font-semibold">{dataSourceLabel}</span>
        </div>

        <div className="mb-6 rounded-lg bg-white p-4 shadow-elevation-1">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <Select
                label="Statut"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Rechercher"
                placeholder="ID, équipement, utilisateur..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event?.target?.value || '')}
              />
            </div>
            <div className="flex-1">
              <Input label="Montant min" type="number" placeholder="0 €" disabled />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-elevation-1">
          {loading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-12 text-muted-foreground">
              <Icon name="Loader2" size={20} className="animate-spin" />
              <span>Chargement des réservations...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Équipement</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Locataire</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Propriétaire</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Dates</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Montant</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredReservations?.map((reservation) => {
                    const statusConfig = getStatusConfig(reservation?.status);
                    return (
                      <tr key={reservation?.id} className="transition-colors hover:bg-surface">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{reservation?.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 flex-shrink-0">
                              <Image
                                src={reservation?.equipmentImage}
                                alt={reservation?.equipmentImageAlt}
                                className="h-full w-full rounded-md object-cover"
                              />
                            </div>
                            <p className="max-w-[220px] line-clamp-2 text-sm text-foreground">{reservation?.equipmentTitle}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{reservation?.renterPseudo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{reservation?.ownerPseudo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground">{formatDate(reservation?.startDate)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(reservation?.endDate)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusConfig?.color}`}>
                            <Icon name={statusConfig?.icon} size={12} />
                            <span>{statusConfig?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">{Number(reservation?.totalAmount || 0).toFixed(2)} €</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              iconName="Eye"
                              onClick={() => handleViewDetails(reservation)}
                            >
                              Voir
                            </Button>
                            {['pending', 'ongoing']?.includes(reservation?.status) ? (
                              <Button
                                variant="outline"
                                size="xs"
                                iconName="Settings"
                                onClick={() => handleForceStatus(reservation?.id)}
                              >
                                Forcer
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {showDetailModal && selectedReservation ? (
        <ReservationDetailModal
          reservation={selectedReservation}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReservation(null);
          }}
          onCaptionAction={handleCaptionAction}
          onCancelReservation={handleCancelReservation}
        />
      ) : null}

      {showForceStatusModal ? (
        <ForceStatusModal
          onClose={() => {
            setShowForceStatusModal(false);
            setForceStatusReservationId(null);
          }}
          onSubmit={handleForceStatusSubmit}
        />
      ) : null}
    </div>
  );
};

export default AdminReservationManagement;
