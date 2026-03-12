import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const ForceStatusModal = ({ onClose, onSubmit }) => {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');

  const statusOptions = [
    { value: 'pending', label: 'En attente' },
    { value: 'ongoing', label: 'En cours' },
    { value: 'completed', label: 'Terminée' },
    { value: 'cancelled', label: 'Annulée' }
  ];

  const handleSubmit = () => {
    if (!newStatus || !reason?.trim()) {
      alert('Veuillez sélectionner un statut et fournir une raison');
      return;
    }
    onSubmit(newStatus);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full">
        {/* Modal En-tête */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="Settings" size={20} className="text-[#17a2b8]" />
            <h2 className="text-xl font-semibold text-foreground">Forcer le statut</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-md transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <div className="flex gap-2">
              <Icon name="AlertTriangle" size={16} className="text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                Cette action modifie manuellement le statut de la réservation. Utilisez avec précaution.
              </p>
            </div>
          </div>

          <Select
            label="Nouveau statut"
            options={statusOptions}
            value={newStatus}
            onChange={setNewStatus}
            placeholder="Sélectionnez un statut"
            required
          />

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Raison de l'intervention <span className="text-error">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e?.target?.value)}
              placeholder="Expliquez pourquoi vous modifiez manuellement ce statut..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="default"
            iconName="Check"
            onClick={handleSubmit}
            className="bg-[#17a2b8] hover:bg-[#138496]"
          >
            Confirmer le changement
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ForceStatusModal;
