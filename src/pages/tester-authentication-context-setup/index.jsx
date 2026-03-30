import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import userTestingService from '../../services/userTestingService';
import annonceService from '../../services/annonceService';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import TesterOnboarding from '../../components/TestModeLayout/components/TesterOnboarding';
import { enableTestModeSession } from '../../utils/testModeSession';
import {
  getScenarioStartNavigationPath,
  getSessionResumeNavigationPath
} from '../../utils/testScenarioPaths';
import {
  getTestProgramFamilyMeta,
  normalizeCompletedFamilies,
  TEST_PROGRAM_FAMILIES,
  TEST_PROGRAM_TOTAL_STEPS
} from '../../utils/testingProgram';
import {
  getTestingScenarioBrief,
  testingScenarioNeedsReservationSetup
} from '../../utils/testingScenarioBriefs';
import { getTestingMirrorGuidance } from '../../utils/testingMirrorContext';
import { getTestingTesterRole } from '../../utils/testingTesterRole';
import { supabase } from '../../lib/supabase';

const wait = (delayMs = 0) => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs);
});

const resolveAuthenticatedUserSnapshot = async (fallbackUser = null) => {
  if (fallbackUser?.email) {
    return fallbackUser;
  }

  try {
    const sessionResult = await supabase?.auth?.getSession?.();
    const sessionUser = sessionResult?.data?.session?.user;

    if (sessionUser?.email) {
      return sessionUser;
    }

    const userResult = await supabase?.auth?.getUser?.();
    const authUser = userResult?.data?.user;

    if (authUser?.email) {
      return authUser;
    }
  } catch (error) {
    console.error("Impossible de relire la session d'authentification du participant :", error);
  }

  return null;
};

const getFamilyState = (startState, family) => {
  return (startState?.families || []).find((item) => item.family === family) || null;
};

const pickDefaultFamily = (startState, previousFamily = '') => {
  const families = startState?.families || [];
  const unfinishedFamilies = families.filter((familyState) => !familyState.completed);

  if (previousFamily && unfinishedFamilies.some((familyState) => familyState.family === previousFamily)) {
    return previousFamily;
  }

  const waitingFamily = startState?.waitingRequest?.programFamily;
  if (waitingFamily && unfinishedFamilies.some((familyState) => familyState.family === waitingFamily)) {
    return waitingFamily;
  }

  const familyWithMirror = unfinishedFamilies.find((familyState) => familyState.canReceiveMirror);
  if (familyWithMirror?.family) {
    return familyWithMirror.family;
  }

  const familyWithReference = unfinishedFamilies.find((familyState) => familyState.canAttemptReference);
  if (familyWithReference?.family) {
    return familyWithReference.family;
  }

  return unfinishedFamilies[0]?.family || '';
};

const pickScenarioForFamily = (startState, family, previousScenario = '') => {
  if (!family) return '';

  const familyState = getFamilyState(startState, family);
  const remainingScenarios = familyState.remainingReferenceScenarios || [];
  const remainingScenarioIds = remainingScenarios.map((scenario) => scenario.id);

  if (previousScenario && remainingScenarioIds.includes(previousScenario)) {
    return previousScenario;
  }

  const waitingScenarioId = startState?.waitingRequest?.programFamily === family
    ? startState?.waitingRequest?.referenceScenarioId
    : '';

  if (waitingScenarioId && remainingScenarioIds.includes(waitingScenarioId)) {
    return waitingScenarioId;
  }

  return '';
};

const getFamilyCardMessage = (familyState, testerRole = 'mirror') => {
  if (!familyState) return 'Famille indisponible.';
  if (familyState.completed) return 'Cette famille est déjà faite.';
  if (familyState.canReceiveMirror && familyState.pendingMirror.isReadyToStart === false) {
    return "Le miroir est réservé pour vous, mais l'annonce du test n'est pas encore prête.";
  }
  if (familyState.canReceiveMirror) return 'Vous pouvez commencer directement ici en reprenant le miroir déjà préparé.';
  if (familyState.canAttemptReference) {
    return 'Vous pouvez choisir un parcours ici et lancer la préparation tout de suite.';
  }
  if (familyState.blockedReason === 'no_reference_available') {
    return 'Aucun parcours disponible pour le moment dans cette famille.';
  }
  if (familyState.blockedReason === 'waiting_reference_start' && testerRole === 'mirror') {
    return "En attente qu'un testeur référence lance et prépare ce parcours.";
  }
  if (familyState.blockedReason === 'reference_context_missing') {
    return "La référence est lancée, mais l'annonce du test n'a pas encore été rattachée.";
  }
  return 'Cette famille ne peut pas être lancée pour le moment.';
};

