import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import userTestingService from '../../../services/userTestingService';

const ScenarioSelector = ({ onSelect }) => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(null);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    const { data } = await userTestingService?.getActiveScenarios();
    setScenarios(data || []);
    setLoading(false);
  };

  const handleSelect = () => {
    if (selectedScenario) {
      onSelect(selectedScenario);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen app-page-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des scénarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-page-gradient p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choisissez un scénario d'essai</h2>
          <p className="text-gray-600">
            Sélectionnez le scénario que vous souhaitez essayer. Vous devrez suivre les étapes définies.
          </p>
        </div>

        {scenarios?.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Aucun scénario disponible pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scenarios?.map((scenario) => (
              <div
                key={scenario?.id}
                onClick={() => setSelectedScenario(scenario?.id)}
                className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
                  selectedScenario === scenario?.id
                    ? 'ring-2 ring-blue-500 border-blue-500' :'hover:shadow-lg'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {selectedScenario === scenario?.id ? (
                      <CheckCircle className="w-6 h-6 text-blue-600" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{scenario?.title}</h3>
                    <p className="text-gray-600 mb-3">{scenario?.objective}</p>
                    {scenario?.expected_result && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium text-green-900 mb-1">Résultat attendu :</p>
                        <p className="text-sm text-green-700">{scenario?.expected_result}</p>
                      </div>
                    )}
                    {scenario?.pages && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{scenario?.pages?.length} étapes</span>
                        <span>•</span>
                        <span>
                          {scenario?.pages?.filter(p => p?.required)?.length} obligatoires
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {scenarios?.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <button
              onClick={handleSelect}
              disabled={!selectedScenario}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Démarrer ce scénario
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioSelector;
