import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import userTestingService from '../services/userTestingService';
import { useAuth } from '../contexts/AuthContext';
import CoherenceModal from './TestModeLayout/components/CoherenceModal';
import ExitQuestionnaireModal from './TestModeLayout/components/ExitQuestionnaireModal';
import ScenarioPanel from './TestModeLayout/components/ScenarioPanel';
import ReportProblemButton from './TestModeLayout/components/ReportProblemButton';
import TesterOnboarding from './TestModeLayout/components/TesterOnboarding';
import ScenarioSelector from './TestModeLayout/components/ScenarioSelector';

const TestModeLayout = ({ children }) => {
  const { testerData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [currentSession, setCurrentSession] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [visitedPages, setVisitedPages] = useState([]);
  const [showCoherenceModal, setShowCoherenceModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [currentPageData, setCurrentPageData] = useState(null);
  const [pageStartTime, setPageStartTime] = useState(Date.now());
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsScenarioSelection, setNeedsScenarioSelection] = useState(false);

  // Verifier si le participant doit completer l'accueil
  useEffect(() => {
    if (testerData && (!testerData?.system || !testerData?.screen_type || !testerData?.browser)) {
      setNeedsOnboarding(true);
    }
  }, [testerData]);

  // Charger la seance en cours
  useEffect(() => {
    const loadSession = async () => {
      if (!testerData?.id) return;
      
      const { data } = await userTestingService?.getCurrentSession(testerData?.id);
      if (data) {
        setCurrentSession(data);
        setScenario(data?.scenario);
        setNeedsScenarioSelection(false);
      } else {
        setNeedsScenarioSelection(true);
      }
    };

    loadSession();
  }, [testerData]);

  // Gerer la navigation entre les pages
  useEffect(() => {
    if (!scenario || !currentSession) return;

    const currentPath = location?.pathname;
    const pageInScenario = scenario?.pages?.find(p => currentPath?.includes(p?.url));

    if (pageInScenario && !visitedPages?.includes(currentPath)) {
      setCurrentPageData(pageInScenario);
      setShowCoherenceModal(true);
      setPageStartTime(Date.now());
    }
  }, [location?.pathname, scenario, currentSession]);

  // Gerer la validation du questionnaire de coh?rence
  const handleCoherenceComplete = (answer) => {
    setShowCoherenceModal(false);
    setVisitedPages(prev => [...prev, location?.pathname]);
  };

  // Gerer le questionnaire de sortie
  const handleExitQuestionnaire = async (responses) => {
    const timeSpent = Math.floor((Date.now() - pageStartTime) / 1000);

    await userTestingService?.savePageResponse({
      sessionId: currentSession?.id,
      pageUrl: location?.pathname,
      coherenceQuestion: currentPageData?.coherence_question,
      coherenceAnswer: responses?.coherenceAnswer,
      exitQuestionnaire: responses?.exitAnswers,
      perceivedInfo: responses?.perceivedInfo,
      nextActionUnderstood: responses?.nextActionUnderstood,
      timeSpentSeconds: timeSpent
    });

    setShowExitModal(false);
  };

  // Gerer la selection de scenario
  const handleScenarioSelect = async (scenarioId) => {
    const { data } = await userTestingService?.createSession(testerData?.id, scenarioId);
    if (data) {
      setCurrentSession(data);
      const { data: scenarioData } = await userTestingService?.getScenarioById(scenarioId);
      setScenario(scenarioData);
      setNeedsScenarioSelection(false);
      
      // Rediriger vers la premiere page
      if (scenarioData?.pages?.[0]?.url) {
        navigate(scenarioData?.pages?.[0]?.url);
      }
    }
  };

  // Gerer la fin de l'accueil
  const handleOnboardingComplete = async (contextData) => {
    await userTestingService?.updateTesterContext(testerData?.id, contextData);
    setNeedsOnboarding(false);
  };

  // Intercepter la navigation pour afficher le questionnaire de sortie
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentSession && visitedPages?.includes(location?.pathname)) {
        e?.preventDefault();
        setShowExitModal(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession, visitedPages, location?.pathname]);

  if (needsOnboarding) {
    return <TesterOnboarding onComplete={handleOnboardingComplete} />;
  }

  if (needsScenarioSelection) {
    return <ScenarioSelector onSelect={handleScenarioSelect} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Panneau du scenario */}
      {scenario && currentSession && (
        <ScenarioPanel
          scenario={scenario}
          currentSession={currentSession}
          visitedPages={visitedPages}
          onEndScenario={() => navigate('/interface-mode-essai-panneau-scenario')}
        />
      )}
      {/* Contenu principal */}
      <div className="flex-1 overflow-auto relative">
        {children}

        {/* Bouton de signalement */}
        {currentSession && (
          <ReportProblemButton
            sessionId={currentSession?.id}
            currentPageUrl={location?.pathname}
          />
        )}
      </div>
      {/* Fenêtre de coh?rence */}
      {showCoherenceModal && currentPageData && (
        <CoherenceModal
          question={currentPageData?.coherence_question}
          onComplete={handleCoherenceComplete}
        />
      )}
      {/* Fenêtre de questionnaire de sortie */}
      {showExitModal && currentPageData && (
        <ExitQuestionnaireModal
          questions={currentPageData?.exit_questions}
          onComplete={handleExitQuestionnaire}
        />
      )}
    </div>
  );
};

export default TestModeLayout;
