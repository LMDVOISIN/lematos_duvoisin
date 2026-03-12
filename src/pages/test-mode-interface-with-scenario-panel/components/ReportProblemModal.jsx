import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import testingService from '../../../services/testingService';
import toast from 'react-hot-toast';

const ReportProblemModal = ({ onClose, sessionId, currentPageUrl }) => {
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const severityOptions = [
    { value: 'critical', label: 'Critique - Bloque complètement' },
    { value: 'high', label: 'Élevé - Problème majeur' },
    { value: 'medium', label: 'Moyen - Gêne l\'\'utilisation' },
    { value: 'low', label: 'Faible - Amélioration souhaitée' }
  ];

  const handleFileChange = async (e) => {
    const files = Array.from(e?.target?.files || []);
    if (files?.length + screenshots?.length > 5) {
      toast.error('Vous ne pouvez ajouter que 5 fichiers maximum');
      return;
    }

    setUploading(true);

    const uploadedUrls = [];
    for (const file of files) {
      const { data, error } = await testingService?.uploadScreenshot(file, sessionId);
      if (!error && data) {
        uploadedUrls?.push(data?.url);
      }
    }

    setScreenshots([...screenshots, ...uploadedUrls]);
    setUploading(false);
    toast.success(`${uploadedUrls?.length} fichier(s) ajouté(s)`);
  };

  const removeScreenshot = (index) => {
    setScreenshots(screenshots?.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!severity) {
      toast.error('Veuillez sélectionner la gravité du problème');
      return;
    }

    if (!description?.trim()) {
      toast.error('Veuillez décrire le problème');
      return;
    }

    setSubmitting(true);

    const { data, error } = await testingService?.createProblemReport(sessionId, {
      pageUrl: currentPageUrl,
      severity,
      description,
      reproductionSteps,
      screenshotUrls: screenshots
    });

    setSubmitting(false);

    if (error) {
      toast.error('Erreur lors de l\'envoi du signalement');
      return;
    }

    toast.success('Signalement envoyé avec succès');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full my-8">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Icon name="Flag" size={24} className="text-error" />
            <h2 className="text-xl font-bold text-foreground">Signaler un problème</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Page actuelle */}
          <div className="bg-surface rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Page actuelle</p>
            <p className="font-medium text-foreground">{currentPageUrl}</p>
          </div>

          {/* Gravite */}
          <Select
            label="Gravité du problème"
            placeholder="Sélectionnez la gravité"
            options={severityOptions}
            value={severity}
            onChange={setSeverity}
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
              placeholder="Décrivez précisément le problème rencontré..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Etapes de reproduction */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Étapes de reproduction (optionnel)
            </label>
            <textarea
              value={reproductionSteps}
              onChange={(e) => setReproductionSteps(e?.target?.value)}
              placeholder="1. Aller sur...\n2. Cliquer sur...\n3. Observer..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Captures d'ecran */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Captures d'écran (max 5)
            </label>
            <div className="space-y-3">
              {screenshots?.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {screenshots?.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Capture ${index + 1}`}
                        className="w-full h-24 object-cover rounded-md border border-border"
                      />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-1 right-1 bg-error text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icon name="X" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {screenshots?.length < 5 && (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors">
                  <Icon name={uploading ? 'Loader' : 'Upload'} size={20} className={uploading ? 'animate-spin' : ''} />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Envoi en cours...' : 'Ajouter des captures'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Pied de fen?tre */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="default"
            iconName="Send"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!severity || !description?.trim()}
          >
            Envoyer le signalement
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportProblemModal;


