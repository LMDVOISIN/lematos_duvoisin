import React, { useState } from 'react';


const CoherenceModal = ({ question, onComplete }) => {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (answer?.trim()) {
      onComplete(answer);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Question de cohérence</h3>
        </div>

        <p className="text-gray-700 mb-4">{question}</p>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e?.target?.value)}
          placeholder="Votre réponse..."
          className="w-full border border-gray-300 rounded-lg p-3 mb-4 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />

        <button
          onClick={handleSubmit}
          disabled={!answer?.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continuer
        </button>

        <p className="text-xs text-gray-500 mt-3 text-center">
          Vous devez répondre pour accéder à la page
        </p>
      </div>
    </div>
  );
};

export default CoherenceModal;