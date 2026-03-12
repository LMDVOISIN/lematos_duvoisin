import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

import Button from '../../../components/ui/Button';

const DocumentsTab = ({ documents, onUploadDocument, onDeleteDocument }) => {
  const [dragActive, setDragActive] = useState(null);
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const approvedCount = safeDocuments?.filter((doc) => doc?.status === 'approved')?.length;
  const progressPercent = safeDocuments?.length > 0 ? Math.round((approvedCount / safeDocuments?.length) * 100) : 0;
  const sortedDocuments = [...safeDocuments]?.sort((a, b) => new Date(b?.uploadDate) - new Date(a?.uploadDate));

  const handleDrag = (e, documentType) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (e?.type === "dragenter" || e?.type === "dragover") {
      setDragActive(documentType);
    } else if (e?.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (e, documentType) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDragActive(null);
    
    if (e?.dataTransfer?.files && e?.dataTransfer?.files?.[0]) {
      onUploadDocument(documentType, e?.dataTransfer?.files?.[0]);
    }
  };

  const handleFileInput = (e, documentType) => {
    if (e?.target?.files && e?.target?.files?.[0]) {
      onUploadDocument(documentType, e?.target?.files?.[0]);
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      approved: 'CheckCircle',
      pending: 'Clock',
      rejected: 'XCircle',
      missing: 'AlertCircle'
    };
    return icons?.[status] || 'FileText';
  };

  const getStatusColor = (status) => {
    const colors = {
      approved: 'text-success bg-success/10',
      pending: 'text-warning bg-warning/10',
      rejected: 'text-error bg-error/10',
      missing: 'text-muted-foreground bg-muted'
    };
    return colors?.[status] || 'text-muted-foreground bg-muted';
  };

  const getStatusLabel = (status) => {
    const labels = {
      approved: 'Approuvé',
      pending: 'En attente',
      rejected: 'Rejeté',
      missing: 'Manquant'
    };
    return labels?.[status] || status;
  };

  const documentCategories = [
    {
      id: 'identity',
      title: 'Pièce d\'identité',
      description: 'Carte d\'identité, passeport ou permis de conduire',
      required: true,
      acceptedFormats: 'PDF, JPG, PNG (max 5 Mo)',
      icon: 'IdCard'
    },
    {
      id: 'address',
      title: 'Justificatif de domicile',
      description: 'Facture de moins de 3 mois',
      required: true,
      acceptedFormats: 'PDF, JPG, PNG (max 5 Mo)',
      icon: 'Home'
    },
    {
      id: 'insurance',
      title: 'Attestation d\'assurance',
      description: 'Assurance responsabilité civile',
      required: false,
      acceptedFormats: 'PDF (max 5 Mo)',
      icon: 'Shield'
    },
    {
      id: 'bank',
      title: 'RIB',
      description: 'Relevé d\'identité bancaire',
      required: false,
      acceptedFormats: 'PDF (max 5 Mo)',
      icon: 'CreditCard'
    }
  ];

  const getDocumentForCategory = (categoryId) => {
    return safeDocuments?.find((doc) => doc?.type === categoryId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2">
        <div className="flex items-start gap-3 mb-6 p-4 bg-primary/10 rounded-lg">
          <Icon name="Info" size={24} color="var(--color-primary)" />
          <div>
            <p className="font-medium text-foreground mb-1">Vérification de compte</p>
            <p className="text-sm text-muted-foreground">
              Téléchargez vos documents pour vérifier votre compte et accéder à toutes les fonctionnalités de la plateforme.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Documents approuvés</p>
            <p className="text-2xl md:text-3xl font-semibold text-foreground">
              {approvedCount}/{safeDocuments?.length}
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Progression</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xl md:text-2xl font-semibold text-foreground whitespace-nowrap">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {documentCategories?.map((category) => {
            const document = getDocumentForCategory(category?.id);
            const hasDocument = !!document;

            return (
              <div key={category?.id} className="bg-surface rounded-lg p-4 md:p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon name={category?.icon} size={24} color="var(--color-primary)" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-base md:text-lg font-semibold text-foreground">
                          {category?.title}
                        </h4>
                        {category?.required && (
                          <span className="px-2 py-0.5 bg-error/10 text-error text-xs font-medium rounded">
                            Requis
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {category?.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Formats acceptés: {category?.acceptedFormats}
                      </p>
                    </div>
                  </div>

                  <div className="lg:w-80">
                    {hasDocument ? (
                      <div className="space-y-3">
                        <div className={`flex items-center justify-between p-3 rounded-lg ${getStatusColor(document?.status)}`}>
                          <div className="flex items-center gap-2">
                            <Icon name={getStatusIcon(document?.status)} size={20} />
                            <span className="font-medium">{getStatusLabel(document?.status)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                          <Icon name="FileText" size={20} color="var(--color-muted-foreground)" />
                          <span className="text-sm text-foreground flex-1 truncate">{document?.fileName}</span>
                          <button
                            onClick={() => onDeleteDocument(document?.id)}
                            className="p-1 hover:bg-surface rounded transition-smooth"
                          >
                            <Icon name="Trash2" size={16} color="var(--color-error)" />
                          </button>
                        </div>
                        {document?.status === 'rejected' && document?.rejectionReason && (
                          <div className="p-3 bg-error/10 rounded-lg">
                            <p className="text-sm text-error">{document?.rejectionReason}</p>
                          </div>
                        )}
                        {document?.status === 'approved' && document?.approvedDate && (
                          <p className="text-xs text-muted-foreground">
                            Approuvé le {new Date(document.approvedDate)?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-smooth ${
                          dragActive === category?.id
                            ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                        }`}
                        onDragEnter={(e) => handleDrag(e, category?.id)}
                        onDragLeave={(e) => handleDrag(e, category?.id)}
                        onDragOver={(e) => handleDrag(e, category?.id)}
                        onDrop={(e) => handleDrop(e, category?.id)}
                      >
                        <Icon name="Upload" size={32} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          Glissez-déposez votre fichier
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">ou</p>
                        <label>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileInput(e, category?.id)}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <span>Parcourir les fichiers</span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2">
        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Historique des documents</h3>
        <div className="space-y-3">
          {sortedDocuments?.length === 0 ? (
            <div className="p-4 bg-surface rounded-lg text-sm text-muted-foreground">
              Aucun document fourni pour le moment.
            </div>
          ) : sortedDocuments?.map((doc) => (
              <div key={doc?.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon name="FileText" size={20} color="var(--color-muted-foreground)" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc?.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      Téléchargé le {new Date(doc.uploadDate)?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(doc?.status)}`}>
                  {getStatusLabel(doc?.status)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentsTab;
