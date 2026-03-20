import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getTestProgramFamilyMeta,
  getTestProgramStepNumber,
  normalizeCompletedFamilies,
  TEST_PROGRAM_FAMILIES,
  TEST_PROGRAM_TOTAL_STEPS
} from '../../../utils/testingProgram';

const ScenarioSelector = ({ onSelect }) => {
  const { testerData } = useAuth();
  const [startState, setStartState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState('');

  useEffect(() => {
    loadStartState();
  }, [testerData?.id]);

  const loadStartState = async () => {
    if (!testerData?.id) {
      setStartState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await userTestingService?.getMirrorStartState(testerData?.id);
    setStartState(data || null);

    const remainingIds = (data?.remainingReferenceScenarios || [])?.map((scenario) => scenario?.id);
    setSelectedScenario((previousScenario) => (
      remainingIds?.includes(previousScenario) ? previousScenario : ''
    ));
    setLoading(false);
  };

  const handleSelect = () => {
    if (startState?.mode === 'reference_choice' && !selectedScenario) {
      return;
    }

    onSelect(startState?.mode === 'reference_choice' ? selectedScenario : null);
  };

  const renderProgressItems = (completedFamilies = [], requiredFamily = null) => {
    const normalizedFamilies = normalizeCompletedFamilies(completedFamilies);

    return TEST_PROGRAM_FAMILIES.map((family, index) => {
      const meta = getTestProgramFamilyMeta(family);
      const isDone = normalizedFamilies?.includes(family);
      const isCurrent = !isDone && family === requiredFamily;

      return (
        <div
          key={family}
          className={`rounded-lg border p-4 ${
            isDone
              ? 'border-green-200 bg-green-50'
              : isCurrent
                ? 'border-blue-200 bg-blue-50'
                : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Test {index + 1} sur {TEST_PROGRAM_TOTAL_STEPS}
              </p>
              <p className="font-semibold text-gray-900">{meta?.label}</p>
              <p className="mt-1 text-xs text-gray-600">{meta?.description}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-sm font-semibold">
              {isDone ? 'OK' : index + 1}
            </div>
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen app-page-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparation du parcours...</p>
        </div>
      </div>
    );
  }

  const remainingScenarios = startState?.remainingReferenceScenarios || [];
  const assignedScenario = startState?.assignedScenario;
  const referenceScenario = startState?.referenceScenario;
  const completedFamilies = normalizeCompletedFamilies(startState?.completedFamilies);
  const requiredFamily = startState?.requiredFamily;
  const requiredFamilyMeta = getTestProgramFamilyMeta(requiredFamily);
  const stepNumber = startState?.programStepNumber || getTestProgramStepNumber(completedFamilies);
  const progressItems = renderProgressItems(completedFamilies, requiredFamily);

  return (
    <div className="min-h-screen app-page-gradient p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Demarrage automatique du parcours d essai
          </h2>
          <p className="text-gray-600">
            Chaque testeur passe {TEST_PROGRAM_TOTAL_STEPS} tests obligatoires. L application sait
            quel type de test il lui manque et applique la logique miroir a l interieur de cette
            famille.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-6">{progressItems}</div>

        {startState?.mode !== 'program_completed' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Test {stepNumber} sur {TEST_PROGRAM_TOTAL_STEPS}
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{requiredFamilyMeta?.label}</p>
            <p className="mt-1 text-sm text-gray-600">{requiredFamilyMeta?.description}</p>
          </div>
        )}

        {startState?.mode === 'mirror_assignment' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <p className="text-sm font-semibold text-amber-950 mb-2">
                Vous recevez automatiquement un parcours miroir.
              </p>
              <p className="text-sm text-amber-900">
                Pour ce type de test, le participant juste avant vous a deja choisi le parcours de
                reference. Vous prenez donc son miroir pour garder une comparaison propre.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{assignedScenario?.title}</h3>
              <p className="text-gray-600 mb-3">{assignedScenario?.objective}</p>
              <p className="text-sm text-gray-500">
                Choix de depart correspondant : {referenceScenario?.title || 'Parcours de reference'}
              </p>
            </div>
          </div>
        )}

        {startState?.mode === 'reference_choice' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
              <p className="text-sm font-semibold text-blue-950 mb-2">
                Vous choisissez maintenant un parcours de reference.
              </p>
              <p className="text-sm text-blue-900">
                Sur ce type de test, la personne qui commencera juste apres vous recevra
                automatiquement le miroir de ce choix.
              </p>
            </div>

            {remainingScenarios?.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600">Aucun parcours de reference disponible pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {remainingScenarios?.map((scenario) => (
                  <div
                    key={scenario?.id}
                    onClick={() => setSelectedScenario(scenario?.id)}
                    className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
                      selectedScenario === scenario?.id
                        ? 'ring-2 ring-blue-500 border-blue-500'
                        : 'hover:shadow-lg'
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
                            <p className="text-sm font-medium text-green-900 mb-1">Resultat attendu :</p>
                            <p className="text-sm text-green-700">{scenario?.expected_result}</p>
                          </div>
                        )}
                        {scenario?.pages && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{scenario?.pages?.length} etapes</span>
                            <span>-</span>
                            <span>
                              {scenario?.pages?.filter((page) => page?.required)?.length} obligatoires
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {startState?.mode === 'unavailable' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="font-semibold text-gray-900 mb-2">
              Tous les parcours de reference libres ont deja ete pris pour {requiredFamilyMeta?.label?.toLowerCase()}.
            </p>
            <p className="text-gray-600">
              Demandez a l observateur d ouvrir une nouvelle vague ou d ajouter un autre binome
              pour continuer ce test.
            </p>
          </div>
        )}

        {startState?.mode === 'program_completed' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="font-semibold text-gray-900 mb-2">
              Vos {TEST_PROGRAM_TOTAL_STEPS} tests obligatoires sont deja termines pour cette vague.
            </p>
            <p className="text-gray-600">
              Vous pouvez maintenant remettre vos retours a l observateur.
            </p>
          </div>
        )}

        {startState && !['unavailable', 'program_completed'].includes(startState?.mode) && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <button
              onClick={handleSelect}
              disabled={startState?.mode === 'reference_choice' && !selectedScenario}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {startState?.mode === 'mirror_assignment'
                ? 'Demarrer le parcours attribue'
                : 'Demarrer ce parcours'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioSelector;
