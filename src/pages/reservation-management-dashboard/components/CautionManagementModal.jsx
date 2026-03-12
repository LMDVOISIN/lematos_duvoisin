import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CautionManagementModal = ({ onClose, onAction, reservation }) => {
  const [selectedAction, setSelectedAction] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedAction) {
      alert('Veuillez sélectionner une action');
      return;
    }

    setLoading(true);
    await onAction(selectedAction);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h4 font-heading text-foreground">Gestion de l'empreinte CB</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface rounded transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          <div className="bg-surface rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Montant de la garantie</span>
              <span className="text-xl font-bold text-foreground">{reservation?.cautionAmount?.toFixed(2)} €</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Statut actuel</span>
              <span className="px-2 py-1 bg-warning/10 text-warning text-xs font-medium rounded">
                Empreinte enregistrée
              </span>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <label className="text-sm font-medium text-foreground">Action à effectuer</label>
            
            <label
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedAction === 'release' ?'border-success bg-success/5' :'border-border hover:border-success/50'
              }`}
            >
              <input
                type="radio"
                name="cautionAction"
                value="release"
                checked={selectedAction === 'release'}
                onChange={(e) => setSelectedAction(e?.target?.value)}
                className="w-4 h-4 text-success mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="CheckCircle" size={16} className="text-success" />
                  <span className="text-sm font-medium text-foreground">Libérer l'empreinte CB</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  L'équipement a été restitué en bon état. L'empreinte CB sera libérée et le locataire sera notifié.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedAction === 'capture' ?'border-error bg-error/5' :'border-border hover:border-error/50'
              }`}
            >
              <input
                type="radio"
                name="cautionAction"
                value="capture"
                checked={selectedAction === 'capture'}
                onChange={(e) => setSelectedAction(e?.target?.value)}
                className="w-4 h-4 text-error mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="AlertTriangle" size={16} className="text-error" />
                  <span className="text-sm font-medium text-foreground">Capturer l'empreinte CB</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  L'équipement a été endommagé ou non restitué. L'empreinte CB déjà enregistrée sera capturée en totalité ou partiellement selon la décision finale.
                </p>
              </div>
            </label>
          </div>

          {selectedAction === 'capture' && (
            <div className="bg-error/10 border border-error rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={16} className="text-error mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Action irréversible</p>
                  <p className="text-xs text-muted-foreground">
                    La capture de l'empreinte CB est définitive. Assurez-vous d'avoir des preuves des dommages (photos, messages).
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Apres capture, les frais de paiement carte standards s'appliquent sur le montant capture. Si ce debit est ensuite conteste, des frais de litige peuvent aussi s'appliquer selon le reseau de carte utilise.
                  </p>
                </div>
              </div>
            </div>
          )}

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
              variant={selectedAction === 'capture' ? 'danger' : 'default'}
              fullWidth
              loading={loading}
              iconName={selectedAction === 'capture' ? 'AlertTriangle' : 'CheckCircle'}
            >
              {selectedAction === 'capture' ? 'Capturer' : 'Libérer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CautionManagementModal;

