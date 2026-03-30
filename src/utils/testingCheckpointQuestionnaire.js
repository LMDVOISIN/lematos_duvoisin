const DEFAULT_RATING_OPTIONS = [
  'Tout a fait',
  'Plutot oui',
  'Plutot non',
  'Pas du tout'
];

const DEFAULT_CLARITY_OPTIONS = [
  'Tres claires',
  'Plutot claires',
  'Peu claires',
  'Pas claires'
];

const DEFAULT_NEXT_STEP_OPTIONS = [
  'Oui, immediatement',
  'Oui, apres un court moment',
  'Pas vraiment',
  'Pas du tout'
];

export const DEFAULT_FEEDBACK_TEXT_PROMPT =
  "En quelques mots, qu'est-ce qui vous a aide ou bloque sur ces deux dernieres pages ?";

export const DEFAULT_FEEDBACK_TEXT_PLACEHOLDER =
  'Exemple : je ne savais pas ou cliquer, ou au contraire le parcours etait tres simple.';

const hasNextStepIntent = (label = '') =>
  /(quoi faire|suite|prochaine etape|etape suivante|ensuite)/i.test(String(label || '').trim());

const isNegativeAnswer = (answer = '') =>
  /(pas du tout|pas clair|pas claire|pas claires|pas vraiment|peu clair|peu claire|peu claires|plutot non|non)/i.test(
    String(answer || '').trim()
  );

const normalizeQuestionObject = (question, index) => {
  if (typeof question === 'string') {
    return {
      id: `qcm_${index + 1}`,
      type: 'single_choice',
      label: question,
      options: DEFAULT_RATING_OPTIONS
    };
  }

  const normalizedType = String(question?.type || 'single_choice').trim() || 'single_choice';
  const label = String(question?.label || question?.question || '').trim();
  if (!label) return null;

  if (normalizedType === 'text') {
    return {
      id: String(question?.id || `text_${index + 1}`).trim() || `text_${index + 1}`,
      type: 'text',
      label,
      placeholder: String(question?.placeholder || '').trim()
    };
  }

  const rawOptions = Array.isArray(question?.options) ? question.options : [];
  const options = rawOptions.map((option) => String(option || '').trim()).filter(Boolean);

  return {
    id: String(question?.id || `qcm_${index + 1}`).trim() || `qcm_${index + 1}`,
    type: 'single_choice',
    label,
    options: options.length > 0 ? options : DEFAULT_RATING_OPTIONS
  };
};

export const normalizeCheckpointQuestions = (questions = []) =>
  (Array.isArray(questions) ? questions : [])
    .map((question, index) => normalizeQuestionObject(question, index))
    .filter(Boolean);

export const buildCheckpointQuestions = (pageData = null) => {
  const configuredQuestions = normalizeCheckpointQuestions(pageData?.exit_questions || []);
  const qcmQuestions = configuredQuestions.filter((question) => question.type === 'single_choice');
  const textQuestion = configuredQuestions.find((question) => question.type === 'text');

  const fallbackQuestions =
    qcmQuestions.length > 0
      ? qcmQuestions
      : [
          {
            id: 'clarity',
            type: 'single_choice',
            label: 'Ces deux dernieres pages vous ont-elles semble claires ?',
            options: DEFAULT_CLARITY_OPTIONS
          },
          {
            id: 'next_step',
            type: 'single_choice',
            label: 'Saviez-vous quoi faire ensuite ?',
            options: DEFAULT_NEXT_STEP_OPTIONS
          }
        ];

  return {
    questions: fallbackQuestions,
    textPrompt: textQuestion?.label || DEFAULT_FEEDBACK_TEXT_PROMPT,
    textPlaceholder: textQuestion?.placeholder || DEFAULT_FEEDBACK_TEXT_PLACEHOLDER
  };
};

export const getCheckpointSequenceIndex = (pagePath = '', responsesByPath = {}) => {
  const orderedResponses = Object.values(responsesByPath || {})
    .filter((response) => String(response?.page_url || '').trim())
    .sort((left, right) => {
      const leftTimestamp = new Date(left?.timestamp || 0).getTime();
      const rightTimestamp = new Date(right?.timestamp || 0).getTime();
      return leftTimestamp - rightTimestamp;
    });

  const targetPath = String(pagePath || '').trim();
  return orderedResponses.findIndex((response) => String(response?.page_url || '').trim() === targetPath);
};

export const shouldAskCheckpointQuestionnaire = (pagePath = '', responsesByPath = {}) => {
  const index = getCheckpointSequenceIndex(pagePath, responsesByPath);
  if (index < 0) return false;
  return (index + 1) % 2 === 0;
};

export const inferNextActionUnderstood = (questions = [], answers = {}) => {
  const matchingQuestion = (questions || []).find((question) => hasNextStepIntent(question?.label));
  if (!matchingQuestion) return null;

  const answer = answers?.[matchingQuestion?.label];
  if (!answer) return null;

  return !isNegativeAnswer(answer);
};

export const buildCheckpointSummary = (questions = [], answers = {}) => {
  const firstQuestion = (questions || [])[0];
  if (!firstQuestion?.label) {
    return {
      coherenceQuestion: null,
      coherenceAnswer: null
    };
  }

  return {
    coherenceQuestion: firstQuestion.label,
    coherenceAnswer: answers?.[firstQuestion.label] || null
  };
};
