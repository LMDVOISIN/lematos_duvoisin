import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { generateAndUploadContract } from '../../../services/contractService';

const AcceptRejectModal = ({ reservation, actionType, onClose, onSubmit }) => {
  const [message, setMessage] = useState('');
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);

  const config = {
    accept: {
      title: 'Accepter la réservation',
      icon: 'CheckCircle',
      color: 'text-success',
      description: 'Confirmez que vous acceptez cette demande de réservation. Le locataire sera notifié et pourra procéder au paiement.',
      buttonLabel: 'Accepter',
      buttonVariant: 'success',
      messagePlaceholder: 'Message optionnel pour le locataire (instructions, point de rencontre, etc.)'
    },
    reject: {
      title: 'Refuser la réservation',
      icon: 'XCircle',
      color: 'text-error',
      description: 'Indiquez la raison du refus. Le locataire sera notifié et pourra chercher une autre option.',
      buttonLabel: 'Refuser',
      buttonVariant: 'danger',
      messagePlaceholder: 'Raison du refus (obligatoire)',
      messageRequired: true
    }
  };

  const currentConfig = config?.[actionType] || config?.accept;

  const handleSubmit = async () => {
    if (currentConfig?.messageRequired && !message?.trim()) {
      alert('Veuillez fournir une raison pour le refus');
      return;
    }

    // If accepting, generate contract
    if (actionType === 'accept') {
      try {
        setIsGeneratingContract(true);
        await generateAndUploadContract(reservation?.id);
        onSubmit(message);
      } catch (error) {
        console.error('Erreur lors de la génération de contract:', error);
        alert('Erreur lors de la génération du contrat. Veuillez réessayer.');
      } finally {
        setIsGeneratingContract(false);
      }
    } else {
      onSubmit(message);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full">
        {/* Modal En-tête */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name={currentConfig?.icon} size={20} className={currentConfig?.color} />
            <h2 className="text-xl font-semibold text-foreground">{currentConfig?.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-md transition-colors"
            disabled={isGeneratingContract}
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Reservation Info */}
          <div className="bg-surface rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-2">{reservation?.equipmentTitle}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="User" size={14} />
              <span>{reservation?.renterPseudo}</span>
              <span className="mx-2">•</span>
              <Icon name="Calendar" size={14} />
              <span>
                {new Date(reservation?.startDate)?.toLocaleDateString('fr-FR')} - {new Date(reservation?.endDate)?.toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{currentConfig?.description}</p>

          {/* Message Input */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Message {currentConfig?.messageRequired && <span className="text-error">*</span>}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e?.target?.value)}
              placeholder={currentConfig?.messagePlaceholder}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              disabled={isGeneratingContract}
            />
          </div>

          {isGeneratingContract && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="FileText" size={16} className="animate-pulse" />
              <span>Génération du contrat en cours...</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isGeneratingContract}>
            Annuler
          </Button>
          <Button
            variant={currentConfig?.buttonVariant}
            iconName={currentConfig?.icon}
            onClick={handleSubmit}
            disabled={isGeneratingContract}
          >
            {isGeneratingContract ? 'Génération...' : currentConfig?.buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AcceptRejectModal;

