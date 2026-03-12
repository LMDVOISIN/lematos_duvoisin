import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ExitQuestionnaireModal = ({ onClose, onSubmit, pageTitle }) => {
  const [foundWhatLookingFor, setFoundWhatLookingFor] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [understood, setUnderstood] = useState('');
  const [perceivedInfo, setPerceivedInfo] = useState('');

  const handleSubmit = () => {
    if (!foundWhatLookingFor || !nextStep || !understood) {
      alert('Veuillez répondre à toutes les questions obligatoires');
      return;
    }

    onSubmit({
      foundWhatLookingFor,
      nextStep,
      understood,
      perceivedInfo
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full my-8">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Icon name="FileQuestion" size={24} className="text-primary" />
            <h2 className="text-xl font-bold text-foreground">Questionnaire de sortie</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Page : {pageTitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <p className="text-sm text-foreground">
              <Icon name="AlertCircle" size={16} className="inline mr-2 text-warning" />
              Vous devez compléter ce questionnaire avant de quitter la page.
            </p>
          </div>

          {/* Question 1 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Avez-vous trouvé ce que vous cherchiez ? <span className="text-error">*</span>
            </label>
            <div className="space-y-2">
              {['Oui', 'Partiellement', 'Non']?.map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="found"
                    value={option}
                    checked={foundWhatLookingFor === option}
                    onChange={(e) => setFoundWhatLookingFor(e?.target?.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-foreground">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Quelle est la prochaine étape logique ? <span className="text-error">*</span>
            </label>
            <textarea
              value={nextStep}
              onChange={(e) => setNextStep(e?.target?.value)}
              placeholder="Décrivez ce que vous pensez devoir faire ensuite..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Question 3 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Qu'avez-vous compris de cette page ? <span className="text-error">*</span>
            </label>
            <textarea
              value={understood}
              onChange={(e) => setUnderstood(e?.target?.value)}
              placeholder="Résumez ce que vous avez compris..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Question 4 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Informations perçues (optionnel)
            </label>
            <textarea
              value={perceivedInfo}
              onChange={(e) => setPerceivedInfo(e?.target?.value)}
              placeholder="Quelles informations avez-vous retenues de cette page ?..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
          <Button
            variant="default"
            iconName="ArrowRight"
            onClick={handleSubmit}
            disabled={!foundWhatLookingFor || !nextStep || !understood}
          >
            Valider et continuer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExitQuestionnaireModal;

