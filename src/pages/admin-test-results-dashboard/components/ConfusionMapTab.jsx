import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import userTestingService from '../../../services/userTestingService';

const ConfusionMapTab = () => {
  const [confusionData, setConfusionData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfusionMap();
  }, []);

  const loadConfusionMap = async () => {
    setLoading(true);
    const { data } = await userTestingService?.getConfusionMap();
    setConfusionData(data || []);
    setLoading(false);
  };

  const sortedData = [...confusionData]?.sort((a, b) => b?.confusionScore - a?.confusionScore);

  const getScoreColor = (score) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-orange-500';
    if (score >= 20) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const exportToCSV = () => {
    const headers = ['Page', 'Réponses totales', 'Score de confusion (%)', 'Action suivante peu claire (%)'];
    const rows = sortedData?.map(d => [
      d?.pageUrl,
      d?.totalResponses,
      d?.confusionScore,
      d?.unclearNextAction
    ]);

    const csv = [headers, ...rows]?.map(row => row?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `confusion-map-${new Date()?.toISOString()}.csv`;
    a?.click();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Carte de confusion des pages</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pages avec le plus de réponses négatives aux questions de cohérence
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>
      <div className="grid gap-4">
        {sortedData?.map((page, index) => (
          <div key={page?.pageUrl} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                  <h3 className="text-lg font-semibold text-foreground">{page?.pageUrl}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{page?.totalResponses} réponses collectées</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Confusion Score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-surface-foreground">Score de confusion</span>
                  <span className="text-2xl font-bold text-foreground">{page?.confusionScore}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getScoreColor(page?.confusionScore)}`}
                    style={{ width: `${page?.confusionScore}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pourcentage de réponses négatives
                </p>
              </div>

              {/* Unclear Next Action */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-surface-foreground">Action suivante peu claire</span>
                  <span className="text-2xl font-bold text-foreground">{page?.unclearNextAction}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getScoreColor(page?.unclearNextAction)}`}
                    style={{ width: `${page?.unclearNextAction}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Utilisateurs ne sachant pas quoi faire ensuite
                </p>
              </div>
            </div>

            {/* Priority Badge */}
            {page?.confusionScore >= 50 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-900">
                  ⚠️ Priorité haute : Cette page nécessite une correction urgente
                </p>
              </div>
            )}
          </div>
        ))}

        {sortedData?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-muted-foreground">Aucune donnée de confusion disponible</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfusionMapTab;
