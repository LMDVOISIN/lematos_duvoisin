import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import userTestingService from '../../../services/userTestingService';

const QuestionnaireAnalysisTab = () => {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState('all');

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    setLoading(true);
    const sessions = await userTestingService?.getAllSessions();
    const allResponses = [];
    
    for (const session of sessions?.data || []) {
      const { data } = await userTestingService?.getPageResponsesBySession(session?.id);
      allResponses?.push(...(data || []));
    }
    
    setResponses(allResponses);
    setLoading(false);
  };

  const pages = [...new Set(responses.map(r => r.page_url))];
  const filteredResponses = selectedPage === 'all' 
    ? responses 
    : responses?.filter(r => r?.page_url === selectedPage);

  const exportToCSV = () => {
    const headers = ['Page', 'Question cohérence', 'Réponse', 'Info perçue', 'Action claire', 'Temps (s)'];
    const rows = filteredResponses?.map(r => [
      r?.page_url,
      r?.coherence_question || '',
      r?.coherence_answer || '',
      r?.perceived_info || '',
      r?.next_action_understood ? 'Oui' : 'Non',
      r?.time_spent_seconds || 0
    ]);

    const csv = [headers, ...rows]?.map(row => row?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questionnaires-${new Date()?.toISOString()}.csv`;
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
        <div className="flex gap-3">
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e?.target?.value)}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
          >
            <option value="all">Toutes les pages</option>
            {pages?.map(page => (
              <option key={page} value={page}>{page}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>
      <div className="space-y-4">
        {filteredResponses?.map((response, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{response?.page_url}</h3>
                <p className="text-sm text-muted-foreground">
                  Temps passé : {response?.time_spent_seconds || 0}s
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                response?.next_action_understood
                  ? 'bg-green-100 text-green-800' :'bg-red-100 text-red-800'
              }`}>
                {response?.next_action_understood ? 'Action claire' : 'Action peu claire'}
              </span>
            </div>

            <div className="space-y-3">
              {response?.coherence_question && (
                <div>
                  <p className="text-sm font-medium text-surface-foreground mb-1">
                    Q: {response?.coherence_question}
                  </p>
                  <p className="text-sm text-muted-foreground bg-surface p-2 rounded">
                    R: {response?.coherence_answer}
                  </p>
                </div>
              )}

              {response?.perceived_info && (
                <div>
                  <p className="text-sm font-medium text-surface-foreground mb-1">Informations perçues :</p>
                  <p className="text-sm text-muted-foreground bg-surface p-2 rounded">
                    {response?.perceived_info}
                  </p>
                </div>
              )}

              {response?.exit_questionnaire && Object.keys(response?.exit_questionnaire)?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-surface-foreground mb-2">Questionnaire de sortie :</p>
                  <div className="space-y-2">
                    {Object.entries(response?.exit_questionnaire)?.map(([question, answer], i) => (
                      <div key={i} className="bg-surface p-2 rounded">
                        <p className="text-xs font-medium text-muted-foreground">{question}</p>
                        <p className="text-sm text-foreground mt-1">{answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredResponses?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-muted-foreground">Aucune réponse disponible</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionnaireAnalysisTab;
