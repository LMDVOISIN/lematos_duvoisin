import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const StatusChangeModal = ({ user, action, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');

  const actionConfig = {
    suspend: {
      title: 'Suspendre l\'utilisateur',
      icon: 'Ban',
      color: 'text-warning',
      description: 'L\'utilisateur ne pourra plus se connecter temporairement.',
      buttonLabel: 'Suspendre',
      buttonVariant: 'warning'
    },
    activate: {
      title: 'Activer l\'utilisateur',
      icon: 'CheckCircle',
      color: 'text-success',
      description: 'L\'utilisateur pourra à nouveau se connecter.',
      buttonLabel: 'Activer',
      buttonVariant: 'success'
    },
    ban: {
      title: 'Bannir l\'utilisateur',
      icon: 'XCircle',
      color: 'text-error',
      description: 'L\'utilisateur sera définitivement banni de la plateforme.',
      buttonLabel: 'Bannir',
      buttonVariant: 'danger'
    }
  };

  const config = actionConfig?.[action] || actionConfig?.suspend;

  const handleSubmit = () => {
    if (!reason?.trim() && action !== 'activate') {
      alert('Veuillez fournir une raison');
      return;
    }
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full">
        {/* Modal En-tête */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name={config?.icon} size={20} className={config?.color} />
            <h2 className="text-xl font-semibold text-foreground">{config?.title}</h2>
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
          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg">
            <img
              src={user?.avatar_url || user?.avatar || '/assets/images/no_image.png'}
              alt={user?.pseudo}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="font-medium text-foreground">{user?.pseudo}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{config?.description}</p>

          {action !== 'activate' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Raison <span className="text-error">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e?.target?.value)}
                placeholder="Expliquez la raison de cette action..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={config?.buttonVariant}
            iconName={config?.icon}
            onClick={handleSubmit}
          >
            {config?.buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StatusChangeModal;

