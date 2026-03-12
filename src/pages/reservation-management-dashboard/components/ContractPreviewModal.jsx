import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { downloadContract } from '../../../services/contractService';

const ContractPreviewModal = ({ reservation, contractUrl, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadContract(contractUrl, reservation?.id);
    } catch (error) {
      console.error('Erreur lors du téléchargement de contract:', error);
      alert('Erreur lors du téléchargement du contrat');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="FileText" size={20} className="text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Contrat de location</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-md transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full border border-border rounded-lg overflow-hidden">
            <iframe
              src={contractUrl}
              className="w-full h-full"
              title="Aperçu du contrat"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <Icon name="Info" size={14} className="inline mr-1" />
            Contrat N° {reservation?.id}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button
              variant="primary"
              iconName="Download"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? 'Téléchargement...' : 'Télécharger PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractPreviewModal;

