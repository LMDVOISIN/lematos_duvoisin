import React, { useState } from 'react';
import Icon from './AppIcon';
import Button from './ui/Button';
import Select from './ui/Select';

const ReportModal = ({ onClose, reportType = 'listing', targetId, targetName }) => {
  const [reportCategory, setReportCategory] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportCategories = [
    { value: 'inappropriate', label: 'Annonce inappropriée' },
    { value: 'illegal', label: 'Contenu illégal' },
    { value: 'scam', label: 'Arnaque' },
    { value: 'suspicious', label: 'Utilisateur suspect' },
    { value: 'other', label: 'Autre' }
  ];

  const handleFileChange = (e) => {
    const files = Array.from(e?.target?.files);
    if (files?.length + evidenceFiles?.length > 5) {
      alert('Vous ne pouvez ajouter que 5 fichiers maximum');
      return;
    }
    setEvidenceFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setEvidenceFiles(prev => prev?.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!reportCategory) {
      alert('Veuillez sélectionner un type de signalement');
      return;
    }

    if (!description?.trim()) {
      alert('Veuillez décrire le problème');
      return;
    }

    setIsSubmitting(true);

    // Simuler un appel API
    setTimeout(() => {
      console.log('Report submitted:', {
        reportType,
        targetId,
        targetName,
        category: reportCategory,
        description,
        evidenceCount: evidenceFiles?.length
      });
      setIsSubmitting(false);
      alert('Votre signalement a été envoyé. Notre équipe l\'examinera dans les plus brefs délais.');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full my-8">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-foreground">Signaler un problème</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Contenu */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Cible signalee */}
          <div className="bg-surface rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">
              {reportType === 'listing' ? 'Annonce signalée' : 'Utilisateur signalé'}
            </p>
            <p className="font-medium text-foreground">{targetName}</p>
          </div>

          {/* Categorie du signalement */}
          <Select
            label="Type de signalement"
            placeholder="Sélectionnez un type"
            options={reportCategories}
            value={reportCategory}
            onChange={setReportCategory}
            required
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description du problème <span className="text-error">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e?.target?.value)}
              placeholder="Décrivez en détail le problème rencontré..."
              className="w-full border border-border rounded-md p-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#17a2b8]"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Soyez aussi précis que possible pour nous aider à traiter votre signalement
            </p>
          </div>

          {/* Téléversement des preuves */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Preuves (optionnel)
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                id="evidence-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="evidence-upload"
                className="cursor-pointer inline-flex flex-col items-center"
              >
                <Icon name="Upload" size={32} className="text-muted-foreground mb-2" />
                <p className="text-sm text-foreground font-medium">Cliquez pour ajouter des fichiers</p>
                <p className="text-xs text-muted-foreground mt-1">Images ou PDF (max 5 fichiers)</p>
              </label>
            </div>

            {/* Liste des fichiers */}
            {evidenceFiles?.length > 0 && (
              <div className="mt-4 space-y-2">
                {evidenceFiles?.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-surface rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Icon name="File" size={20} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{file?.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-error hover:text-error/80 transition-colors"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bloc d'information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <Icon name="Info" size={20} className="text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Que se passe-t-il après?</p>
              <p>Notre équipe de modération examinera votre signalement dans les 24-48h. Vous recevrez une notification dès que des mesures auront été prises.</p>
            </div>
          </div>
        </form>

        {/* Pied de fen?tre */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 rounded-b-lg flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            className="flex-1"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Envoi en cours...' : 'Envoyer le signalement'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;

