import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';

const formatExitQuestionnaireForExport = (questionnaire = {}) => {
  return Object.entries(questionnaire || {})
    .map(([question, answer]) => `${question}: ${answer}`)
    .join(' | ');
};

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
      allResponses.push(...(data || []));
    }

    setResponses(allResponses);
    setLoading(false);
  };

  const pages = [...new Set(responses.map((response) => response?.page_url).filter(Boolean))];
  const filteredResponses =
    selectedPage === 'all'
      ? responses
      : responses.filter((response) => response?.page_url === selectedPage);

  const exportToCSV = () => {
    const headers = [
      'Page',
      'Question de synthese',
      'Reponse de synthese',
      'Questionnaire QCM',
      'Commentaire libre',
      'Action claire',
      'Temps (s)'
    ];
    const rows = filteredResponses.map((response) => [
      response?.page_url || '',
      response?.coherence_question || '',
      response?.coherence_answer || '',
      formatExitQuestionnaireForExport(response?.exit_questionnaire || {}),
      response?.perceived_info || '',
      response?.next_action_understood === null || response?.next_action_understood === undefined
        ? ''
        : response?.next_action_understood
          ? 'Oui'
          : 'Non',
      response?.time_spent_seconds || 0
    ]);

    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `questionnaires-${new Date().toISOString()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-3">
          <select
            value={selectedPage}
            onChange={(event) => setSelectedPage(event?.target?.value)}
            className="rounded-lg border border-border px-4 py-2 focus:ring-2 focus:ring-primary"
          >
            <option value="all">Toutes les pages</option>
            {pages.map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={exportToCSV}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      <div className="space-y-4">
        {filteredResponses.map((response, index) => (
          <div key={index} className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{response?.page_url}</h3>
                <p className="text-sm text-muted-foreground">
                  Temps passe : {response?.time_spent_seconds || 0}s
                </p>
              </div>

              {response?.next_action_understood === true || response?.next_action_understood === false ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    response?.next_action_understood
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {response?.next_action_understood ? 'Action claire' : 'Action peu claire'}
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {response?.coherence_question ? (
                <div>
                  <p className="mb-1 text-sm font-medium text-surface-foreground">
                    Question de synthese
                  </p>
                  <p className="rounded bg-surface p-2 text-sm text-muted-foreground">
                    {response?.coherence_question}
                  </p>
                  <p className="mt-2 rounded bg-surface p-2 text-sm text-foreground">
                    {response?.coherence_answer || 'Sans reponse'}
                  </p>
                </div>
              ) : null}

              {response?.exit_questionnaire && Object.keys(response?.exit_questionnaire)?.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-surface-foreground">
                    Questionnaire QCM
                  </p>
                  <div className="space-y-2">
                    {Object.entries(response?.exit_questionnaire).map(([question, answer], questionIndex) => (
                      <div key={questionIndex} className="rounded bg-surface p-3">
                        <p className="text-xs font-medium text-muted-foreground">{question}</p>
                        <p className="mt-1 text-sm text-foreground">{String(answer || '').trim() || 'Sans reponse'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {response?.perceived_info ? (
                <div>
                  <p className="mb-1 text-sm font-medium text-surface-foreground">
                    Commentaire libre
                  </p>
                  <p className="rounded bg-surface p-3 text-sm text-muted-foreground">
                    {response?.perceived_info}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {filteredResponses.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-muted-foreground">Aucune reponse disponible</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default QuestionnaireAnalysisTab;
