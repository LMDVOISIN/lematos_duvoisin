import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import userTestingService from '../../services/userTestingService';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import { enableTestModeSession } from '../../utils/testModeSession';
import { resolveScenarioPath } from '../../utils/testScenarioPaths';
import {
  getTestProgramFamilyMeta,
  getTestProgramStepNumber,
  normalizeCompletedFamilies,
  TEST_PROGRAM_FAMILIES,
  TEST_PROGRAM_TOTAL_STEPS
} from '../../utils/testingProgram';

const getFirstScenarioPage = (scenario) => {
  return [...(scenario?.pages || [])]
    .sort((firstPage, secondPage) => (firstPage?.order || 0) - (secondPage?.order || 0))
    .find((page) => page?.url);
};

const TesterAuthenticationContextSetup = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [testerData, setTesterData] = useState(null);
  const [contextFilled, setContextFilled] = useState(false);
  const [startState, setStartState] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [system, setSystem] = useState('');
  const [screenType, setScreenType] = useState('');
  const [browser, setBrowser] = useState('');

  const systemOptions = [
    { value: 'Windows', label: 'Windows' },
    { value: 'Mac', label: 'Mac' },
    { value: 'Linux', label: 'Linux' },
    { value: 'iOS', label: 'iOS' },
    { value: 'Android', label: 'Android' }
  ];

  const screenOptions = [
    { value: 'Desktop', label: 'Desktop' },
    { value: 'Tablet', label: 'Tablette' },
    { value: 'Mobile', label: 'Mobile' }
  ];

  const browserOptions = [
    { value: 'Chrome', label: 'Chrome' },
    { value: 'Firefox', label: 'Firefox' },
    { value: 'Safari', label: 'Safari' },
    { value: 'Edge', label: 'Edge' },
    { value: 'Other', label: 'Autre' }
  ];

  useEffect(() => {
    checkTesterStatus();
  }, [user]);

  const loadStartState = async (testerId) => {
    const { data, error } = await userTestingService?.getMirrorStartState(testerId);

    if (error) {
      toast?.error('Impossible de preparer le demarrage de l essai.');
      return;
    }

    setStartState(data || null);

    const remainingIds = (data?.remainingReferenceScenarios || [])?.map((scenario) => scenario?.id);
    setSelectedScenario((previousScenario) => (
      remainingIds?.includes(previousScenario) ? previousScenario : ''
    ));
  };

  const resumeSessionIfNeeded = async (testerId) => {
    const { data: activeSession, error } = await userTestingService?.getCurrentSession(testerId);

    if (error || !activeSession?.scenario) {
      return false;
    }

    enableTestModeSession();
    toast?.success('Session d essai reprise.');

    const firstPage = getFirstScenarioPage(activeSession?.scenario);
    navigate(resolveScenarioPath(firstPage?.url || '/accueil-recherche'));
    return true;
  };

  const checkTesterStatus = async () => {
    if (!user?.email) {
      toast?.error('Vous devez etre connecte pour acceder aux essais.');
      navigate('/authentification');
      return;
    }

    setLoading(true);

    const { data, error } = await userTestingService?.checkIfTester(user?.email);

    if (error || !data) {
      toast?.error('Vous n etes pas autorise a acceder au systeme d essai.');
      navigate('/accueil-recherche');
      return;
    }

    setTesterData(data);

    const hasContext = Boolean(data?.system && data?.screen_type && data?.browser);

    if (hasContext) {
      setSystem(data?.system);
      setScreenType(data?.screen_type);
      setBrowser(data?.browser);
      setContextFilled(true);
    }

    const resumed = await resumeSessionIfNeeded(data?.id);
    if (resumed) {
      setLoading(false);
      return;
    }

    if (hasContext) {
      await loadStartState(data?.id);
    }

    setLoading(false);
  };

  const handleContextSubmit = async (event) => {
    event?.preventDefault();

    if (!system || !screenType || !browser) {
      toast?.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await userTestingService?.updateTesterContext(testerData?.id, {
      system,
      screenType,
      browser
    });

    setSubmitting(false);

    if (error || !data) {
      toast?.error('Erreur lors de la mise a jour du contexte.');
      return;
    }

    setTesterData(data);
    setContextFilled(true);
    await refreshProfile?.();
    await loadStartState(data?.id);
    toast?.success('Contexte enregistre avec succes.');
  };

  const handleStartSession = async () => {
    const needsChoice = startState?.mode === 'reference_choice';

    if (needsChoice && !selectedScenario) {
      toast?.error('Veuillez choisir un parcours de reference.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await userTestingService?.startMirrorSession(
      testerData?.id,
      needsChoice ? selectedScenario : null
    );

    setSubmitting(false);

    if (error || !data?.scenario) {
      toast?.error('Erreur lors du demarrage de la session d essai.');
      await loadStartState(testerData?.id);
      return;
    }

    const firstPage = getFirstScenarioPage(data?.scenario);
    const startedStepNumber = data?.programStepNumber || getTestProgramStepNumber(startState?.completedFamilies);

    enableTestModeSession();
    await refreshProfile?.();
    toast?.success(
      data?.mode === 'mirror_assignment'
        ? 'Le parcours miroir de ce test vous a ete attribue automatiquement.'
        : `Test ${startedStepNumber} sur ${TEST_PROGRAM_TOTAL_STEPS} demarre.`
    );
    navigate(resolveScenarioPath(firstPage?.url || '/accueil-recherche'));
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
                : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Test {index + 1} sur {TEST_PROGRAM_TOTAL_STEPS}
              </p>
              <p className="font-semibold text-foreground">{meta?.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta?.description}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-sm font-semibold">
              {isDone ? <Icon name="Check" size={16} /> : index + 1}
            </div>
          </div>
        </div>
      );
    });
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

    const completedFamilies = normalizeCompletedFamilies(startState?.completedFamilies);
    const requiredFamily = startState?.requiredFamily;
    const requiredFamilyMeta = getTestProgramFamilyMeta(requiredFamily);
    const stepNumber = startState?.programStepNumber || getTestProgramStepNumber(completedFamilies);
    const progressItems = renderProgressItems(completedFamilies, requiredFamily);

    if (startState?.mode === 'program_completed') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{progressItems}</div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-950">
              Vos {TEST_PROGRAM_TOTAL_STEPS} tests obligatoires sont termines pour la vague en cours.
            </p>
            <p className="mt-2 text-sm text-green-900">
              Vous avez deja passe le parcours abouti, l echec cote locataire, l echec cote
              proprietaire et les incidents transverses.
            </p>
          </div>
        </div>
      );
    }

    if (startState?.mode === 'mirror_assignment') {
      const assignedScenario = startState?.assignedScenario;
      const referenceScenario = startState?.referenceScenario;

      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{progressItems}</div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Test {stepNumber} sur {TEST_PROGRAM_TOTAL_STEPS}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{requiredFamilyMeta?.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{requiredFamilyMeta?.description}</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-950">
              Cette fois-ci, vous ne choisissez pas.
            </p>
            <p className="mt-2 text-sm text-amber-900">
              Sur ce type de test, le participant juste avant vous a choisi le parcours de
              reference. Vous recevez donc automatiquement son parcours miroir.
            </p>
          </div>

          <div className="border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="CheckCircle" size={18} className="text-primary" />
              <p className="font-semibold text-foreground">Parcours qui vous est attribue</p>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{assignedScenario?.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{assignedScenario?.objective}</p>
            <p className="text-xs text-muted-foreground">
              Choix de depart correspondant : {referenceScenario?.title || 'Parcours de reference'}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              variant="default"
              iconName="Play"
              onClick={handleStartSession}
              loading={submitting}
            >
              Demarrer mon parcours attribue
            </Button>
          </div>
        </div>
      );
    }

    if (startState?.mode === 'unavailable') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{progressItems}</div>

          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <Icon name="AlertCircle" size={40} className="text-muted-foreground mx-auto mb-4" />
            <p className="font-semibold text-foreground mb-2">
              Aucun parcours de reference n est libre pour {requiredFamilyMeta?.label?.toLowerCase()} dans la vague en cours.
            </p>
            <p className="text-sm text-muted-foreground">
              Demandez a l observateur d ouvrir une nouvelle vague ou d activer un autre binome
              pour cette famille de test.
            </p>
          </div>
        </div>
      );
    }

    const remainingScenarios = startState?.remainingReferenceScenarios || [];

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{progressItems}</div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Test {stepNumber} sur {TEST_PROGRAM_TOTAL_STEPS}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{requiredFamilyMeta?.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{requiredFamilyMeta?.description}</p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-950">
            Vous etes le prochain participant libre a choisir un parcours de reference.
          </p>
          <p className="mt-2 text-sm text-blue-900">
            Pour ce type de test, la personne suivante recevra automatiquement le miroir du
            parcours que vous allez choisir maintenant.
          </p>
        </div>

        {remainingScenarios?.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <Icon name="AlertCircle" size={40} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun parcours de reference n est disponible.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {remainingScenarios?.map((scenario) => (
              <div
                key={scenario?.id}
                onClick={() => setSelectedScenario(scenario?.id)}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedScenario === scenario?.id
                    ? 'border-primary bg-blue-50'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                      selectedScenario === scenario?.id
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    }`}
                  >
                    {selectedScenario === scenario?.id && (
                      <Icon name="Check" size={16} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground mb-2">{scenario?.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{scenario?.objective}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Icon name="FileText" size={14} />
                        <span>{scenario?.pages?.length || 0} etapes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="Clock" size={14} />
                        <span>~{(scenario?.pages?.length || 0) * 5} min</span>
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
            ))}

            <div className="flex justify-end pt-4">
              <Button
                variant="default"
                iconName="Play"
                onClick={handleStartSession}
                loading={submitting}
                disabled={!selectedScenario}
              >
                Demarrer le parcours choisi
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Icon name="Loader" size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verification de votre acces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="TestTube" size={32} className="text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Parcours d essai utilisateur</h1>
          </div>
          <p className="text-muted-foreground mb-4">
            Cet espace sert a preparer puis lancer les essais utilisateurs dans les bonnes
            conditions.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <Icon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 space-y-2">
                <p className="font-semibold">Deroulement automatique du protocole</p>
                <p>
                  Chaque testeur passe {TEST_PROGRAM_TOTAL_STEPS} tests dans cet ordre : parcours
                  abouti, echec cote locataire, echec cote proprietaire, puis incidents
                  transverses.
                </p>
                <p>
                  A l interieur de chaque type de test, le premier participant libre choisit une
                  reference, puis le suivant recoit automatiquement son miroir.
                </p>
                <p>
                  L application sait donc a la fois quel test il vous manque et si vous devez
                  choisir la reference ou recevoir le miroir.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!contextFilled ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Icon name="Settings" size={24} className="text-primary" />
              Configuration de votre environnement
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Merci de renseigner votre appareil et votre navigateur avant de commencer. Cela
              permet de comparer les retours dans un cadre coherent.
            </p>

            <form onSubmit={handleContextSubmit} className="space-y-6">
              <Select
                label="Systeme d exploitation"
                placeholder="Selectionnez votre systeme"
                options={systemOptions}
                value={system}
                onChange={setSystem}
                required
              />

              <Select
                label="Type d ecran"
                placeholder="Selectionnez votre type d ecran"
                options={screenOptions}
                value={screenType}
                onChange={setScreenType}
                required
              />

              <Select
                label="Navigateur"
                placeholder="Selectionnez votre navigateur"
                options={browserOptions}
                value={browser}
                onChange={setBrowser}
                required
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="default"
                  iconName="Check"
                  loading={submitting}
                  disabled={!system || !screenType || !browser}
                >
                  Enregistrer la configuration
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="CheckCircle" size={24} className="text-success" />
                Configuration enregistree
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Systeme</p>
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
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="List" size={24} className="text-primary" />
                Demarrage de votre parcours
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                L application suit maintenant vos {TEST_PROGRAM_TOTAL_STEPS} passages obligatoires.
                Elle sait quel type de test il vous manque et applique la logique miroir a
                l interieur de cette famille.
              </p>

              {renderStartSection()}
            </div>
          </>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="BookOpen" size={24} className="text-primary" />
            Consignes d essai
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Pendant le parcours :</strong> une question vous
              est posee a l arrivee sur chaque etape, puis un court bilan vous est demande avant
              d en sortir.
            </p>
            <p>
              <strong className="text-foreground">En cas de blocage :</strong> utilisez le bouton
              d urgence pour ouvrir un echange avec l observateur et vous faire debloquer.
            </p>
            <p>
              <strong className="text-foreground">En cas de probleme :</strong> utilisez le bouton
              de signalement visible pendant l essai pour decrire ce qui vous a bloque.
            </p>
            <p>
              <strong className="text-foreground">Comportement attendu :</strong> utilisez
              l application naturellement, sans chercher a donner la bonne reponse.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TesterAuthenticationContextSetup;
