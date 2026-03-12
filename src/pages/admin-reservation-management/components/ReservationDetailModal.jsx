import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const ReservationDetailModal = ({ reservation, onClose, onCaptionAction, onCancelReservation }) => {
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimelineIcon = (type) => {
    const icons = {
      info: 'Info',
      success: 'CheckCircle',
      error: 'AlertCircle',
      pending: 'Clock'
    };
    return icons?.[type] || 'Circle';
  };

  const getTimelineColor = (type) => {
    const colors = {
      info: 'text-[#17a2b8]',
      success: 'text-success',
      error: 'text-error',
      pending: 'text-warning'
    };
    return colors?.[type] || 'text-muted-foreground';
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Détails de la réservation</h2>
            <p className="text-sm text-muted-foreground mt-1">{reservation?.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-md transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Equipment Info */}
          <div className="flex gap-4">
            <div className="w-32 h-32 flex-shrink-0">
              <Image
                src={reservation?.equipmentImage}
                alt={reservation?.equipmentImageAlt}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">{reservation?.equipmentTitle}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Locataire</p>
                  <p className="font-medium text-foreground">{reservation?.renterPseudo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Propriétaire</p>
                  <p className="font-medium text-foreground">{reservation?.ownerPseudo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dates</p>
                  <p className="font-medium text-foreground">
                    {new Date(reservation?.startDate)?.toLocaleDateString('fr-FR')} - {new Date(reservation?.endDate)?.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Montant total</p>
                  <p className="font-semibold text-foreground text-lg">{reservation?.totalAmount?.toFixed(2)} €</p>
                </div>
              </div>
            </div>
          </div>

          {/* Caution Status */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="Shield" size={18} className="text-[#17a2b8]" />
                  <h4 className="font-semibold text-foreground">Caution</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Montant: <span className="font-medium text-foreground">{reservation?.cautionAmount?.toFixed(2)} €</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Statut: <span className="font-medium text-foreground capitalize">{reservation?.cautionStatus === 'authorized' ? 'Autorisée' : reservation?.cautionStatus === 'held' ? 'Retenue' : reservation?.cautionStatus === 'released' ? 'Libérée' : 'Aucune'}</span>
                </p>
              </div>
              {reservation?.cautionStatus === 'authorized' && (
                <div className="flex gap-2">
                  <Button
                    variant="warning"
                    size="sm"
                    iconName="Lock"
                    onClick={() => onCaptionAction(reservation?.id, 'capture')}
                  >
                    Capturer
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    iconName="Unlock"
                    onClick={() => onCaptionAction(reservation?.id, 'release')}
                  >
                    Libérer
                  </Button>
                </div>
              )}
              {reservation?.cautionStatus === 'held' && (
                <Button
                  variant="success"
                  size="sm"
                  iconName="Unlock"
                  onClick={() => onCaptionAction(reservation?.id, 'release')}
                >
                  Libérer
                </Button>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon name="Clock" size={18} />
              Chronologie
            </h4>
            <div className="space-y-3">
              {reservation?.timeline?.map((event, index) => (
                <div key={index} className="flex gap-3">
                  <div className={`flex-shrink-0 ${getTimelineColor(event?.type)}`}>
                    <Icon name={getTimelineIcon(event?.type)} size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{event?.event}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event?.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          {reservation?.messages?.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon name="MessageSquare" size={18} />
                Messages
              </h4>
              <div className="space-y-3">
                {reservation?.messages?.map((msg, index) => (
                  <div key={index} className="bg-surface rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">{msg?.from}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(msg?.timestamp)}</p>
                    </div>
                    <p className="text-sm text-foreground">{msg?.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dispute/Cancellation Info */}
          {reservation?.disputeReason && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={18} className="text-error mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-error mb-1">Litige en cours</p>
                  <p className="text-sm text-foreground">{reservation?.disputeReason}</p>
                </div>
              </div>
            </div>
          )}

          {reservation?.cancellationReason && (
            <div className="bg-muted border border-border rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Icon name="XCircle" size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Réservation annulée</p>
                  <p className="text-sm text-muted-foreground">{reservation?.cancellationReason}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <div className="flex gap-2">
            {(reservation?.status === 'pending' || reservation?.status === 'ongoing') && (
              <Button
                variant="danger"
                iconName="XCircle"
                onClick={() => {
                  onCancelReservation(reservation?.id);
                  onClose();
                }}
              >
                Annuler la réservation
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationDetailModal;
