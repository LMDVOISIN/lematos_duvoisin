import React, { useState } from 'react';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

const ReportContentModal = ({ onClose, reportedItem, reportedUser }) => {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);

  const reportTypes = [
    { value: 'inappropriate', label: 'Annonce inappropriée' },
    { value: 'illegal', label: 'Contenu illégal' },
    { value: 'scam', label: 'Arnaque' },
    { value: 'suspicious', label: 'Utilisateur suspect' },
    { value: 'other', label: 'Autre' }
  ];

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e?.target?.files || []);
    setFiles([...files, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(files?.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!reportType || !description?.trim()) {
      alert('Veuillez sélectionner un type de signalement et fournir une description');
      return;
    }

    // Logique d'envoi du signalement ici
    console.log('Report submitted:', {
      type: reportType,
      description,
      files,
      reportedItem,
      reportedUser
    });

    alert('Signalement envoyé avec succès. Notre équipe va l\'examiner.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="Flag" size={20} className="text-error" />
            <h2 className="text-xl font-semibold text-foreground">Signaler un contenu</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-md transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            Aidez-nous à maintenir une communauté sûre en signalant tout contenu inapproprié ou comportement suspect.
          </p>

          {/* Report Type */}
          <Select
            label="Type de signalement"
            options={reportTypes}
            value={reportType}
            onChange={setReportType}
            placeholder="Sélectionnez un type"
            required
          />

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Description détaillée <span className="text-error">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e?.target?.value)}
              placeholder="Décrivez en détail le problème que vous signalez..."
              rows={6}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {description?.length} / 1000 caractères
            </p>
          </div>

          {/* Téléversement de fichier */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Preuves (optionnel)
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Icon name="Upload" size={32} className="text-muted-foreground" />
                <p className="text-sm text-foreground font-medium">Cliquez pour ajouter des fichiers</p>
                <p className="text-xs text-muted-foreground">Images ou PDF (max 10 Mo par fichier)</p>
              </label>
            </div>

            {/* File List */}
            {files?.length > 0 && (
              <div className="mt-4 space-y-2">
                {files?.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-surface rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name="File" size={16} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate">{file?.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file?.size / 1024)?.toFixed(1)} Ko)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-error/10 rounded transition-colors"
                    >
                      <Icon name="X" size={16} className="text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Icon name="Info" size={16} className="text-[#17a2b8] mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Que se passe-t-il après?</p>
                <p>Notre équipe de modération examinera votre signalement sous 48h. Vous serez notifié des actions prises. Tous les signalements sont traités de manière confidentielle.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            iconName="Flag"
            onClick={handleSubmit}
          >
            Envoyer le signalement
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportContentModal;


