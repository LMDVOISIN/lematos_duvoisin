import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';

const ScenarioPanel = ({ scenario, currentSession, visitedPages, onEndScenario }) => {
  const pages = scenario?.pages || [];
  const sortedPages = [...pages]?.sort((a, b) => a?.order - b?.order);
  const requiredPages = sortedPages?.filter(p => p?.required);
  const completedRequired = requiredPages?.filter(p => visitedPages?.some(vp => vp?.includes(p?.url)));
  const canComplete = completedRequired?.length === requiredPages?.length;
  const nextPage = sortedPages?.find(p => !visitedPages?.some(vp => vp?.includes(p?.url)));

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{scenario?.title}</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-blue-900 mb-1">Objectif :</p>
          <p className="text-sm text-blue-700">{scenario?.objective}</p>
        </div>
        {scenario?.instructions && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm font-medium text-yellow-900 mb-1">Consignes :</p>
            <p className="text-sm text-yellow-700">{scenario?.instructions}</p>
          </div>
        )}
      </div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Progression</h3>
          <span className="text-sm text-gray-600">
            {completedRequired?.length} / {requiredPages?.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedRequired?.length / requiredPages?.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Étapes du scénario</h3>
        <div className="space-y-2">
          {sortedPages?.map((page, index) => {
            const isVisited = visitedPages?.some(vp => vp?.includes(page?.url));
            return (
              <div
                key={index}
                className={`flex items-start gap-2 p-2 rounded-lg ${
                  isVisited ? 'bg-green-50' : 'bg-white'
                }`}
              >
                {isVisited ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    isVisited ? 'text-green-900' : 'text-gray-700'
                  }`}>
                    {page?.title}
                  </p>
                  {page?.required && (
                    <span className="text-xs text-gray-500">Obligatoire</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {nextPage && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-900 mb-1">Prochaine page suggérée :</p>
          <p className="text-sm text-blue-700 font-medium">{nextPage?.title}</p>
        </div>
      )}
      <button
        onClick={onEndScenario}
        disabled={!canComplete}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          canComplete
            ? 'bg-green-600 text-white hover:bg-green-700' :'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {canComplete ? 'Terminer le scénario' : 'Complétez les étapes obligatoires'}
      </button>
    </div>
  );
};

export default ScenarioPanel;