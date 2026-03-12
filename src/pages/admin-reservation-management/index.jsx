import React, { useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Image from '../../components/AppImage';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import ReservationDetailModal from './components/ReservationDetailModal';
import ForceStatusModal from './components/ForceStatusModal';

const AdminReservationManagement = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showForceStatusModal, setShowForceStatusModal] = useState(false);
  const [forceStatusReservationId, setForceStatusReservationId] = useState(null);

  const reservations = [
  {
    id: 'RES-2026-001',
    equipmentTitle: 'Perceuse sans fil Bosch Professional',
    equipmentImage: '/assets/images/no_image.png',
    equipmentImageAlt: 'Professional Bosch cordless drill with battery pack and carrying case on white background',
    renterPseudo: 'Marie_L',
    ownerPseudo: 'BricoleurPro',
    startDate: '2026-02-20',
    endDate: '2026-02-23',
    status: 'pending',
    totalAmount: 75.00,
    cautionAmount: 150.00,
    cautionStatus: 'authorized',
    timeline: [
    { date: '2026-02-14T10:30:00', event: 'Demande de réservation créée', type: 'info' },
    { date: '2026-02-14T11:00:00', event: 'En attente de validation propriétaire', type: 'pending' }],

    messages: [
    { from: 'Marie_L', message: 'Bonjour, je souhaite louer votre perceuse pour un projet de rénovation.', timestamp: '2026-02-14T10:35:00' }]

  },
  {
    id: 'RES-2026-002',
    equipmentTitle: 'Tondeuse thermique Honda',
    equipmentImage: 'https://images.unsplash.com/photo-1693841956318-7afde7ab264e',
    equipmentImageAlt: 'Red Honda gasoline lawn mower with grass catcher on green lawn',
    renterPseudo: 'Pierre_M',
    ownerPseudo: 'JardinExpert',
    startDate: '2026-02-15',
    endDate: '2026-02-16',
    status: 'ongoing',
    totalAmount: 45.00,
    cautionAmount: 200.00,
    cautionStatus: 'authorized',
    timeline: [
    { date: '2026-02-13T09:00:00', event: 'Demande créée', type: 'info' },
    { date: '2026-02-13T14:30:00', event: 'Acceptée par le propriétaire', type: 'success' },
    { date: '2026-02-14T16:00:00', event: 'Paiement effectué', type: 'success' },
    { date: '2026-02-15T09:30:00', event: 'Équipement récupéré', type: 'success' }],

    messages: []
  },
  {
    id: 'RES-2026-003',
    equipmentTitle: 'Échelle télescopique 5m',
    equipmentImage: '/assets/images/no_image.png',
    equipmentImageAlt: 'Telescopic aluminum ladder extended to full height against white background',
    renterPseudo: 'Sophie_D',
    ownerPseudo: 'OutilsPro75',
    startDate: '2026-02-10',
    endDate: '2026-02-12',
    status: 'completed',
    totalAmount: 36.00,
    cautionAmount: 100.00,
    cautionStatus: 'released',
    timeline: [
    { date: '2026-02-08T10:00:00', event: 'Demande créée', type: 'info' },
    { date: '2026-02-08T15:20:00', event: 'Acceptée', type: 'success' },
    { date: '2026-02-09T11:00:00', event: 'Paiement effectué', type: 'success' },
    { date: '2026-02-10T08:45:00', event: 'Équipement récupéré', type: 'success' },
    { date: '2026-02-12T18:30:00', event: 'Équipement restitué', type: 'success' },
    { date: '2026-02-12T19:00:00', event: 'Caution libérée', type: 'success' }],

    messages: []
  },
  {
    id: 'RES-2026-004',
    equipmentTitle: 'Scie circulaire Makita',
    equipmentImage: '/assets/images/no_image.png',
    equipmentImageAlt: 'Teal Makita circular saw with blade guard and power cord on workbench',
    renterPseudo: 'Jean_P',
    ownerPseudo: 'BricoleurPro',
    startDate: '2026-02-18',
    endDate: '2026-02-20',
    status: 'dispute',
    totalAmount: 60.00,
    cautionAmount: 180.00,
    cautionStatus: 'held',
    disputeReason: 'Équipement endommagé lors de la restitution',
    timeline: [
    { date: '2026-02-16T10:00:00', event: 'Demande créée', type: 'info' },
    { date: '2026-02-16T14:00:00', event: 'Acceptée', type: 'success' },
    { date: '2026-02-17T09:00:00', event: 'Paiement effectué', type: 'success' },
    { date: '2026-02-18T10:00:00', event: 'Équipement récupéré', type: 'success' },
    { date: '2026-02-20T19:00:00', event: 'Litige ouvert - dommages signalés', type: 'error' }],

    messages: [
    { from: 'BricoleurPro', message: 'La lame est endommagée, ce n\'était pas le cas avant la location.', timestamp: '2026-02-20T19:05:00' },
    { from: 'Jean_P', message: 'Je n\'ai constaté aucun dommage, la lame était déjà usée.', timestamp: '2026-02-20T19:30:00' }]

  },
  {
    id: 'RES-2026-005',
    equipmentTitle: 'Karcher K5 Premium',
    equipmentImage: 'https://images.unsplash.com/photo-1718152421929-3ef6df648f4d',
    equipmentImageAlt: 'Yellow and black Karcher pressure washer with hose and spray gun on concrete driveway',
    renterPseudo: 'Luc_B',
    ownerPseudo: 'NettoyagePro',
    startDate: '2026-02-12',
    endDate: '2026-02-14',
    status: 'cancelled',
    totalAmount: 70.00,
    cautionAmount: 0,
    cautionStatus: 'none',
    cancellationReason: 'Annulé par le locataire - changement de planning',
    timeline: [
    { date: '2026-02-10T14:00:00', event: 'Demande créée', type: 'info' },
    { date: '2026-02-11T09:00:00', event: 'Annulée par le locataire', type: 'error' }],

    messages: []
  }];


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
    return configs?.[status] || configs?.pending;
  };

  const filteredReservations = statusFilter === 'all' ?
  reservations :
  reservations?.filter((r) => r?.status === statusFilter);

  const statusOptions = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'ongoing', label: 'En cours' },
  { value: 'completed', label: 'Terminées' },
  { value: 'dispute', label: 'Litiges' },
  { value: 'cancelled', label: 'Annulées' }];


  const handleViewDetails = (reservation) => {
    setSelectedReservation(reservation);
    setShowDetailModal(true);
  };

  const handleForceStatus = (reservationId) => {
    setForceStatusReservationId(reservationId);
    setShowForceStatusModal(true);
  };

  const handleForceStatusSubmit = (newStatus) => {
    console.log('Force status change:', forceStatusReservationId, 'to', newStatus);
    setShowForceStatusModal(false);
    setForceStatusReservationId(null);
  };

  const handleCaptionAction = (reservationId, action) => {
    console.log('Caption action:', action, 'for reservation:', reservationId);
  };

  const handleCancelReservation = (reservationId) => {
    console.log('Cancel reservation:', reservationId);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {/* En-tête de page */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gestion des réservations</h1>
          <p className="text-muted-foreground">Supervision complète et intervention manuelle sur les réservations</p>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select
                label="Statut"
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter} />
              
            </div>
            <div className="flex-1">
              <Input
                label="Rechercher"
                placeholder="ID, équipement, utilisateur..." />
              
            </div>
            <div className="flex-1">
              <Input
                label="Montant min"
                type="number"
                placeholder="0 €" />
              
            </div>
          </div>
        </div>

        {/* Reservations Table */}
        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
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
                    <tr key={reservation?.id} className="hover:bg-surface transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{reservation?.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 flex-shrink-0">
                            <Image
                              src={reservation?.equipmentImage}
                              alt={reservation?.equipmentImageAlt}
                              className="w-full h-full object-cover rounded-md" />
                            
                          </div>
                          <p className="text-sm text-foreground line-clamp-2 max-w-[200px]">{reservation?.equipmentTitle}</p>
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
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                          <Icon name={statusConfig?.icon} size={12} />
                          <span>{statusConfig?.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{reservation?.totalAmount?.toFixed(2)} €</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="xs"
                            iconName="Eye"
                            onClick={() => handleViewDetails(reservation)}>
                            
                            Voir
                          </Button>
                          {(reservation?.status === 'pending' || reservation?.status === 'ongoing') &&
                          <Button
                            variant="outline"
                            size="xs"
                            iconName="Settings"
                            onClick={() => handleForceStatus(reservation?.id)}>
                            
                              Forcer
                            </Button>
                          }
                        </div>
                      </td>
                    </tr>);

                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modals */}
      {showDetailModal && selectedReservation &&
      <ReservationDetailModal
        reservation={selectedReservation}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }}
        onCaptionAction={handleCaptionAction}
        onCancelReservation={handleCancelReservation} />

      }

      {showForceStatusModal &&
      <ForceStatusModal
        onClose={() => {
          setShowForceStatusModal(false);
          setForceStatusReservationId(null);
        }}
        onSubmit={handleForceStatusSubmit} />

      }
    </div>);

};

export default AdminReservationManagement;

