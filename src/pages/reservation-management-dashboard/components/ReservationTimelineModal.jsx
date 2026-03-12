import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ReservationTimelineModal = ({ reservation, onClose }) => {
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
      info: 'text-[#17a2b8] bg-[#17a2b8]/10',
      success: 'text-success bg-success/10',
      error: 'text-error bg-error/10',
      pending: 'text-warning bg-warning/10'
    };
    return colors?.[type] || 'text-muted-foreground bg-muted';
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Chronologie de la réservation</h2>
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
        <div className="p-6">
          {/* Equipment Info */}
          <div className="bg-surface rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-foreground mb-2">{reservation?.equipmentTitle}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Locataire</p>
                <p className="font-medium text-foreground">{reservation?.renterPseudo}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Montant</p>
                <p className="font-medium text-foreground">{reservation?.totalAmount?.toFixed(2)} €</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline events */}
            <div className="space-y-6">
              {reservation?.timeline?.map((event, index) => {
                const colorClasses = getTimelineColor(event?.type);
                return (
                  <div key={index} className="relative flex gap-4">
                    {/* Icon */}
                    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${colorClasses}`}>
                      <Icon name={getTimelineIcon(event?.type)} size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <p className="font-medium text-foreground mb-1">{event?.event}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(event?.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReservationTimelineModal;