const TesterAuthenticationContextSetup = () => {
  const { user, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [testerData, setTesterData] = useState(null);
  const [contextFilled, setContextFilled] = useState(false);
  const [startState, setStartState] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshingAvailability, setRefreshingAvailability] = useState(false);
  const [resumingSessionId, setResumingSessionId] = useState(null);
  const [system, setSystem] = useState('');
  const [screenType, setScreenType] = useState('');
  const [browser, setBrowser] = useState('');
  const [listingCount, setListingCount] = useState(null);
  const [pausedSessions, setPausedSessions] = useState([]);
  const testerRole = getTestingTesterRole(startState?.testerOrderIndex);
  const isReferenceTester = testerRole === 'reference';

  useEffect(() => {
    if (authLoading) return;
    checkTesterStatus();
  }, [authLoading, user]);

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
    setSelectedScenario((previousScenario) => pickScenarioForFamily(startState, selectedFamily, previousScenario));
  }, [startState, selectedFamily]);

  const loadStartState = async (testerId) => {
    const { data, error } = await userTestingService.getMirrorStartState(testerId);

    if (error) {
      toast.error('Impossible de preparer le demarrage de l essai.');
      return;
    }

    setStartState(data || null);
    const nextFamily = pickDefaultFamily(data, selectedFamily);
    setSelectedFamily(nextFamily);
  };

  const loadPausedSessions = async (testerId) => {
    const { data, error } = await userTestingService.getPausedSessions(testerId);

    if (error) {
      console.error('Impossible de charger les tests en pause :', error);
      return;
    }

    setPausedSessions(data || []);
  };

  const resumeSessionIfNeeded = async (testerId) => {
    const { data: activeSession, error } = await userTestingService.getCurrentSession(testerId);

    if (error || !activeSession?.scenario) {
      return false;
    }

    enableTestModeSession();
    toast.success("Session d'essai reprise.");

    navigate(getSessionResumeNavigationPath(activeSession, activeSession.scenario));
    return true;
  };

  const checkTesterStatus = async () => {
    if (authLoading) {
      return;
    }

    let currentUser = await resolveAuthenticatedUserSnapshot(user);

    if (!currentUser?.email) {
      await wait(750);
      currentUser = await resolveAuthenticatedUserSnapshot(user);
    }

    if (!currentUser?.email) {
      setLoading(false);
      toast.error('Vous devez être connecté pour accéder aux essais.');
      navigate('/authentification');
      return;
    }

    setLoading(true);

    const { data, error } = await userTestingService.checkIfTester(currentUser.email);

    if (error || !data) {
      toast.error("Vous n'êtes pas autorisé à accéder au système d'essai.");
      navigate('/accueil-recherche');
      return;
    }

    setTesterData(data);

    setSystem(data.system || '');
    setScreenType(data.screen_type || '');
    setBrowser(data.browser || '');

    const hasContext = Boolean(data.system && data.screen_type && data.browser);
    setContextFilled(hasContext);

    const resumed = await resumeSessionIfNeeded(data.id);
    if (resumed) {
      setLoading(false);
      return;
    }

    if (hasContext) {
      await Promise.all([
        loadStartState(data.id),
        loadPausedSessions(data.id)
      ]);
    }

    setLoading(false);
  };

  const handleRefreshAvailability = async () => {
    if (!testerData?.id) return;

    setRefreshingAvailability(true);
    await Promise.all([
      loadStartState(testerData.id),
      loadPausedSessions(testerData.id)
    ]);
    setRefreshingAvailability(false);
  };

  const saveContext = async (contextData) => {
    if (!contextData.system || !contextData.screenType || !contextData.browser) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await userTestingService.updateTesterContext(testerData.id, {
      system: contextData.system,
      screenType: contextData.screenType,
      browser: contextData.browser
    });

    setSubmitting(false);

    if (error || !data) {
      toast.error('Erreur lors de la mise à jour du contexte.');
      return;
    }

    setTesterData(data);
    setSystem(data.system || contextData.system || '');
    setScreenType(data.screen_type || contextData.screenType || '');
    setBrowser(data.browser || contextData.browser || '');
    setContextFilled(true);
    await refreshProfile?.();
    await Promise.all([
      loadStartState(data.id),
      loadPausedSessions(data.id)
    ]);
    toast.success('Contexte enregistré avec succès.');
  };

  const handleResumePausedSession = async (session) => {
    if (!session.id) return;

    setResumingSessionId(session.id);
    const { data, error } = await userTestingService.resumePausedSession(session.id);
    setResumingSessionId(null);

    if (error) {
      toast.error('Impossible de reprendre ce test pour le moment.');
      return;
    }

    if (data.mode === 'waiting_admin') {
      toast.error("Attendez le mail de l'observateur avant de reprendre ce test.");
      return;
    }

    if (data.mode === 'other_session_in_progress') {
      toast.error("Terminez d'abord votre autre session en cours.");
      return;
    }

    if (!data.session || !data.scenario) {
      toast.error('La reprise du test a échoué.');
      return;
    }

    enableTestModeSession();
    toast.success('Test repris là où vous vous étiez arrêté.');
    navigate(getSessionResumeNavigationPath(data.session, data.scenario));
  };

  const handleStartSession = async () => {
    if (!testerData?.id || !startState) {
      toast.error("Le démarrage du test n'est pas encore prêt.");
      return;
    }

    const familyState = getFamilyState(startState, selectedFamily);

    if (!familyState || familyState.completed) {
      toast.error('Choisissez une famille encore disponible.');
      return;
    }

    const testerOrderIndex = Number(startState?.testerOrderIndex);
    const hasListings = listingCount === null ? null : Number(listingCount) > 0;
    const startsAsMirror = testerRole === 'mirror' && Boolean(familyState.canReceiveMirror);

    if (testerRole === 'mirror') {
      if (!startsAsMirror) {
        toast.error("Cette famille attend encore qu'un testeur référence lance la préparation.");
        return;
      }

      const pendingMirrorGuidance = getTestingMirrorGuidance({
        sessionRole: 'mirror',
        referenceContext: familyState.pendingMirror.referenceContext
      });
      const pendingMirrorBrief = getTestingScenarioBrief(familyState.pendingMirror.assignedScenario, {
        viewerRole: 'mirror',
        mirrorGuidance: pendingMirrorGuidance,
        testerOrderIndex,
        hasExistingListings: hasListings === null ? undefined : hasListings
      }) || {};

      if (pendingMirrorBrief.isStartBlocked) {
        toast.error("Ce test n'est pas encore prêt. La préparation côté référence est encore en attente.");
        return;
      }
    }

    if (testerRole === 'reference' && !selectedScenario) {
      toast.error('Veuillez choisir un parcours de référence.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await userTestingService.startMirrorSession(
      testerData.id,
      startsAsMirror ? null : selectedScenario,
      selectedFamily
    );

    setSubmitting(false);

    if (error) {
      toast.error("Erreur lors du démarrage de la session d'essai.");
      await loadStartState(testerData.id);
      return;
    }

    if (data.mode === 'waiting_mirror') {
      toast.success("Le parcours référence est mémorisé en attente d'un miroir.");
      await loadStartState(testerData.id);
      return;
    }

    if (data.mode === 'mirror_waiting_reference') {
      toast.error("Cette famille attend encore qu'un testeur référence lance la préparation.");
      await loadStartState(testerData.id);
      return;
    }

    if (data.mode === 'mirror_waiting_context') {
      toast.error("Ce test n'est pas encore prêt. La préparation côté référence est encore en attente.");
      await loadStartState(testerData.id);
      return;
    }

    if (!data.scenario) {
      toast.error('Erreur lors du demarrage de la session d essai.');
      await loadStartState(testerData.id);
      return;
    }

    const startedStepNumber = data.programStepNumber || ((startState?.progressCount || 0) + 1);

    enableTestModeSession();
    if (
      data.mode === 'reference_choice'
      && user?.id
      && data.session.id
      && testingScenarioNeedsReservationSetup(data.scenario)
    ) {
      try {
        await annonceService.syncUserAnnoncesForReferenceTest({
          sessionId: data.session.id,
          userId: user.id,
          ownerEmail: user?.email || '',
          existingContext: {}
        });
      } catch (syncError) {
        console.error('Impossible de synchroniser automatiquement les annonces du test :', syncError);
      }
    }
    await refreshProfile?.();
    toast.success(
      data.mode === 'mirror_assignment'
        ? 'Le parcours miroir de cette famille vous a été attribué automatiquement.'
        : `Test ${startedStepNumber} sur ${TEST_PROGRAM_TOTAL_STEPS} démarre.`
    );
    navigate(getScenarioStartNavigationPath(data.scenario));
  };

  const renderProgressItems = () => {
    const completedFamilies = normalizeCompletedFamilies(startState?.completedFamilies);

    return TEST_PROGRAM_FAMILIES.map((family, index) => {
      const meta = getTestProgramFamilyMeta(family);
      const isDone = completedFamilies.includes(family);
      const isSelected = !isDone && family === selectedFamily;

      return (
        <div
          key={family}
          className={`rounded-lg border p-4 ${
            isDone
              ? 'border-green-200 bg-green-50'
              : isSelected
                ? 'border-blue-200 bg-blue-50'
                : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Test {index + 1} sur {TEST_PROGRAM_TOTAL_STEPS}
              </p>
              <p className="font-semibold text-foreground">{meta.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-sm font-semibold">
              {isDone ? <Icon name="Check" size={16} /> : index + 1}
            </div>
          </div>
        </div>
      );
    });
  };

  const renderWaitingRequest = () => {
    const waitingRequest = startState?.waitingRequest;
    if (!waitingRequest || !waitingRequest.isStartableNow) return null;

    const familyMeta = getTestProgramFamilyMeta(waitingRequest.programFamily);

    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-semibold text-green-950">
          Votre parcours choisi peut maintenant demarrer.
        </p>
        <p className="mt-2 text-sm text-green-900">
          {waitingRequest.referenceScenario.title} ({familyMeta.label})
        </p>
        <p className="mt-2 text-sm text-green-900">
          Ouvrez cette famille puis relancez le depart.
        </p>
      </div>
    );
  };

  const renderPausedSessions = () => {
    if (!pausedSessions.length) return null;

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">
            Parcours mis en pause par l'observateur
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Seul l'observateur admin peut mettre un test en pause. Il vous préviendra ensuite par e-mail quand la correction sera faite pour que vous puissiez reprendre exactement là où vous vous étiez arrêté.
          </p>
        </div>

        <div className="space-y-4">
          {pausedSessions.map((session) => {
            const runtimeState = session?.runtimeState || {};
            const sessionScenario = session?.scenario || null;
            const scenarioBrief = getTestingScenarioBrief(sessionScenario, {
              viewerRole: runtimeState?.sessionRole || sessionScenario?.mirror_role || testerRole,
              mirrorGuidance: getTestingMirrorGuidance(runtimeState),
              testerOrderIndex: Number(runtimeState?.testerOrderIndex || startState?.testerOrderIndex),
              hasExistingListings: listingCount === null ? undefined : Number(listingCount) > 0
            }) || {};
            const resumeAllowed = Boolean(session?.resume_ready_at);

            return (
              <div key={session?.id} className="rounded-lg border border-border bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
                        En pause
                      </span>
                      {resumeAllowed ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                          Reprise autorisée
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                          En attente du mail de l'observateur
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-foreground">
                      {scenarioBrief.participantTitle || sessionScenario?.title || 'Parcours en pause'}
                    </h3>

                    {scenarioBrief.participantSituation && (
                      <p className="text-sm text-muted-foreground">{scenarioBrief.participantSituation}</p>
                    )}

                    {scenarioBrief.participantGoal && (
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Votre objectif :</span>{' '}
                        {scenarioBrief.participantGoal}
                      </p>
                    )}

                    {session?.pause_reason && (
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Pourquoi la pause :</span>{' '}
                        {session?.pause_reason}
                      </p>
                    )}

                    {!resumeAllowed && (
                      <p className="text-sm text-slate-700">
                        Attendez le mail de l observateur admin avant de reprendre ce parcours.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      variant="default"
                      iconName="Play"
                      onClick={() => handleResumePausedSession(session)}
                      loading={resumingSessionId === session?.id}
                      disabled={!resumeAllowed}
                    >
                      Reprendre ce parcours
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFamilyCards = () => {
    const families = startState?.families || [];

    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TEST_PROGRAM_FAMILIES.map((family) => {
          const familyState = families.find((item) => item.family === family);
          const meta = getTestProgramFamilyMeta(family);
          const isSelected = selectedFamily === family;

          return (
            <button
              key={family}
              type="button"
              onClick={() => setSelectedFamily(family)}
              data-testid={`testing-family-card-${family}`}
              className={`rounded-lg border p-4 text-left transition-colors ${
                isSelected ? 'border-primary bg-blue-50' : 'border-border bg-white hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{meta.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                </div>
                {familyState.completed ? (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    Faite
                  </span>
                ) : familyState.canReceiveMirror ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                    Miroir
                  </span>
                ) : familyState.canAttemptReference ? (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-900">
                    Choix libre
                  </span>
                ) : testerRole === 'mirror' ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    En attente
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    Indisponible
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                {getFamilyCardMessage(familyState, testerRole)}
              </p>
            </button>
          );
        })}
      </div>
    );
  };

  const renderSelectedFamilyPanel = () => {
    if (!startState || startState.mode === 'program_completed') {
      return null;
    }

    const familyState = getFamilyState(startState, selectedFamily);
    const testerOrderIndex = Number(startState?.testerOrderIndex);
    const hasListings = listingCount === null ? null : Number(listingCount) > 0;
    if (!familyState) {
      return (
        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="text-muted-foreground">Choisissez une famille pour voir les parcours que vous pouvez lancer.</p>
        </div>
      );
    }

    const familyMeta = getTestProgramFamilyMeta(selectedFamily);
    const remainingScenarios = familyState.remainingReferenceScenarios || [];
    const pendingMirror = familyState.pendingMirror;

    if (familyState.completed) {
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <p className="font-semibold text-green-950">{familyMeta.label} est déjà faite.</p>
          <p className="mt-2 text-sm text-green-900">
            Choisissez une autre famille pour continuer vos essais.
          </p>
        </div>
      );
    }

    if (pendingMirror && testerRole === 'mirror') {
      const pendingMirrorGuidance = getTestingMirrorGuidance({
        sessionRole: 'mirror',
        referenceContext: pendingMirror.referenceContext
      });
      const pendingMirrorBrief = getTestingScenarioBrief(pendingMirror.assignedScenario, {
        viewerRole: 'mirror',
        mirrorGuidance: pendingMirrorGuidance,
        testerOrderIndex,
        hasExistingListings: hasListings === null ? undefined : hasListings
      }) || {};
      const pendingMirrorBlocked = Boolean(pendingMirrorBrief.isStartBlocked);

      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">
              {pendingMirrorBlocked
                ? "Le miroir vous est réservé, mais ce test n'est pas encore prêt."
                : 'Cette fois-ci, vous recevez automatiquement le parcours miroir.'}
            </p>
            <p className="mt-2 text-sm text-amber-900">
              {pendingMirrorBlocked
                ? (pendingMirrorBrief.prerequisite || "Ce test n'est pas encore prêt.")
                : "Le participant référence a déjà choisi et préparé le départ. Vous n'avez plus qu'à reprendre le miroir correspondant."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="CheckCircle" size={18} className="text-primary" />
               <p className="font-semibold text-foreground">Parcours à reprendre</p>
            </div>
            <h3 className="mb-2 break-words text-lg font-bold text-foreground">
              {pendingMirrorBrief.participantTitle}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {pendingMirrorBrief.participantSituation}
            </p>
            {pendingMirrorBrief.participantGoal && (
              <p className="mb-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Votre objectif :</span>{' '}
                {pendingMirrorBrief.participantGoal}
              </p>
            )}
            {(pendingMirrorBrief.firstAction || pendingMirrorBrief.startPoint) && (
              <p className="mb-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Commencez par :</span>{' '}
                {pendingMirrorBrief.firstAction || pendingMirrorBrief.startPoint}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Référence déjà lancée : {pendingMirror.referenceScenario.title}
            </p>
          </div>

          <div className="flex justify-end">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="default"
                iconName="Play"
                onClick={handleStartSession}
                loading={submitting}
                disabled={pendingMirrorBlocked}
              >
                {pendingMirrorBlocked
                  ? "En attente de l'annonce du test"
                  : 'Commencer ce parcours'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!familyState.canAttemptReference) {
      return (
        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="font-semibold text-foreground">
            {testerRole === 'mirror'
              ? 'Cette famille attend encore un lancement référence.'
              : 'Aucun parcours disponible dans cette famille.'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {testerRole === 'mirror'
              ? "Revenez ici dès qu'un participant référence aura lancé et préparé ce test."
              : "Soit tous les parcours de cette famille sont déjà pris, soit cette famille n'est pas encore complètement préparée."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-950">
            Vous êtes le prochain participant libre à choisir un parcours de référence.
          </p>
          <p className="mt-2 text-sm text-blue-900">
            Vous pouvez le démarrer et préparer le contexte même si aucun miroir n'est encore connecté. Si vous avez déjà des annonces,
            vous pourrez en rattacher une ensuite depuis Mes annonces.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {familyMeta.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {remainingScenarios.length} parcours disponible(s) dans cette famille
          </p>
        </div>

        <div className="space-y-4">
          {remainingScenarios.map((scenario) => {
            const scenarioBrief = getTestingScenarioBrief(scenario, {
              viewerRole: 'reference',
              testerOrderIndex,
              hasExistingListings: listingCount === null ? undefined : Number(listingCount) > 0
            });

            return (
              <div
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario.id)}
                data-testid={`testing-reference-scenario-${scenario.id}`}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedScenario === scenario.id
                    ? 'border-primary bg-blue-50'
                    : 'border-border hover:border-primary/50 bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                      selectedScenario === scenario.id
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    }`}
                  >
                    {selectedScenario === scenario.id && (
                      <Icon name="Check" size={16} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 break-words font-bold text-foreground">
                      {scenarioBrief.participantTitle}
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {scenarioBrief.participantSituation}
                    </p>
                    {scenarioBrief.participantGoal && (
                      <p className="mb-2 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Votre objectif :</span>{' '}
                        {scenarioBrief.participantGoal}
                      </p>
                    )}
                    {(scenarioBrief.firstAction || scenarioBrief.startPoint) && (
                      <p className="mb-2 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Commencez par :</span>{' '}
                        {scenarioBrief.firstAction || scenarioBrief.startPoint}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Icon name="FileText" size={14} />
                        <span>{scenario.pages.length || 0} écrans repérés</span>
                      </div>
                      {startState?.campaignLabel && (
                        <div className="flex items-center gap-1">
                          <Icon name="Layers" size={14} />
                          <span>{startState?.campaignLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            variant="default"
            iconName="Play"
            onClick={handleStartSession}
            loading={submitting}
            disabled={!selectedScenario}
          >
            Commencer ce parcours
          </Button>
        </div>
      </div>
    );
  };

  const renderStartSection = () => {
    if (!startState) {
      return (
        <div className="text-center py-8">
          <Icon name="Loader" size={40} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Preparation de votre demarrage...</p>
        </div>
      );
    }

    if (startState.mode === 'program_completed') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{renderProgressItems()}</div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-950">
              Vos {TEST_PROGRAM_TOTAL_STEPS} tests obligatoires sont terminés pour la vague en cours.
            </p>
            <p className="mt-2 text-sm text-green-900">
              Vous avez terminé le parcours abouti, l'échec côté locataire, l'échec côté propriétaire et les incidents transverses.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{renderProgressItems()}</div>
        {renderPausedSessions()}
        {renderWaitingRequest()}
        {renderFamilyCards()}
        {renderSelectedFamilyPanel()}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Icon name="Loader" size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification de votre accès...</p>
        </div>
      </div>
    );
  }

  if (!contextFilled) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <TesterOnboarding
            fullscreen={false}
            outerClassName="min-h-full flex items-center justify-center px-4 py-10 md:px-6 md:py-16"
            initialContext={{ system, screenType, browser }}
            submitting={submitting}
            onComplete={saveContext}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="TestTube" size={32} className="text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Parcours d essai utilisateur</h1>
          </div>
          <p className="text-muted-foreground mb-4">
            Cet espace sert a preparer puis lancer les essais utilisateurs dans les bonnes conditions.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <Icon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 space-y-2">
                <p className="font-semibold">Déroulement automatique du protocole</p>
                <p>
                  Chaque testeur passe {TEST_PROGRAM_TOTAL_STEPS} tests dans cet ordre : parcours abouti, échec côté locataire, échec côté propriétaire, puis incidents transverses.
                </p>
                <p>
                  À l'intérieur de chaque famille, le participant référence choisit et prépare le départ, puis le participant miroir reçoit automatiquement le parcours correspondant.
                </p>
                <p>
                  Si vous êtes référence, vous pouvez maintenant démarrer et préparer le contexte même si le miroir n'est pas encore connecté. Si vous êtes miroir, vous devez attendre qu'une annonce de test soit préparée avant de continuer.
                </p>
                <p>
                  Si l'observateur admin met un test en pause, vous pourrez passer à un autre parcours. Il vous préviendra ensuite par e-mail quand vous pourrez reprendre exactement là où vous vous étiez arrêté.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="CheckCircle" size={24} className="text-success" />
            Configuration enregistrée
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Système</p>
              <p className="font-semibold text-foreground">{system}</p>
            </div>
            <div className="bg-surface rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Ecran</p>
              <p className="font-semibold text-foreground">{screenType}</p>
            </div>
            <div className="bg-surface rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Navigateur</p>
              <p className="font-semibold text-foreground">{browser}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Icon name="List" size={24} className="text-primary" />
                Démarrage de votre parcours
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                L'application suit vos {TEST_PROGRAM_TOTAL_STEPS} passages obligatoires et applique automatiquement la logique référence / miroir dans chaque famille.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {startState
                  ? `Vous avez déjà terminé ${startState?.progressCount || 0} famille(s) sur ${TEST_PROGRAM_TOTAL_STEPS}. Rôle actuel : ${isReferenceTester ? 'référence' : 'miroir'}.`
                  : 'Chargement de votre avancement et de votre rôle dans le protocole...'}
              </p>
            </div>
            <Button
              variant="outline"
              iconName="RefreshCw"
              onClick={handleRefreshAvailability}
              loading={refreshingAvailability}
            >
              Actualiser
            </Button>
          </div>

          {renderStartSection()}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="BookOpen" size={24} className="text-primary" />
            Consignes d'essai
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Pendant le parcours :</strong> un court questionnaire QCM avec commentaire libre revient régulièrement, en pratique toutes les deux étapes environ.
            </p>
            <p>
              <strong className="text-foreground">Rythme du binôme :</strong> certaines étapes dépendent de l'autre testeur. Il est donc normal d'attendre parfois que l'autre côté avance.
            </p>
            <p>
              <strong className="text-foreground">Besoin d'aide :</strong> à tout moment, vous pouvez contacter l'observateur via le chat rond jaune en bas à droite.
            </p>
            <p>
              <strong className="text-foreground">En cas de problème :</strong> utilisez le bouton de signalement visible pendant l'essai pour décrire ce qui vous a bloqué.
            </p>
            <p>
              <strong className="text-foreground">Comportement attendu :</strong> utilisez l'application naturellement, sans chercher à donner la bonne réponse.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TesterAuthenticationContextSetup;

