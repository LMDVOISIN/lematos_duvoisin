import React, { useMemo, useState } from 'react';

const ExitQuestionnaireModal = ({
  questions,
  textPrompt = '',
  textPlaceholder = '',
  onComplete
}) => {
  const normalizedQuestions = useMemo(
    () => (Array.isArray(questions) ? questions.filter(Boolean) : []),
    [questions]
  );

  const [answers, setAnswers] = useState({});
  const [perceivedInfo, setPerceivedInfo] = useState('');

  const allQuestionsAnswered = normalizedQuestions.every((question) => {
    return String(answers?.[question?.label] || '').trim().length > 0;
  });
  const isComplete = allQuestionsAnswered && String(perceivedInfo || '').trim().length > 0;

  const handleChoice = (questionLabel, optionLabel) => {
    setAnswers((previous) => ({
      ...previous,
      [questionLabel]: optionLabel
    }));
  };

  const handleSubmit = () => {
    if (!isComplete) return;

    onComplete({
      exitAnswers: answers,
      perceivedInfo: perceivedInfo.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Questionnaire rapide</h3>
        <p className="mb-6 text-sm text-gray-600">
          Merci de prendre quelques secondes pour decrire votre ressenti sur les deux dernieres pages.
        </p>

        <div className="space-y-6">
          {normalizedQuestions.map((question) => (
            <div key={question?.id || question?.label} className="space-y-3">
              <label className="block text-sm font-medium text-gray-800">{question?.label}</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Array.isArray(question?.options) ? question.options : []).map((option) => {
                  const optionLabel = String(option || '').trim();
                  const isSelected = answers?.[question?.label] === optionLabel;

                  return (
                    <button
                      key={optionLabel}
                      type="button"
                      onClick={() => handleChoice(question?.label, optionLabel)}
                      className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      {optionLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">
              {textPrompt || "En quelques mots, qu'est-ce qui vous a aide ou bloque ?"}
            </label>
            <textarea
              value={perceivedInfo}
              onChange={(event) => setPerceivedInfo(event?.target?.value || '')}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={
                textPlaceholder || 'Expliquez ce qui vous a aide, surpris, ou freine.'
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isComplete}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Valider et continuer
        </button>
      </div>
    </div>
  );
};

export default ExitQuestionnaireModal;
