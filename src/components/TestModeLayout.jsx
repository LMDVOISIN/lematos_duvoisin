import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import userTestingService from '../services/userTestingService';
import annonceService from '../services/annonceService';
import { useAuth } from '../contexts/AuthContext';
import ExitQuestionnaireModal from './TestModeLayout/components/ExitQuestionnaireModal';
import ScenarioInstructionsModal from './TestModeLayout/components/ScenarioInstructionsModal';
import ReportProblemButton from './TestModeLayout/components/ReportProblemButton';
import EmergencyHelpButton from './TestModeLayout/components/EmergencyHelpButton';
import TesterOnboarding from './TestModeLayout/components/TesterOnboarding';
import {
  disableTestModeSession,
  enableTestModeSession,
  isTestModeSessionEnabled,
  setTestModeInstructionsAvailable,
  TEST_MODE_OPEN_INSTRUCTIONS_EVENT
} from '../utils/testModeSession';
import {
  findScenarioPageByPath,
  getVisitedScenarioUrls,
  resolveScenarioPath
} from '../utils/testScenarioPaths';
import {
  buildCheckpointQuestions,
  buildCheckpointSummary,
  inferNextActionUnderstood,
  shouldAskCheckpointQuestionnaire
} from '../utils/testingCheckpointQuestionnaire';
import { getTestingMirrorGuidance } from '../utils/testingMirrorContext';

const toResponsesByPath = (responses = []) => {
  return (responses || []).reduce((accumulator, response) => {
    const pagePath = String(response.page_url || '').trim();
    if (!pagePath) return accumulator;
    accumulator[pagePath] = response;
    return accumulator;
  }, {});
};

const hasExitAnswers = (response) => {
  const questionnaire = response.exit_questionnaire;
  return questionnaire && typeof questionnaire === 'object' && Object.keys(questionnaire).length > 0;
};

const hasTimeSpent = (response) =>
  Number.isFinite(Number(response?.time_spent_seconds)) && Number(response?.time_spent_seconds) > 0;

const isResponseCompleted = (response, requiresCheckpointFeedback = false) => {
  if (!response) return false;
  if (requiresCheckpointFeedback) {
    return hasExitAnswers(response);
  }
  if (hasExitAnswers(response)) return true;
  if (response.next_action_understood === true || response.next_action_understood === false) return true;
  if (hasTimeSpent(response)) return true;
  return String(response.perceived_info || '').trim().length > 0;
};

const CONFIDENCE_OPTIONS = [
  'Tres confiant',
  'Confiant',
  'Neutre',
  'Peu confiant',
  'Pas du tout confiant'
];

