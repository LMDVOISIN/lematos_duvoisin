import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ReportDetailModal = ({ report, onClose }) => {
  const [actionReason, setActionReason] = useState('');
  const [showActionConfirm, setShowActionConfirm] = useState(false);
  const [actionType, setActionType] = useState(null);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date?.getTime())) return '-';
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAction = (type) => {
    setActionType(type);
    setShowActionConfirm(true);
  };

  const confirmAction = () => {
    console.log(`Action ${actionType} confirmed for report ${report?.id}`);
    console.log('Reason:', actionReason);
    // Here you would call the API to perform the action
    setShowActionConfirm(false);
    setActionReason('');
    onClose();
  };

  const cancelAction = () => {
    setShowActionConfirm(false);
    setActionType(null);
    setActionReason('');
  };

  const getActionLabel = (type) => {
    switch (type) {
      case 'contact': return 'Contacter l\'utilisateur';
      case 'delete': return 'Supprimer le contenu';
      case 'ban': return 'Suspendre l\'utilisateur';
      case 'resolve': return 'Marquer comme résolu';
      case 'reject': return 'Rejeter le signalement';
      default: return 'Action';
    }
  };

  if (showActionConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-foreground mb-4">
            Confirmer l'action
          </h3>
          <p className="text-muted-foreground mb-4">
            Vous êtes sur le point de : <strong>{getActionLabel(actionType)}</strong>
          </p>
          <textarea
            className="w-full border border-border rounded-md p-3 text-sm mb-4 min-h-[100px]"
            placeholder="Raison de cette action (optionnel)..."
            value={actionReason}
            onChange={(e) => setActionReason(e?.target?.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={cancelAction} className="flex-1">
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmAction} className="flex-1">
              Confirmer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full my-8">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-foreground">Détails du signalement #{report?.id}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Report Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Type de signalement</p>
              <p className="text-foreground font-medium">{report?.type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Statut</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                report?.status === 'Nouveau' ? 'bg-blue-100 text-blue-800' :
                report?.status === 'En cours' ? 'bg-yellow-100 text-yellow-800' :
                report?.status === 'Traite' || report?.status === 'Traité' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {report?.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Signalé par</p>
              <p className="text-foreground font-medium">{report?.reporterPseudo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Date</p>
              <p className="text-foreground">{formatDate(report?.submissionDate)}</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Reported User/Content */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Élément signalé</h3>
            <div className="bg-surface rounded-lg p-4 space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Utilisateur concerné</p>
                <p className="text-foreground font-medium">{report?.reportedUser}</p>
              </div>
              {report?.reportedContent && (
                <div>
                  <p className="text-sm text-muted-foreground">Contenu concerné</p>
                  <p className="text-foreground font-medium">{report?.reportedContent}</p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Description</h3>
            <p className="text-muted-foreground">{report?.description}</p>
          </div>

          {/* Evidence */}
          {report?.evidence?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Preuves jointes</h3>
              <div className="grid grid-cols-2 gap-4">
                {report?.evidence?.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Evidence ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border border-border"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 rounded-b-lg">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('contact')}
            >
              <Icon name="Mail" size={16} />
              Contacter
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleAction('delete')}
            >
              <Icon name="Trash2" size={16} />
              Supprimer contenu
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={() => handleAction('ban')}
            >
              <Icon name="UserX" size={16} />
              Suspendre utilisateur
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => handleAction('resolve')}
            >
              <Icon name="CheckCircle" size={16} />
              Résoudre
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction('reject')}
            >
              <Icon name="X" size={16} />
              Rejeter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailModal;
