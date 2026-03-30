import React, { useState } from 'react';
import Icon from './AppIcon';
import Button from './ui/Button';
import Select from './ui/Select';
import reportService from '../services/reportService';
import { useAuth } from '../contexts/AuthContext';
import { isAdminVerificationScenario } from '../utils/adminVerificationContext';

const REPORT_CATEGORIES = [
  { value: 'inappropriate', label: 'Annonce inappropriee' },
  { value: 'illegal', label: 'Contenu illegal' },
  { value: 'scam', label: 'Arnaque' },
  { value: 'suspicious', label: 'Utilisateur suspect' },
  { value: 'other', label: 'Autre' }
];

const ReportModal = ({ onClose, reportType = 'listing', targetId, targetName }) => {
  const { user } = useAuth();
  const isVerificationReportScenario = isAdminVerificationScenario('partial_reporting_front_only');
  const [reportCategory, setReportCategory] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleFileChange = (event) => {
    const files = Array.from(event?.target?.files || []);
    if ((files?.length || 0) + evidenceFiles?.length > 5) {
      window.alert('Vous ne pouvez ajouter que 5 fichiers maximum');
      return;
    }

    setEvidenceFiles((previous) => [...previous, ...files]);
  };

  const removeFile = (index) => {
    setEvidenceFiles((previous) => previous?.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setSubmitMessage('');
    setSubmitError('');

    if (!reportCategory) {
      window.alert('Veuillez selectionner un type de signalement');
      return;
    }

    if (!description?.trim()) {
      window.alert('Veuillez decrire le probleme');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await reportService.submitReport({
        reportType,
        targetId,
        targetName,
        category: reportCategory,
        description,
        evidenceFiles,
        reporterEmail: user?.email || ''
      });

      if (error) throw error;

      setSubmitMessage(`Signalement envoye sous la reference #${data?.id || 'N/A'}.`);
      setReportCategory('');
      setDescription('');
      setEvidenceFiles([]);
    } catch (error) {
      console.error('Erreur lors de l’envoi du signalement:', error);
      setSubmitError(error?.message || "Impossible d'envoyer le signalement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSubmit = async () => {
    setSubmitMessage('');
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const { data, error } = await reportService.submitReport({
        reportType,
        targetId,
        targetName,
        category: 'other',
        description: 'Signalement de verification admin pour controle end-to-end.',
        evidenceFiles: [],
        reporterEmail: user?.email || ''
      });

      if (error) throw error;

      setSubmitMessage(`Signalement de verification envoye sous la reference #${data?.id || 'N/A'}.`);
    } catch (error) {
      console.error('Erreur lors de l envoi du signalement de verification:', error);
      setSubmitError(error?.message || "Impossible d'envoyer le signalement de verification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-viewport z-50 bg-black/50">
      <div className="modal-card modal-card-shell my-4 max-w-2xl rounded-lg bg-white">
        <div className="sticky top-0 flex items-center justify-between rounded-t-lg border-b border-border bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">Signaler un probleme</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fermer le signalement"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-card-body space-y-6 px-6 py-6">
          {submitMessage ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {submitMessage}
            </div>
          ) : null}

          {submitError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="rounded-lg bg-surface p-4">
            <p className="mb-1 text-sm text-muted-foreground">
              {reportType === 'listing' ? 'Annonce signalee' : 'Utilisateur signale'}
            </p>
            <p className="font-medium text-foreground">{targetName}</p>
          </div>

          <Select
            id="listing-report-category"
            label="Type de signalement"
            placeholder="Selectionnez un type"
            options={REPORT_CATEGORIES}
            value={reportCategory}
            onChange={setReportCategory}
            required
          />

          <div>
            <label htmlFor="listing-report-description" className="mb-2 block text-sm font-medium text-foreground">
              Description du probleme <span className="text-error">*</span>
            </label>
            <textarea
              id="listing-report-description"
              value={description}
              onChange={(event) => setDescription(event?.target?.value)}
              placeholder="Decrivez en detail le probleme rencontre..."
              className="min-h-[120px] w-full rounded-md border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#17a2b8]"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Soyez aussi precis que possible pour nous aider a traiter votre signalement.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Preuves (optionnel)</label>
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
              <input
                type="file"
                id="listing-report-evidence-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="listing-report-evidence-upload"
                className="inline-flex cursor-pointer flex-col items-center"
              >
                <Icon name="Upload" size={32} className="mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Cliquez pour ajouter des fichiers</p>
                <p className="mt-1 text-xs text-muted-foreground">Images ou PDF, 5 fichiers maximum</p>
              </label>
            </div>

            {evidenceFiles?.length > 0 ? (
              <div className="mt-4 space-y-2">
                {evidenceFiles?.map((file, index) => (
                  <div key={`${file?.name}-${index}`} className="flex items-center justify-between rounded-lg bg-surface p-3">
                    <div className="flex items-center gap-3">
                      <Icon name="File" size={20} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{file?.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-error transition-colors hover:text-error/80"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <Icon name="Info" size={20} className="mt-0.5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="mb-1 font-medium">Que se passe-t-il ensuite ?</p>
              <p>Notre equipe de moderation examinera votre signalement puis le fera remonter dans l’admin.</p>
            </div>
          </div>
          {isVerificationReportScenario ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900">Verification admin</p>
              <p className="mt-1 text-sm text-green-800">
                Ce bouton envoie un signalement pre-rempli pour la verification end-to-end.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleVerificationSubmit()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  data-testid="listing-report-verification-submit"
                >
                  Envoyer un signalement de verification
                </Button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="sticky bottom-0 flex gap-3 rounded-b-lg border-t border-border bg-surface px-6 py-4">
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
            data-testid="listing-report-submit"
          >
            {isSubmitting ? 'Envoi en cours...' : 'Envoyer le signalement'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
