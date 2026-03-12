import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RefusalModal = ({ onClose, onSubmit, reservationId }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const refusalReasons = [
    { value: 'unavailable', label: 'Équipement non disponible' },
    { value: 'maintenance', label: 'Équipement en maintenance' },
    { value: 'dates', label: 'Dates non convenables' },
    { value: 'profile', label: 'Profil du locataire incomplet' },
    { value: 'other', label: 'Autre raison' }
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      alert('Veuillez sélectionner une raison');
      return;
    }

    if (selectedReason === 'other' && !customMessage?.trim()) {
      alert('Veuillez préciser la raison');
      return;
    }

    setLoading(true);
    await onSubmit(selectedReason, customMessage);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h4 font-heading text-foreground">Refuser la réservation</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface rounded transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Réservation: <span className="font-medium text-foreground">{reservationId}</span>
          </p>

          <div className="space-y-3 mb-4">
            <label className="text-sm font-medium text-foreground">Raison du refus *</label>
            {refusalReasons?.map((reason) => (
              <label
                key={reason?.value}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedReason === reason?.value
                    ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name="refusalReason"
                  value={reason?.value}
                  checked={selectedReason === reason?.value}
                  onChange={(e) => setSelectedReason(e?.target?.value)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm text-foreground">{reason?.label}</span>
              </label>
            ))}
          </div>

          {selectedReason === 'other' && (
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Message personnalisé *
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e?.target?.value)}
                placeholder="Expliquez la raison du refus..."
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          )}

          <div className="bg-warning/10 border border-warning rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground">
                Le locataire sera notifié de votre refus. Cette action est irréversible.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              fullWidth
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              variant="danger"
              fullWidth
              loading={loading}
              iconName="XCircle"
            >
              Refuser la réservation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefusalModal;