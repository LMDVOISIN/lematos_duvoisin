import React, { useState } from 'react';

const CoherenceModal = ({ question, onComplete }) => {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (!answer?.trim()) return;
    onComplete(answer.trim());
  };

  return (
    <div className="modal-viewport z-[9999] bg-black/60">
      <div className="modal-card modal-card-auto max-w-xl rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Question de compréhension</h3>
        <p className="mb-4 text-sm text-gray-600">
          Merci de répondre avant de continuer.
        </p>

        <p className="mb-3 text-sm font-medium text-gray-800">{question}</p>

        <textarea
          value={answer}
          onChange={(event) => setAnswer(event?.target?.value || '')}
          placeholder="Votre réponse..."
          rows={4}
          className="mb-4 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          autoFocus
        />

        <button
          onClick={handleSubmit}
          disabled={!answer?.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Valider et continuer
        </button>
      </div>
    </div>
  );
};

export default CoherenceModal;
