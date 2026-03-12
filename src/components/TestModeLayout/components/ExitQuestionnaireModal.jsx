import React, { useState } from 'react';


const ExitQuestionnaireModal = ({ questions, onComplete }) => {
  const [answers, setAnswers] = useState({});
  const [perceivedInfo, setPerceivedInfo] = useState('');
  const [nextActionUnderstood, setNextActionUnderstood] = useState(null);

  const handleSubmit = () => {
    const allQuestionsAnswered = questions?.every(q => answers?.[q]);
    
    if (allQuestionsAnswered && nextActionUnderstood !== null) {
      onComplete({
        exitAnswers: answers,
        perceivedInfo,
        nextActionUnderstood
      });
    }
  };

  const isComplete = questions?.every(q => answers?.[q]) && nextActionUnderstood !== null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Questionnaire de sortie</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Avant de quitter cette page, merci de répondre aux questions suivantes :
        </p>

        {/* Exit Questions */}
        <div className="space-y-4 mb-6">
          {questions?.map((question, index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {question}
              </label>
              <textarea
                value={answers?.[question] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [question]: e?.target?.value }))}
                placeholder="Votre réponse..."
                className="w-full border border-gray-300 rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>

        {/* Perceived Information */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quelles informations avez-vous perçues sur cette page ?
          </label>
          <textarea
            value={perceivedInfo}
            onChange={(e) => setPerceivedInfo(e?.target?.value)}
            placeholder="Décrivez les informations principales que vous avez retenues..."
            className="w-full border border-gray-300 rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Next Action Understanding */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Savez-vous quelle est la prochaine étape logique ?
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setNextActionUnderstood(true)}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                nextActionUnderstood === true
                  ? 'border-green-500 bg-green-50 text-green-700' :'border-gray-300 hover:border-green-500'
              }`}
            >
              Oui, c'est clair
            </button>
            <button
              onClick={() => setNextActionUnderstood(false)}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                nextActionUnderstood === false
                  ? 'border-red-500 bg-red-50 text-red-700' :'border-gray-300 hover:border-red-500'
              }`}
            >
              Non, je ne sais pas
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isComplete}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Valider et continuer
        </button>

        <p className="text-xs text-gray-500 mt-3 text-center">
          Vous devez répondre à toutes les questions pour continuer
        </p>
      </div>
    </div>
  );
};

export default ExitQuestionnaireModal;