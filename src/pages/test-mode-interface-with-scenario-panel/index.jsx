import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import testingService from '../../services/testingService';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import CoherenceModal from './components/CoherenceModal';
import ExitQuestionnaireModal from './components/ExitQuestionnaireModal';
import ReportProblemModal from './components/ReportProblemModal';
import toast from 'react-hot-toast';

const TestModeInterfaceWithScenarioPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [testerData, setTesterData] = useState(null);
  const [visitedPages, setVisitedPages] = useState([]);
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [showCoherenceModal, setShowCoherenceModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCompteRenduModal, setShowCompteRenduModal] = useState(false);
  const [pageStartTime, setPageStartTime] = useState(null);
  const [currentResponseId, setCurrentResponseId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Etat du formulaire de compte rendu
  const [whatWasClear, setWhatWasClear] = useState('');
  const [whatBlocked, setWhatBlocked] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('');
  const [notesCompteRendu, setNotesCompteRendu] = useState('');
  const [envoiCompteRendu, setEnvoiCompteRendu] = useState(false);

  useEffect(() => {
    loadTestSession();
  }, [user]);

  useEffect(() => {
    if (session && scenario) {
      const currentPath = location?.pathname;
      setCurrentPageUrl(currentPath);

      // Verifier s'il s'agit d'une nouvelle page du scenario
      const isScenarioPage = scenario?.pages?.some(p => p?.url === currentPath);
      if (isScenarioPage && !visitedPages?.includes(currentPath)) {
        setShowCoherenceModal(true);
        setPageStartTime(Date.now());
      }
    }
  }, [location?.pathname, session, scenario]);

  const loadTestSession = async () => {
    if (!user?.email) {
      navigate('/authentification');
      return;
    }

    setLoading(true);

    // Verifier le statut du participant
    const { data: tester, error: testerError } = await testingService?.checkTesterStatus(user?.email);
    if (testerError || !tester) {
      toast?.error('Accès non autorisé');
      navigate('/accueil-recherche');
      return;
    }

    setTesterData(tester);

    // Recuperer la seance active
    const { data: activeSession, error: sessionError } = await testingService?.getActiveSession(tester?.id);
    if (sessionError || !activeSession) {
      toast?.error('Aucune session d\'essai active');
      navigate('/participant-configuration-contexte-authentification');
      return;
    }

    setSession(activeSession);
    setScenario(activeSession?.test_scenarios);

    // Charger les pages deja visitees
    const { data: responses } = await testingService?.getPageResponses(activeSession?.id);
    if (responses) {
      const visited = responses?.map(r => r?.page_url);
      setVisitedPages(visited);
    }

    setLoading(false);
  };

  const handleCoherenceSubmit = async (answer) => {
    const currentPage = scenario?.pages?.find(p => p?.url === currentPageUrl);
    const question = currentPage?.coherence_question || 'Comprenez-vous l\'objectif de cette page ?';

    const { data, error } = await testingService?.savePageResponse(session?.id, currentPageUrl, {
      coherenceQuestion: question,
      coherenceAnswer: answer
    });

    if (error) {
      toast?.error('Erreur lors de l\'enregistrement de la réponse');
      return;
    }

    setCurrentResponseId(data?.id);
    setVisitedPages([...visitedPages, currentPageUrl]);
    setShowCoherenceModal(false);
    toast?.success('Réponse enregistrée');
  };

  const handleNavigationAttempt = (e) => {
    // Intercepter la navigation pour afficher le questionnaire de sortie
    if (visitedPages?.includes(currentPageUrl) && !showExitModal) {
      e?.preventDefault();
      setShowExitModal(true);
    }
  };

  const handleExitQuestionnaireSubmit = async (answers) => {
    const timeSpent = pageStartTime ? Math.floor((Date.now() - pageStartTime) / 1000) : 0;

    const { error } = await testingService?.updatePageResponse(currentResponseId, {
      exitQuestionnaire: {
        found_what_looking_for: answers?.foundWhatLookingFor,
        next_step: answers?.nextStep,
        understood: answers?.understood
      },
      perceivedInfo: answers?.perceivedInfo,
      nextActionUnderstood: answers?.foundWhatLookingFor === 'Oui',
      timeSpentSeconds: timeSpent
    });

    if (error) {
      toast?.error('Erreur lors de l\'enregistrement du questionnaire');
      return;
    }

    setShowExitModal(false);
    toast?.success('Questionnaire enregistré');
  };

  const handleCompleteScenario = () => {
    const requiredPages = scenario?.pages?.filter(p => p?.required);
    const allRequiredVisited = requiredPages?.every(p => visitedPages?.includes(p?.url));

    if (!allRequiredVisited) {
      toast?.error('Vous devez visiter toutes les pages obligatoires avant de terminer');
      return;
    }

    setShowCompteRenduModal(true);
  };

  const handleCompteRenduSubmit = async () => {
    if (!whatWasClear?.trim() || !whatBlocked?.trim() || !confidenceLevel) {
      toast?.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setEnvoiCompteRendu(true);

    const { error } = await testingService?.completeSession(session?.id, {
      whatWasClear,
      whatBlocked,
      confidenceLevel,
      notes: notesCompteRendu
    });

    setEnvoiCompteRendu(false);

    if (error) {
      toast?.error('Erreur lors de la finalisation de la session');
      return;
    }

    toast?.success('Session terminée avec succès ! Merci pour votre participation.');
    navigate('/participant-configuration-contexte-authentification');
  };

  const getNextSuggestedPage = () => {
    const unvisitedPages = scenario?.pages?.filter(p => !visitedPages?.includes(p?.url));
    if (unvisitedPages?.length > 0) {
      return unvisitedPages?.sort((a, b) => (a?.order || 0) - (b?.order || 0))?.[0];
    }
    return null;
  };

  const calculateProgress = () => {
    const totalPages = scenario?.pages?.length || 0;
    const visited = visitedPages?.length;
    return totalPages > 0 ? Math.round((visited / totalPages) * 100) : 0;
  };

  const allRequiredPagesVisited = () => {
    const requiredPages = scenario?.pages?.filter(p => p?.required) || [];
    return requiredPages?.every(p => visitedPages?.includes(p?.url));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Icon name="Loader" size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de la session d'essai...</p>
        </div>
      </div>
    );
  }

  const nextPage = getNextSuggestedPage();
  const progress = calculateProgress();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panneau du scenario */}
      <div
        className={`fixed left-0 top-0 h-full bg-white border-r border-border shadow-lg transition-transform duration-300 z-50 ${
          isPanelOpen ? 'translate-x-0' : '-translate-x-full'
        } w-80 overflow-y-auto`}
      >
        {/* Panel En-tête */}
        <div className="sticky top-0 bg-primary text-white p-4 border-b border-primary-foreground/20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Mode Essai</h2>
            <button
              onClick={() => setIsPanelOpen(false)}
              className="text-white hover:bg-white/20 rounded p-1 transition-colors"
            >
              <Icon name="ChevronLeft" size={20} />
            </button>
          </div>
          <p className="text-sm text-white/90">{scenario?.title}</p>
        </div>

        {/* Informations du scenario */}
        <div className="p-4 border-b border-border">
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">Objectif</p>
            <p className="text-sm text-foreground">{scenario?.objective}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Instructions</p>
            <p className="text-sm text-foreground">{scenario?.instructions}</p>
          </div>
        </div>

        {/* Progression */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progression</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-surface rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {visitedPages?.length} / {scenario?.pages?.length} pages visitées
          </p>
        </div>

        {/* Liste des pages */}
        <div className="p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Étapes du scénario</h3>
          <div className="space-y-2">
            {scenario?.pages
              ?.sort((a, b) => (a?.order || 0) - (b?.order || 0))
              ?.map((page, index) => {
                const isVisited = visitedPages?.includes(page?.url);
                const isCurrent = currentPageUrl === page?.url;

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? 'border-primary bg-blue-50'
                        : isVisited
                        ? 'border-success/30 bg-success/5' :'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {isVisited ? (
                          <Icon name="CheckCircle" size={18} className="text-success" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-border" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isCurrent ? 'text-primary' : 'text-foreground'
                        }`}>
                          {page?.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{page?.url}</p>
                        {page?.required && (
                          <span className="inline-block text-xs bg-error/10 text-error px-2 py-0.5 rounded mt-1">
                            Obligatoire
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Page suivante suggérée */}
        {nextPage && (
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Page suivante suggérée</p>
            <Button
              variant="outline"
              iconName="ArrowRight"
              onClick={() => navigate(nextPage?.url)}
              fullWidth
              size="sm"
            >
              {nextPage?.title}
            </Button>
          </div>
        )}

        {/* Bouton de fin */}
        {allRequiredPagesVisited() && (
          <div className="p-4 border-t border-border">
            <Button
              variant="default"
              iconName="CheckCircle"
              onClick={handleCompleteScenario}
              fullWidth
              className="bg-success hover:bg-success/90"
            >
              Terminer le scénario
            </Button>
          </div>
        )}
      </div>

      {/* Bouton de reouverture du panneau */}
      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-r-lg shadow-lg z-50 hover:bg-primary/90 transition-colors"
        >
          <Icon name="ChevronRight" size={20} />
        </button>
      )}

      {/* Zone principale */}
      <div className={`flex-1 transition-all duration-300 ${
        isPanelOpen ? 'ml-80' : 'ml-0'
      }`}>
        {/* Indicateur du mode essai */}
        <div className="bg-warning text-warning-foreground px-4 py-2 text-center text-sm font-medium">
          <Icon name="AlertTriangle" size={16} className="inline mr-2" />
          MODE ESSAI ACTIF - Vos actions sont enregistrées
        </div>

        {/* Bouton flottant de signalement */}
        <button
          onClick={() => setShowReportModal(true)}
          className="fixed fab-mobile-safe sm:bottom-6 sm:right-6 bg-error text-white rounded-full p-4 shadow-lg hover:bg-error/90 transition-all hover:scale-110 z-40"
          title="Signaler un problème"
        >
          <Icon name="Flag" size={24} />
        </button>

        {/* Zone de contenu */}
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Icon name="TestTube" size={64} className="text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Interface d'Essai
              </h2>
              <p className="text-muted-foreground mb-6">
                Cette interface se superpose à l'application normale. Naviguez vers les pages du scénario pour commencer l'essai.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>Comment ça marche :</strong>
                </p>
                <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
                  <li>Suivez les étapes du scénario dans le panneau de gauche</li>
                  <li>Répondez aux questions de cohérence en arrivant sur chaque page</li>
                  <li>Remplissez le questionnaire de sortie avant de quitter une page</li>
                  <li>Signalez les problèmes avec le bouton rouge en bas à droite</li>
                  <li>Terminez le scénario quand toutes les pages obligatoires sont visitées</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fenetres */}
      {showCoherenceModal && (
        <CoherenceModal
          onClose={() => {}} // Cannot close without answering
          onSubmit={handleCoherenceSubmit}
          question={scenario?.pages?.find(p => p?.url === currentPageUrl)?.coherence_question || 'Comprenez-vous l\'objectif de cette page ?'}
          pageTitle={scenario?.pages?.find(p => p?.url === currentPageUrl)?.title || currentPageUrl}
        />
      )}

      {showExitModal && (
        <ExitQuestionnaireModal
          onClose={() => {}} // Cannot close without answering
          onSubmit={handleExitQuestionnaireSubmit}
          pageTitle={scenario?.pages?.find(p => p?.url === currentPageUrl)?.title || currentPageUrl}
        />
      )}

      {showReportModal && (
        <ReportProblemModal
          onClose={() => setShowReportModal(false)}
          sessionId={session?.id}
          currentPageUrl={currentPageUrl}
        />
      )}

      {/* Fenêtre de compte rendu */}
      {showCompteRenduModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 rounded-t-lg">
              <div className="flex items-center gap-2">
                <Icon name="MessageSquare" size={24} className="text-primary" />
                <h2 className="text-xl font-bold text-foreground">Compte rendu de seance</h2>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ce qui était clair <span className="text-error">*</span>
                </label>
                <textarea
                  value={whatWasClear}
                  onChange={(e) => setWhatWasClear(e?.target?.value)}
                  placeholder="Qu'est-ce qui était facile à comprendre ?..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ce qui a bloqué <span className="text-error">*</span>
                </label>
                <textarea
                  value={whatBlocked}
                  onChange={(e) => setWhatBlocked(e?.target?.value)}
                  placeholder="Quels ont été les points de blocage ?..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Niveau de confiance <span className="text-error">*</span>
                </label>
                <div className="space-y-2">
                  {['Très confiant', 'Confiant', 'Neutre', 'Peu confiant', 'Pas du tout confiant']?.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="confidence"
                        value={option}
                        checked={confidenceLevel === option}
                        onChange={(e) => setConfidenceLevel(e?.target?.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-foreground">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Notes libres (optionnel)
                </label>
                <textarea
                  value={notesCompteRendu}
                  onChange={(e) => setNotesCompteRendu(e?.target?.value)}
                  placeholder="Autres commentaires..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
            </div>

            <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
              <Button
                variant="default"
                iconName="Check"
                onClick={handleCompteRenduSubmit}
                loading={envoiCompteRendu}
                disabled={!whatWasClear?.trim() || !whatBlocked?.trim() || !confidenceLevel}
              >
                Terminer la session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestModeInterfaceWithScenarioPanel;



