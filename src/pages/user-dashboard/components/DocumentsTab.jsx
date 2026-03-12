import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DocumentsTab = () => {
  const [documents, setDocuments] = useState([
    {
      id: 1,
      type: 'identity',
      name: 'Carte d\'identité',
      fileName: 'carte-identite.pdf',
      uploadDate: '2026-01-15',
      status: 'approved',
      adminComment: null
    },
    {
      id: 2,
      type: 'address',
      name: 'Justificatif de domicile',
      fileName: 'facture-edf-janvier-2026.pdf',
      uploadDate: '2026-01-15',
      status: 'approved',
      adminComment: null
    },
    {
      id: 3,
      type: 'insurance',
      name: 'Attestation d\'assurance',
      fileName: 'assurance-rc.pdf',
      uploadDate: '2026-02-10',
      status: 'pending',
      adminComment: null
    },
    {
      id: 4,
      type: 'bank',
      name: 'RIB',
      fileName: null,
      uploadDate: null,
      status: 'missing',
      adminComment: null
    }
  ]);

  const [dragActive, setDragActive] = useState(null);

  const getStatusConfig = (status) => {
    const configs = {
      approved: {
        label: 'Validé',
        icon: 'CheckCircle',
        color: 'text-success bg-success/10'
      },
      pending: {
        label: 'En attente',
        icon: 'Clock',
        color: 'text-warning bg-warning/10'
      },
      rejected: {
        label: 'Refusé',
        icon: 'XCircle',
        color: 'text-error bg-error/10'
      },
      missing: {
        label: 'Manquant',
        icon: 'AlertCircle',
        color: 'text-muted-foreground bg-muted'
      }
    };
    return configs?.[status] || configs?.missing;
  };

  const handleDrag = (e, documentType) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (e?.type === 'dragenter' || e?.type === 'dragover') {
      setDragActive(documentType);
    } else if (e?.type === 'dragleave') {
      setDragActive(null);
    }
  };

  const handleDrop = (e, documentType) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDragActive(null);
    
    if (e?.dataTransfer?.files && e?.dataTransfer?.files?.[0]) {
      handleFileUpload(documentType, e?.dataTransfer?.files?.[0]);
    }
  };

  const handleFileInput = (e, documentType) => {
    if (e?.target?.files && e?.target?.files?.[0]) {
      handleFileUpload(documentType, e?.target?.files?.[0]);
    }
  };

  const handleFileUpload = (documentType, file) => {
    console.log('Uploading file:', file?.name, 'for type:', documentType);
    // Simulate upload - in real app, this would upload to server
  };

  const missingDocuments = documents?.filter(d => d?.status === 'missing');
  const pendingDocuments = documents?.filter(d => d?.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Missing Documents Banner */}
      {missingDocuments?.length > 0 && (
        <div className="bg-warning/10 border border-warning rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertCircle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">Documents manquants</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Veuillez télécharger les documents suivants pour compléter votre profil:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {missingDocuments?.map(doc => (
                  <li key={doc?.id}>{doc?.name}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Section de téléversement */}
      <div className="bg-surface rounded-lg border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Icon name="Upload" size={20} />
          Télécharger un document
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents?.map((doc) => (
            <div
              key={doc?.id}
              onDragEnter={(e) => handleDrag(e, doc?.type)}
              onDragLeave={(e) => handleDrag(e, doc?.type)}
              onDragOver={(e) => handleDrag(e, doc?.type)}
              onDrop={(e) => handleDrop(e, doc?.type)}
              className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                dragActive === doc?.type
                  ? 'border-[#17a2b8] bg-[#17a2b8]/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <div className="text-center">
                <Icon name="FileText" size={32} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground mb-1">{doc?.name}</p>
                <p className="text-xs text-muted-foreground mb-3">PDF, JPG, PNG (max 5 Mo)</p>
                <label htmlFor={`file-${doc?.type}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Upload"
                    className="cursor-pointer"
                    asChild
                  >
                    <span>Choisir un fichier</span>
                  </Button>
                  <input
                    id={`file-${doc?.type}`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileInput(e, doc?.type)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Icon name="FileText" size={20} />
            Mes documents
          </h3>
        </div>
        
        <div className="divide-y divide-border">
          {documents?.map((doc) => {
            const statusConfig = getStatusConfig(doc?.status);
            return (
              <div key={doc?.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-surface rounded-lg">
                      <Icon name="FileText" size={20} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground mb-1">{doc?.name}</h4>
                      {doc?.fileName && (
                        <p className="text-sm text-muted-foreground mb-1">{doc?.fileName}</p>
                      )}
                      {doc?.uploadDate && (
                        <p className="text-xs text-muted-foreground">
                          Téléchargé le {new Date(doc?.uploadDate)?.toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {doc?.adminComment && (
                        <div className="mt-2 p-2 bg-error/10 rounded text-xs text-error">
                          <strong>Commentaire admin:</strong> {doc?.adminComment}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                      <Icon name={statusConfig?.icon} size={14} />
                      <span>{statusConfig?.label}</span>
                    </div>
                    {doc?.fileName && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="xs" iconName="Eye">
                          Voir
                        </Button>
                        <Button variant="ghost" size="xs" iconName="Trash2" className="text-error hover:text-error">
                          Supprimer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={20} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="mb-2"><strong>Documents requis pour la vérification:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Pièce d'identité valide (carte d'identité, passeport ou permis de conduire)</li>
              <li>Justificatif de domicile de moins de 3 mois</li>
              <li>Attestation d'assurance responsabilité civile (optionnel mais recommandé)</li>
              <li>RIB pour recevoir les paiements (si vous louez vos équipements)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsTab;