const TestModeLayout = ({ children }) => {
  const { testerData, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname || '/');
  const pageStartTimesRef = useRef({});

  const [currentSession, setCurrentSession] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [responsesByPath, setResponsesByPath] = useState({});
  const [loadingSession, setLoadingSession] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [pendingExit, setPendingExit] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsScenarioSelection, setNeedsScenarioSelection] = useState(false);
  const [openDebriefAfterExit, setOpenDebriefAfterExit] = useState(false);
  const [submittingDebrief, setSubmittingDebrief] = useState(false);
  const [whatWasClear, setWhatWasClear] = useState('');
  const [whatBlocked, setWhatBlocked] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [listingCount, setListingCount] = useState(null);
  const [expectationText, setExpectationText] = useState('');
  const [expectationSaved, setExpectationSaved] = useState(false);
  const [expectationOutcome, setExpectationOutcome] = useState('');
  const [expectationMismatchReason, setExpectationMismatchReason] = useState('');

  const testModeRequested = isTestModeSessionEnabled();
  const responses = useMemo(() => Object.values(responsesByPath), [responsesByPath]);
  const visitedScenarioUrls = useMemo(
    () => getVisitedScenarioUrls(responses, scenario?.pages || []),
    [responses, scenario?.pages]
  );
  const sessionRole = String(currentSession?.runtimeState?.sessionRole || currentSession?.runtimeState?.session_role || '').trim();
  const mirrorGuidance = useMemo(
    () => getTestingMirrorGuidance(currentSession?.runtimeState),
    [currentSession?.runtimeState]
  );
  const testerOrderIndex = Number(currentSession?.runtimeState?.testerOrderIndex);

  const resetDebriefForm = () => {
    setWhatWasClear('');
    setWhatBlocked('');
    setConfidenceLevel('');
    setNotes('');
    setExpectationOutcome('');
    setExpectationMismatchReason('');
    setSubmittingDebrief(false);
    setShowDebriefModal(false);
    setOpenDebriefAfterExit(false);
  };

  const resetActiveSessionState = () => {
    disableTestModeSession();
    previousPathRef.current = '/participant-configuration-contexte-authentification';
    pageStartTimesRef.current = {};
    setCurrentSession(null);
    setScenario(null);
    setResponsesByPath({});
    setPendingExit(null);
    setShowExitModal(false);
    setShowInstructionModal(false);
    resetDebriefForm();
  };

  const buildPendingExitState = (pagePath, responseId) => {
    const pageData = findScenarioPageByPath(pagePath, scenario?.pages || []);
    const checkpointConfig = buildCheckpointQuestions(pageData);

    return {
      pageData,
      pagePath,
      responseId,
      questions: checkpointConfig.questions,
      textPrompt: checkpointConfig.textPrompt,
      textPlaceholder: checkpointConfig.textPlaceholder
    };
  };

  const finalizePageWithoutQuestionnaire = async (pagePath, response) => {
    if (!response?.id || hasTimeSpent(response)) {
      delete pageStartTimesRef.current[pagePath];
      return;
    }

    const startedAt = pageStartTimesRef.current[pagePath];
    const timeSpentSeconds = startedAt
      ? Math.max(1, Math.floor((Date.now() - startedAt) / 1000))
      : null;

    const { data, error } = await userTestingService.updatePageResponse(response.id, {
      timeSpentSeconds
    });

    if (error || !data) {
      console.error('Impossible d enregistrer le temps passe sur la page de test :', error);
      return;
    }

    delete pageStartTimesRef.current[pagePath];

    setResponsesByPath((previous) => ({
      ...previous,
      [pagePath]: data
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadCurrentSession = async () => {
      if (!testerData?.id) {
        setCurrentSession(null);
        setScenario(null);
        setResponsesByPath({});
        setLoadingSession(false);
        return;
      }

      setLoadingSession(true);
      const { data, error } = await userTestingService.getCurrentSession(testerData?.id);

      if (cancelled) return;
      if (error) {
        console.error('Impossible de charger la session d\'essai en cours :', error);
      }

      if (data) {
        enableTestModeSession();
        setCurrentSession(data);
        setScenario(data.scenario || null);

        const { data: pageResponses } = await userTestingService.getPageResponsesBySession(data.id);
        if (cancelled) return;

        setResponsesByPath(toResponsesByPath(pageResponses || []));
      } else {
        setCurrentSession(null);
        setScenario(null);
        setResponsesByPath({});
      }

      setLoadingSession(false);
    };

    loadCurrentSession();

    return () => {
      cancelled = true;
    };
  }, [testerData?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadListingCount = async () => {
      if (!user?.id) {
        setListingCount(null);
        return;
      }

      try {
        const { data } = await annonceService.getUserAnnonceCount(user?.id);
        if (cancelled) return;
        setListingCount(Number.isFinite(Number(data)) ? Number(data) : 0);
      } catch (error) {
        if (cancelled) return;
        console.error("Impossible de vérifier les annonces existantes :", error);
        setListingCount(null);
      }
    };

    loadListingCount();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadExpectation = async () => {
      if (!currentSession?.id) {
        setExpectationText('');
        setExpectationSaved(false);
        return;
      }

      const { data } = await userTestingService.getExpectationForSession(currentSession?.id);
      if (cancelled) return;
      if (data?.expectation_text) {
        setExpectationText(data.expectation_text);
        setExpectationSaved(true);
      } else {
        setExpectationText('');
        setExpectationSaved(false);
      }
    };

    loadExpectation();

    return () => {
      cancelled = true;
    };
  }, [currentSession?.id]);

  useEffect(() => {
    const hasInstructions = Boolean(currentSession && scenario);
    setTestModeInstructionsAvailable(hasInstructions);

    if (hasInstructions) {
      setShowInstructionModal(true);
    } else {
      setShowInstructionModal(false);
    }

    return () => {
      setTestModeInstructionsAvailable(false);
    };
  }, [currentSession, scenario]);

  useEffect(() => {
    const handleOpenInstructions = () => {
      if (currentSession && scenario) {
        setShowInstructionModal(true);
      }
    };

    window.addEventListener(TEST_MODE_OPEN_INSTRUCTIONS_EVENT, handleOpenInstructions);
    return () => {
      window.removeEventListener(TEST_MODE_OPEN_INSTRUCTIONS_EVENT, handleOpenInstructions);
    };
  }, [currentSession, scenario]);

  useEffect(() => {
    if (!testerData) {
      setNeedsOnboarding(false);
      setNeedsScenarioSelection(false);
      return;
    }

    const hasContext = Boolean(testerData?.system && testerData?.screen_type && testerData?.browser);
    const shouldGuideTester = Boolean(currentSession || testModeRequested);

    setNeedsOnboarding(Boolean(shouldGuideTester && !currentSession && !hasContext));
    setNeedsScenarioSelection(Boolean(shouldGuideTester && !currentSession && hasContext));
  }, [
    currentSession,
    testModeRequested,
    testerData,
    testerData?.browser,
    testerData?.screen_type,
    testerData?.system
  ]);

  useEffect(() => {
    if (!loadingSession && needsScenarioSelection) {
      const currentPath = location.pathname || '';
      if (currentPath !== '/participant-configuration-contexte-authentification') {
        navigate('/participant-configuration-contexte-authentification', { replace: true });
      }
    }
  }, [loadingSession, location.pathname, navigate, needsScenarioSelection]);

  useEffect(() => {
    if (!currentSession) {
      previousPathRef.current = location.pathname || '/';
      return;
    }

    const previousPath = previousPathRef.current;
    const currentPath = location.pathname || '/';

    if (previousPath && previousPath !== currentPath) {
      const previousResponse = responsesByPath?.[previousPath];

      if (previousResponse) {
        const requiresCheckpointFeedback = shouldAskCheckpointQuestionnaire(previousPath, responsesByPath);

        if (requiresCheckpointFeedback && !isResponseCompleted(previousResponse, true)) {
          setPendingExit(buildPendingExitState(previousPath, previousResponse.id));
          setShowExitModal(true);
        } else if (!requiresCheckpointFeedback && !isResponseCompleted(previousResponse, false)) {
          finalizePageWithoutQuestionnaire(previousPath, previousResponse);
        }
      }
    }

    previousPathRef.current = currentPath;
  }, [currentSession, location.pathname, responsesByPath, scenario?.pages]);

  useEffect(() => {
    if (!currentSession?.id) return undefined;

    let cancelled = false;
    const currentPath = location.pathname || '/';

    const saveCheckpoint = async () => {
      const { error } = await userTestingService.updateSessionCheckpoint(currentSession?.id, currentPath);
      if (!cancelled && error) {
        console.error('Impossible de memoriser le point de reprise du test :', error);
      }
    };

    saveCheckpoint();

    return () => {
      cancelled = true;
    };
  }, [currentSession?.id, location.pathname]);

  useEffect(() => {
    if (!currentSession?.id || !testerData?.id) return undefined;

    let cancelled = false;

    const syncSessionStatus = async () => {
      const { data, error } = await userTestingService.getSessionById(currentSession?.id);

      if (cancelled) return;
      if (error) {
        console.error("Impossible de vérifier l'état de la session d'essai :", error);
        return;
      }

      if (!data) return;

      if (data.status === 'paused') {
        resetActiveSessionState();
        toast.error("Ce test a ete mis en pause par l observateur. Attendez son e-mail pour le reprendre.");
        navigate('/participant-configuration-contexte-authentification');
      }
    };

    syncSessionStatus();

    const intervalId = window.setInterval(syncSessionStatus, 10000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncSessionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSession?.id, navigate, testerData?.id]);

  useEffect(() => {
    if (!currentSession?.id) return;
    if (showExitModal || showDebriefModal) return;

    let cancelled = false;
    const currentPath = location.pathname || '/';

    if (!pageStartTimesRef.current[currentPath]) {
      pageStartTimesRef.current[currentPath] = Date.now();
    }

    if (responsesByPath?.[currentPath]) return;

    const createInitialResponse = async () => {
      const { data, error } = await userTestingService.savePageResponse({
        sessionId: currentSession.id,
        pageUrl: currentPath,
        coherenceQuestion: null,
        coherenceAnswer: null,
        exitQuestionnaire: {},
        perceivedInfo: null,
        nextActionUnderstood: null,
        timeSpentSeconds: null
      });

      if (cancelled) return;
      if (error || !data) {
        console.error('Impossible d initialiser le suivi du ressenti testeur :', error);
        return;
      }

      setResponsesByPath((previous) => {
        if (previous?.[currentPath]) return previous;
        return {
          ...previous,
          [currentPath]: data
        };
      });
    };

    createInitialResponse();

    return () => {
      cancelled = true;
    };
  }, [currentSession?.id, location.pathname, responsesByPath, showDebriefModal, showExitModal]);

  useEffect(() => {
    if (!currentSession) return undefined;

    const handleBeforeUnload = (event) => {
      const currentPath = location.pathname || '/';
      const currentResponse = responsesByPath?.[currentPath];
      const requiresCheckpointFeedback = shouldAskCheckpointQuestionnaire(currentPath, responsesByPath);

      if (currentResponse && !isResponseCompleted(currentResponse, requiresCheckpointFeedback)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession, location.pathname, responsesByPath]);

  const handleExitQuestionnaire = async (responseData) => {
    if (!pendingExit?.responseId) return;

    const startedAt = pageStartTimesRef.current[pendingExit.pagePath];
    const timeSpentSeconds = startedAt
      ? Math.max(1, Math.floor((Date.now() - startedAt) / 1000))
      : null;
    const exitAnswers = responseData?.exitAnswers || {};
    const summary = buildCheckpointSummary(pendingExit?.questions || [], exitAnswers);
    const nextActionUnderstood =
      inferNextActionUnderstood(pendingExit?.questions || [], exitAnswers)
      ?? responseData?.nextActionUnderstood
      ?? null;

    const { data, error } = await userTestingService.updatePageResponse(pendingExit.responseId, {
      coherenceQuestion: summary.coherenceQuestion,
      coherenceAnswer: summary.coherenceAnswer,
      exitQuestionnaire: exitAnswers,
      perceivedInfo: responseData?.perceivedInfo || null,
      nextActionUnderstood,
      timeSpentSeconds
    });

    if (error || !data) {
      toast.error('Impossible d enregistrer le questionnaire de sortie.');
      return;
    }

    delete pageStartTimesRef.current[pendingExit.pagePath];

    setResponsesByPath((previous) => ({
      ...previous,
      [pendingExit.pagePath]: data
    }));
    setPendingExit(null);
    setShowExitModal(false);

    if (openDebriefAfterExit) {
      setOpenDebriefAfterExit(false);
      setShowDebriefModal(true);
    }
  };

  const handleOnboardingComplete = async (contextData) => {
    if (!testerData?.id) return;

    const { error } = await userTestingService.updateTesterContext(testerData?.id, contextData);
    if (error) {
      toast.error("Impossible d'enregistrer votre contexte d'essai.");
      return;
    }

    await refreshProfile?.();
    setNeedsOnboarding(false);
    setNeedsScenarioSelection(true);
  };

  const handleGoToScenarioPage = (page) => {
    if (!page.url) return;
    navigate(resolveScenarioPath(page.url));
  };

  const handleOpenDebrief = async () => {
    const currentPath = location.pathname || '/';
    const currentResponse = responsesByPath?.[currentPath];
    const requiresCheckpointFeedback = shouldAskCheckpointQuestionnaire(currentPath, responsesByPath);

    if (currentResponse && requiresCheckpointFeedback && !isResponseCompleted(currentResponse, true)) {
      setPendingExit(buildPendingExitState(currentPath, currentResponse.id));
      setOpenDebriefAfterExit(true);
      setShowExitModal(true);
      return;
    }

    if (currentResponse && !requiresCheckpointFeedback && !isResponseCompleted(currentResponse, false)) {
      await finalizePageWithoutQuestionnaire(currentPath, currentResponse);
    }

    setShowDebriefModal(true);
  };

  const handleDebriefSubmit = async () => {
    if (!currentSession?.id) return;
    if (!whatWasClear.trim() || !whatBlocked.trim() || !confidenceLevel) {
      toast.error('Merci de compléter le compte rendu.');
      return;
    }
    if (!expectationOutcome) {
      toast.error("Merci d'indiquer si le résultat correspond à votre attente.");
      return;
    }
    if (expectationOutcome === 'no' && !expectationMismatchReason.trim()) {
      toast.error("Merci de préciser pourquoi le résultat ne correspond pas.");
      return;
    }

    setSubmittingDebrief(true);
    const { error: expectationError } = await userTestingService.updateExpectationOutcome(
      currentSession?.id,
      expectationOutcome === 'yes',
      expectationOutcome === 'no' ? expectationMismatchReason.trim() : ''
    );

    if (expectationError) {
      setSubmittingDebrief(false);
      toast.error("Impossible d'enregistrer votre retour sur le résultat.");
      return;
    }

    const { error } = await userTestingService.completeSession(currentSession?.id, {
      whatWasClear,
      whatBlocked,
      confidenceLevel,
      notes
    });

    setSubmittingDebrief(false);

    if (error) {
      toast.error('Impossible de terminer la session.');
      return;
    }

    resetActiveSessionState();
    toast.success('Session terminee. Merci pour votre participation.');
    navigate('/participant-configuration-contexte-authentification');
  };

  const handleExpectationSave = async (text) => {
    if (!currentSession?.id || !testerData?.id || !scenario?.id) return false;
    const payload = String(text || '').trim();
    if (!payload) return false;

    const { data, error } = await userTestingService.saveExpectationForSession({
      sessionId: currentSession?.id,
      testerId: testerData?.id,
      scenarioId: scenario?.id,
      expectationText: payload
    });

    if (error || !data) {
      toast.error('Impossible d enregistrer votre attente.');
      return false;
    }

    setExpectationText(payload);
    setExpectationSaved(true);
    return true;
  };

  if (!testerData || (!currentSession && !testModeRequested && !loadingSession)) {
    return children;
  }

  if (needsOnboarding) {
    return <TesterOnboarding onComplete={handleOnboardingComplete} />;
  }

  if (!loadingSession && needsScenarioSelection) {
    if (location.pathname === '/participant-configuration-contexte-authentification') {
      return children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirection vers votre espace d'essai...</p>
        </div>
      </div>
    );
  }

  if (!currentSession || !scenario) {
    return children;
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="relative flex-1 overflow-auto">
        {children}

        <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Mode essai actif : vos réponses sont enregistrées pendant le parcours.
        </div>

        <EmergencyHelpButton
          sessionId={currentSession.id}
          currentPageUrl={location.pathname || '/'}
          floatingClassName="fab-mobile-safe-secondary"
        />

        <ReportProblemButton
          sessionId={currentSession.id}
          currentPageUrl={location.pathname || '/'}
          floatingClassName="fab-mobile-safe-primary"
        />
      </div>

      <ScenarioInstructionsModal
        scenario={scenario}
        currentPath={location.pathname || '/'}
        sessionRole={sessionRole}
        referenceScenario={currentSession?.runtimeState?.referenceScenario || null}
        testerOrderIndex={testerOrderIndex}
        hasExistingListings={listingCount === null ? undefined : Number(listingCount) > 0}
        expectationText={expectationText}
        expectationSaved={expectationSaved}
        visitedPages={visitedScenarioUrls}
        mirrorGuidance={mirrorGuidance}
        isOpen={showInstructionModal}
        onClose={() => setShowInstructionModal(false)}
        onCompleteScenario={handleOpenDebrief}
        onGoToPage={handleGoToScenarioPage}
        onSaveExpectation={handleExpectationSave}
      />

      {showExitModal && pendingExit?.responseId && (
        <ExitQuestionnaireModal
          questions={pendingExit?.questions || []}
          textPrompt={pendingExit?.textPrompt}
          textPlaceholder={pendingExit?.textPlaceholder}
          onComplete={handleExitQuestionnaire}
        />
      )}

      {showDebriefModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-xl font-bold text-foreground">Compte rendu de fin de session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Merci de résumer votre ressenti avant de clôturer l'essai.
              </p>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Ce qui était clair
                </label>
                <textarea
                  value={whatWasClear}
                  onChange={(event) => setWhatWasClear(event.target.value || '')}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ce que vous avez compris rapidement ou sans hésiter."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Ce qui vous a bloqué
                </label>
                <textarea
                  value={whatBlocked}
                  onChange={(event) => setWhatBlocked(event.target.value || '')}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Les points de confusion, de friction ou d'hésitation."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Niveau de confiance
                </label>
                <div className="space-y-2">
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="test-confidence"
                        value={option}
                        checked={confidenceLevel === option}
                        onChange={(event) => setConfidenceLevel(event.target.value || '')}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Notes libres
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value || '')}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Tout autre point utile pour l'équipe."
                />
              </div>

              {expectationText && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">Votre attente au début du test</p>
                  <p className="mt-2 text-sm text-slate-700">{expectationText}</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Le résultat correspondait-il à votre attente ?
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'yes', label: "Oui, c'était conforme" },
                    { value: 'no', label: "Non, ce n'était pas conforme" }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="expectation-outcome"
                        value={option.value}
                        checked={expectationOutcome === option.value}
                        onChange={(event) => setExpectationOutcome(event.target.value || '')}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {expectationOutcome === 'no' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Pourquoi ce n'était pas le cas ?
                  </label>
                  <textarea
                    value={expectationMismatchReason}
                    onChange={(event) => setExpectationMismatchReason(event.target.value || '')}
                    rows={3}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Expliquez ce qui a manqué, ce qui a surpris, ou ce qui a bloqué."
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4">
              <button
                onClick={() => {
                  resetDebriefForm();
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background"
              >
                Revenir au scénario
              </button>
              <button
                onClick={handleDebriefSubmit}
                disabled={submittingDebrief}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {submittingDebrief ? 'Envoi en cours...' : 'Terminer la session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestModeLayout;

