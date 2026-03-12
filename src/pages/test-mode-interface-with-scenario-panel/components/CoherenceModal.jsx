import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CoherenceModal = ({ onClose, onSubmit, question, pageTitle }) => {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (!answer?.trim()) {
      alert('Veuillez répondre à la question');
      return;
    }
    onSubmit(answer);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Icon name="HelpCircle" size={24} className="text-primary" />
            <h2 className="text-xl font-bold text-foreground">Question de cohérence</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Page : {pageTitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <Icon name="Info" size={16} className="inline mr-2" />
              Vous devez répondre à cette question avant de pouvoir interagir avec la page.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {question}
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e?.target?.value)}
              placeholder="Votre réponse..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
          <Button
            variant="default"
            iconName="Check"
            onClick={handleSubmit}
            disabled={!answer?.trim()}
          >
            Valider et continuer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CoherenceModal;

