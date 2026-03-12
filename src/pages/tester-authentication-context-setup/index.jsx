import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import testingService from '../../services/testingService';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import toast from 'react-hot-toast';

const TesterAuthenticationContextSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [testerData, setTesterData] = useState(null);
  const [contextFilled, setContextFilled] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Context form state
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

  const checkTesterStatus = async () => {
    if (!user?.email) {
      toast?.error('Vous devez être connecté pour accéder aux essais');
      navigate('/authentification');
      return;
    }

    setLoading(true);
    const { data, error } = await testingService?.checkTesterStatus(user?.email);

    if (error || !data) {
      toast?.error('Vous n\'êtes pas autorisé à accéder au système d\'essai');
      navigate('/accueil-recherche');
      return;
    }

    setTesterData(data);

    // Check if context is already filled
    if (data?.system && data?.screen_type && data?.browser) {
      setSystem(data?.system);
      setScreenType(data?.screen_type);
      setBrowser(data?.browser);
      setContextFilled(true);
      loadScenarios();
    }

    setLoading(false);
  };

  const loadScenarios = async () => {
    const { data, error } = await testingService?.getActiveScenarios();
    if (!error && data) {
      setScenarios(data);
    }
  };

  const handleContextSubmit = async (e) => {
    e?.preventDefault();

    if (!system || !screenType || !browser) {
      toast?.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSubmitting(true);

    const { data, error } = await testingService?.updateTesterContext(testerData?.id, {
      system,
      screenType,
      browser
    });

    setSubmitting(false);

    if (error) {
      toast?.error('Erreur lors de la mise à jour du contexte');
      return;
    }

    toast?.success('Contexte enregistré avec succès');
    setContextFilled(true);
    loadScenarios();
  };

  const handleScenarioSelection = async () => {
    if (!selectedScenario) {
      toast?.error('Veuillez sélectionner un scénario');
      return;
    }

    setSubmitting(true);

    // Creer une session d'essai
    const { data, error } = await testingService?.createTestSession(
      testerData?.id,
      selectedScenario
    );

    setSubmitting(false);

    if (error) {
      toast?.error('Erreur lors de la création de la session d\'essai');
      return;
    }

    toast?.success('Session d\'essai démarrée');
    navigate('/interface-mode-essai-panneau-scenario');
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="TestTube" size={32} className="text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Système d'Essai Utilisateur</h1>
          </div>
          <p className="text-muted-foreground mb-4">
            Bienvenue dans le système d'essai utilisateur. Votre participation nous aide à améliorer l'expérience de tous les utilisateurs.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <Icon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Règles importantes :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ne soufflez jamais la réponse au participant</li>
                  <li>Laissez la personne aller jusqu'au blocage naturel</li>
                  <li>Notez les faits observés, pas les interprétations</li>
                  <li>Gardez le même cadre pour tous les participants</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Context Form */}
        {!contextFilled ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Icon name="Settings" size={24} className="text-primary" />
              Configuration de votre environnement
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Veuillez renseigner votre configuration pour commencer les essais. Ces informations nous permettent de comparer les résultats entre différents profils.
            </p>

            <form onSubmit={handleContextSubmit} className="space-y-6">
              <Select
                label="Système d'exploitation"
                placeholder="Sélectionnez votre système"
                options={systemOptions}
                value={system}
                onChange={setSystem}
                required
              />

              <Select
                label="Type d'écran"
                placeholder="Sélectionnez votre type d'écran"
                options={screenOptions}
                value={screenType}
                onChange={setScreenType}
                required
              />

              <Select
                label="Navigateur"
                placeholder="Sélectionnez votre navigateur"
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
            {/* Context Summary */}
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
                  <p className="text-sm text-muted-foreground mb-1">Écran</p>
                  <p className="font-semibold text-foreground">{screenType}</p>
                </div>
                <div className="bg-surface rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Navigateur</p>
                  <p className="font-semibold text-foreground">{browser}</p>
                </div>
              </div>
            </div>

            {/* Scenario Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="List" size={24} className="text-primary" />
                Sélectionnez un scénario d'essai
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choisissez le scénario que vous souhaitez essayer. Vous devrez suivre les instructions et répondre aux questions tout au long du parcours.
              </p>

              {scenarios?.length === 0 ? (
                <div className="text-center py-8">
                  <Icon name="AlertCircle" size={48} className="text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucun scénario disponible pour le moment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scenarios?.map((scenario) => (
                    <div
                      key={scenario?.id}
                      onClick={() => setSelectedScenario(scenario?.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedScenario === scenario?.id
                          ? 'border-primary bg-blue-50' :'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                            selectedScenario === scenario?.id
                              ? 'border-primary bg-primary' :'border-border'
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
                              <span>{scenario?.pages?.length || 0} pages</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon name="Clock" size={14} />
                              <span>~{(scenario?.pages?.length || 0) * 5} min</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4">
                    <Button
                      variant="default"
                      iconName="Play"
                      onClick={handleScenarioSelection}
                      loading={submitting}
                      disabled={!selectedScenario}
                    >
                      Démarrer l'essai
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Guidelines */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="BookOpen" size={24} className="text-primary" />
            Consignes d'essai
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Pendant l'essai :</strong> Vous devrez répondre à des questions avant et après chaque page. Ces questions nous aident à comprendre votre expérience.
            </p>
            <p>
              <strong className="text-foreground">Signalement de problèmes :</strong> Si vous rencontrez un problème, utilisez le bouton "Signaler un problème" pour nous le faire savoir immédiatement.
            </p>
            <p>
              <strong className="text-foreground">Confidentialité :</strong> Vos réponses sont anonymisées et utilisées uniquement pour améliorer l'application.
            </p>
            <p>
              <strong className="text-foreground">Comportement attendu :</strong> Agissez naturellement comme si vous utilisiez l'application pour la première fois. Ne cherchez pas à "bien faire", mais à être authentique.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TesterAuthenticationContextSetup;
